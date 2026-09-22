import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  like,
  or,
} from "drizzle-orm";

import {
  resourceAnnotations,
  resourceMetadata,
  resourceReadLater,
  resources,
  collaborators,
  shares,
  spaces,
  starredResources,
  users,
  vaults,
} from "../db/schema";
import { normalizeResourceMetadata } from "../domain/resources/metadata";
import { parseMagnetLink, type ResourceType } from "../domain/resources/input";
import { notFound } from "../lib/errors";
import type { Actor, Db } from "../types/legacy-api";
import { importVaultSchema } from "../schemas/vault";
import type { VaultExportPayload } from "../schemas/vault";
import { ensureActorUser } from "./user-service";
import {
  getVaultRoleForActor,
  requireVaultPermission,
  requireVaultRead,
} from "./permission-service";
import { newId, newShareSlug, newToken } from "../lib/id";
import {
  findVaultById,
  updateVaultById,
} from "../repositories/vault.repository";
import { recordHistory } from "./history-service";

type VaultVisibility = "public" | "private" | "password";
const IMPORT_INSERT_BATCH_SIZE = 100;
const VAULT_DETAIL_INLINE_RESOURCE_LIMIT = 80;
const VAULT_RESOURCE_BATCH_PAGE_LIMIT = 20;
const VAULT_RESOURCE_BATCH_SPACE_LIMIT = 12;

export async function getVaultOrThrow(db: Db, vaultId: string) {
  const vault = await findVaultById(db, vaultId);
  if (!vault) throw notFound("Vault not found.");
  return vault;
}

export async function listVaults(
  db: Db,
  input: {
    query?: string;
    actor: Actor;
  },
) {
  const rows = await db
    .select({
      id: vaults.id,
      title: vaults.title,
      description: vaults.description,
      cover: vaults.cover,
      ownerName: users.name,
      ownerId: vaults.ownerId,
      visibility: vaults.visibility,
      collectionEnabled: vaults.collectionEnabled,
      nsfwEnabled: vaults.nsfwEnabled,
      starCount: vaults.starCount,
      forkCount: vaults.forkCount,
      createdAt: vaults.createdAt,
      updatedAt: vaults.updatedAt,
    })
    .from(vaults)
    .leftJoin(users, eq(vaults.ownerId, users.id))
    .where(
      and(
        isNull(vaults.deletedAt),
        eq(vaults.ownerId, input.actor.id),
        input.query
          ? or(
              like(vaults.title, `%${input.query}%`),
              like(vaults.description, `%${input.query}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(vaults.createdAt))
    .limit(50);

  const vaultIds = rows.map((vault) => vault.id);
  if (vaultIds.length === 0)
    return rows.map((vault) => ({ ...vault, resourceCount: 0 }));

  const resourceCountRows = await db
    .select({
      vaultId: resources.vaultId,
      resourceCount: count(),
    })
    .from(resources)
    .where(inArray(resources.vaultId, vaultIds))
    .groupBy(resources.vaultId);
  const cardBackgroundImageByVaultId = await listVaultCardBackgroundImages(
    db,
    vaultIds,
  );
  const resourceCountByVaultId = new Map(
    resourceCountRows.map((row) => [row.vaultId!, row.resourceCount]),
  );

  return rows.map((vault) => ({
    ...vault,
    cardBackgroundImage: cardBackgroundImageByVaultId.get(vault.id) ?? null,
    resourceCount: resourceCountByVaultId.get(vault.id) ?? 0,
  }));
}

/** Lists vaults that the current user can access through collaboration. */
export async function listSharedVaults(
  db: Db,
  input: { actor: Actor },
) {
  const userId = await ensureActorUser(db, input.actor);
  const rows = await db
    .select({
      id: vaults.id,
      title: vaults.title,
      description: vaults.description,
      cover: vaults.cover,
      ownerName: users.name,
      role: collaborators.role,
      visibility: vaults.visibility,
    })
    .from(collaborators)
    .innerJoin(vaults, eq(collaborators.vaultId, vaults.id))
    .leftJoin(users, eq(vaults.ownerId, users.id))
    .where(and(eq(collaborators.userId, userId), isNull(vaults.deletedAt)))
    .orderBy(desc(collaborators.updatedAt))
    .limit(50);

  const vaultIds = rows.map((vault) => vault.id);
  if (vaultIds.length === 0)
    return rows.map((vault) => ({ ...vault, resourceCount: 0 }));

  const resourceCounts = await db
    .select({ vaultId: resources.vaultId, resourceCount: count() })
    .from(resources)
    .where(inArray(resources.vaultId, vaultIds))
    .groupBy(resources.vaultId);
  const cardBackgroundImageByVaultId = await listVaultCardBackgroundImages(
    db,
    vaultIds,
  );
  const resourceCountByVaultId = new Map(
    resourceCounts.map((row) => [row.vaultId!, row.resourceCount]),
  );

  return rows.map((vault) => ({
    ...vault,
    cardBackgroundImage: cardBackgroundImageByVaultId.get(vault.id) ?? null,
    resourceCount: resourceCountByVaultId.get(vault.id) ?? 0,
  }));
}

async function listVaultCardBackgroundImages(db: Db, vaultIds: string[]) {
  const rows = await db
    .select({
      vaultId: resources.vaultId,
      metadataDataJson: resourceMetadata.dataJson,
    })
    .from(resources)
    .innerJoin(resourceMetadata, eq(resourceMetadata.resourceId, resources.id))
    .where(inArray(resources.vaultId, vaultIds))
    .orderBy(desc(resources.createdAt));

  const images = new Map<string, string>();
  for (const row of rows) {
    if (!row.vaultId || images.has(row.vaultId)) continue;
    const image = getCardBackgroundImage(row.metadataDataJson);
    if (image) images.set(row.vaultId, image);
  }
  return images;
}

function getCardBackgroundImage(data: unknown) {
  const metadata = normalizeResourceMetadata(data);
  for (const media of metadata?.media ?? []) {
    if (media.kind === "image") {
      const image = media.thumbnailUrl ?? media.url;
      if (typeof image === "string" && image.trim()) return image;
    }
    if (media.kind === "video" && typeof media.thumbnailUrl === "string" && media.thumbnailUrl.trim()) {
      return media.thumbnailUrl;
    }
  }
  return null;
}

export async function createVault(
  db: Db,
  input: {
    title: string;
    description: string;
    cover?: string;
    visibility: VaultVisibility;
    collectionEnabled?: boolean;
    actor: Actor;
  },
) {
  const vaultId = newId();
  const spaceId = newId();
  const shareId = newId();
  const ownerId = await ensureActorUser(db, input.actor);
  const shareSlug = await createUniqueShareSlug(db);

  await db.transaction(async (tx) => {
    await tx.insert(vaults).values({
      id: vaultId,
      title: input.title,
      description: input.description,
      cover: input.cover ?? "",
      visibility: input.visibility,
      collectionEnabled: input.collectionEnabled ?? false,
      ownerId,
    });
    await tx.insert(spaces).values({
      id: spaceId,
      vaultId,
      name: "默认分区",
      description: "default space.",
      icon: "tv",
      position: 0,
    });
    await tx.insert(shares).values({
      id: shareId,
      vaultId,
      visibility:
        input.visibility === "password" ? "private" : input.visibility,
      passwordHash: null,
      token: newToken(),
      slug: shareSlug,
    });
    await recordHistory(tx, {
      actor: input.actor,
      entityType: "vault",
      action: "create",
      entityId: vaultId,
      entityLabel: input.title,
      vaultId,
      details: { defaultSpaceId: spaceId },
    });
  });

  return { id: vaultId, defaultSpaceId: spaceId };
}

async function createUniqueShareSlug(db: Db) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = newShareSlug();
    const [existing] = await db
      .select({ id: shares.id })
      .from(shares)
      .where(eq(shares.slug, slug))
      .limit(1);

    if (!existing) return slug;
  }

  return newToken().replaceAll("-", "").slice(0, 12);
}

export async function updateVault(
  db: Db,
  vaultId: string,
  input: {
    title?: string;
    description?: string;
    cover?: string;
    visibility?: VaultVisibility;
    collectionEnabled?: boolean;
    nsfwEnabled?: boolean;
    actor?: Actor;
    userEmail?: string;
  },
) {
  const existing = await getVaultOrThrow(db, vaultId);
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
    action: "vault:update",
  });

  await updateVaultById(db, vaultId, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.cover !== undefined ? { cover: input.cover } : {}),
    ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    ...(input.collectionEnabled !== undefined
      ? { collectionEnabled: input.collectionEnabled }
      : {}),
    ...(input.nsfwEnabled !== undefined
      ? { nsfwEnabled: input.nsfwEnabled }
      : {}),
    updatedAt: new Date().toISOString(),
  });

  if (input.actor && Object.keys(input).some((key) => key !== "actor" && key !== "userEmail")) {
    await recordHistory(db, {
      actor: input.actor,
      entityType: "vault",
      action: "update",
      entityId: vaultId,
      entityLabel: input.title ?? existing.title,
      vaultId,
      details: { fields: Object.keys(input).filter((key) => key !== "actor" && key !== "userEmail") },
    });
  }

  return { id: vaultId };
}

export async function archiveVault(
  db: Db,
  vaultId: string,
  input: {
    actor?: Actor;
    userEmail?: string;
  },
) {
  const existing = await getVaultOrThrow(db, vaultId);
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
    action: "vault:delete",
  });

  const now = new Date().toISOString();
  await updateVaultById(db, vaultId, { deletedAt: now, updatedAt: now });
  if (input.actor) {
    await recordHistory(db, {
      actor: input.actor,
      entityType: "vault",
      action: "delete",
      entityId: vaultId,
      entityLabel: existing.title,
      vaultId,
    });
  }

  return { id: vaultId, archived: true };
}

export async function exportVault(
  db: Db,
  vaultId: string,
  input: {
    actor: Actor;
  },
): Promise<VaultExportPayload> {
  await getVaultOrThrow(db, vaultId);
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    action: "vault:update",
  });

  const detail = await readVaultDetail(db, vaultId, { actor: input.actor });

  return {
    format: "nexus-vault.v1",
    exportedAt: new Date().toISOString(),
    vault: {
      title: detail.vault.title,
      description: detail.vault.description,
      cover: detail.vault.cover,
      visibility: detail.vault.visibility,
      collectionEnabled: detail.vault.collectionEnabled,
      nsfwEnabled: detail.vault.nsfwEnabled,
    },
    spaces: detail.spaces.map((space) => ({
      id: space.id,
      name: space.name,
      description: space.description,
      icon: space.icon,
      position: space.position,
      createdAt: space.createdAt,
      updatedAt: space.updatedAt,
    })),
    resources: detail.resources.map((resource) => ({
      id: resource.id,
      spaceId: resource.spaceId,
      type: resource.type,
      title: resource.title,
      description: resource.description,
      url: resource.url ?? "",
      referer: resource.referer,
      metadataStatus: resource.metadataStatus,
      position: resource.position,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
      metadata: resource.metadata
        ? {
            provider: resource.metadata.provider,
            status: resource.metadata.data
              ? resource.metadataStatus
              : "pending",
            data: resource.metadata.data,
            errorMessage: resource.metadata.errorMessage,
            updatedAt: resource.metadata.updatedAt ?? undefined,
          }
        : null,
    })),
  };
}

export async function importVault(
  db: Db,
  input: {
    data: VaultExportPayload;
    actor: Actor;
  },
  options: {
    vaultId?: string;
  } = {},
) {
  const ownerId = await ensureActorUser(db, input.actor);
  const now = new Date().toISOString();
  const vaultId = options.vaultId ?? newId();
  const shareId = newId();
  const sortedSpaces = [...input.data.spaces].sort(
    (a, b) => a.position - b.position,
  );
  const fallbackSourceSpaceId = sortedSpaces[0]?.id ?? "default";
  const spaceIdBySourceId = new Map<string, string>();
  const resourceIdBySourceId = new Map<string, string>();
  const importedSpaces =
    sortedSpaces.length > 0
      ? sortedSpaces
      : [
          {
            id: fallbackSourceSpaceId,
            name: "默认分区",
            description: "",
            icon: "tv",
            position: 0,
          },
        ];

  for (const space of importedSpaces) {
    spaceIdBySourceId.set(space.id, newId());
  }

  for (const resource of input.data.resources) {
    resourceIdBySourceId.set(resource.id, newId());
  }

  const slug = await createUniqueShareSlug(db);
  const spaceRows = importedSpaces.map((space) => ({
    id: spaceIdBySourceId.get(space.id)!,
    vaultId,
    name: space.name,
    description: space.description,
    icon: space.icon,
    position: space.position,
    createdAt: space.createdAt ?? now,
    updatedAt: space.updatedAt ?? now,
  }));
  const resourceRows = input.data.resources.map((resource) => {
    const resourceId = resourceIdBySourceId.get(resource.id)!;
    const sourceSpaceId = resource.spaceId ?? fallbackSourceSpaceId;
    const spaceId =
      spaceIdBySourceId.get(sourceSpaceId) ??
      spaceIdBySourceId.get(fallbackSourceSpaceId) ??
      null;

    return {
      id: resourceId,
      vaultId,
      spaceId,
      type: resource.type,
      title: resource.title,
      description: resource.description,
      url: resource.url,
      referer: resource.referer ?? null,
      dedupeKey: getImportResourceDedupeKey(resource.type, resource.url),
      metadataStatus: resource.metadataStatus,
      position: resource.position,
      createdBy: ownerId,
      createdAt: resource.createdAt ?? now,
      updatedAt: resource.updatedAt ?? now,
    };
  });
  const metadataRows = input.data.resources.map((resource) => {
    const resourceId = resourceIdBySourceId.get(resource.id)!;
    const metadata = resource.metadata;

    return {
      resourceId,
      provider: metadata?.provider ?? resource.type,
      status: metadata?.status ?? resource.metadataStatus,
      dataJson: (metadata?.data ?? {}) as Record<string, unknown>,
      errorMessage: metadata?.errorMessage ?? null,
      createdAt: metadata?.createdAt ?? resource.createdAt ?? now,
      updatedAt: metadata?.updatedAt ?? resource.updatedAt ?? now,
    };
  });

  await db.transaction(async (tx) => {
    await tx.insert(vaults).values({
      id: vaultId,
      title: input.data.vault.title,
      description: input.data.vault.description,
      cover: input.data.vault.cover,
      visibility: input.data.vault.visibility,
      collectionEnabled: input.data.vault.collectionEnabled,
      nsfwEnabled: input.data.vault.nsfwEnabled,
      ownerId,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(shares).values({
      id: shareId,
      vaultId,
      visibility:
        input.data.vault.visibility === "password"
          ? "private"
          : input.data.vault.visibility,
      passwordHash: null,
      token: newToken(),
      slug,
      createdAt: now,
      updatedAt: now,
    });

    for (const batch of chunk(spaceRows, IMPORT_INSERT_BATCH_SIZE)) {
      await tx.insert(spaces).values(batch);
    }

    for (const batch of chunk(resourceRows, IMPORT_INSERT_BATCH_SIZE)) {
      await tx.insert(resources).values(batch);
    }

    for (const batch of chunk(metadataRows, IMPORT_INSERT_BATCH_SIZE)) {
      await tx.insert(resourceMetadata).values(batch);
    }
  });

  return {
    id: vaultId,
    importedResources: input.data.resources.length,
    importedSpaces: importedSpaces.length,
  };
}

export async function importVaultFromRequest(
  db: Db,
  request: Request,
  input: {
    actor: Actor;
    vaultId: string;
  },
) {
  const body = await request.json().catch(() => null);
  const parsed = importVaultSchema.safeParse(body);

  if (!parsed.success) {
    throw new Error("Import payload is invalid.");
  }

  return importVault(
    db,
    {
      data: parsed.data.data,
      actor: input.actor,
    },
    {
      vaultId: input.vaultId,
    },
  );
}

function getImportResourceDedupeKey(type: ResourceType, url: string) {
  if (type === "magnet") {
    const magnet = parseMagnetLink(url);
    if (magnet) return `magnet:${magnet.infoHash}`;
  }
  return `url:${url.trim()}`;
}

function chunk<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

export async function getVaultDetail(
  db: Db,
  vaultId: string,
  input: {
    actor?: Actor;
    userEmail?: string;
  },
) {
  await requireVaultRead(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
  });
  const detail = await readVaultSummary(db, vaultId);
  const totalResources = detail.spaces.reduce(
    (total, space) => total + space.resourceCount,
    0,
  );
  const initialPage = totalResources <= VAULT_DETAIL_INLINE_RESOURCE_LIMIT
    ? await listVaultResources(db, vaultId, {
        actor: input.actor,
        limit: VAULT_DETAIL_INLINE_RESOURCE_LIMIT,
        userEmail: input.userEmail,
      })
    : null;
  return {
    ...detail,
    ...(initialPage
      ? { nextResourceCursor: initialPage.nextCursor, resources: initialPage.items }
      : {}),
    actorRole: input.actor
      ? await getVaultRoleForActor(db, vaultId, input.actor)
      : ("anonymous" as const),
  };
}

/**
 * Returns the data required to paint the vault shell. Large resource sets stay
 * behind a cursor-based endpoint so they never block the header, outline, or
 * space list on one oversized response.
 */
export async function readVaultSummary(db: Db, vaultId: string) {
  const vault = await getVaultOrThrow(db, vaultId);
  const [spaceRows, resourceCountRows] = await Promise.all([
    db
      .select({
        id: spaces.id,
        name: spaces.name,
        description: spaces.description,
        icon: spaces.icon,
        position: spaces.position,
        createdAt: spaces.createdAt,
        updatedAt: spaces.updatedAt,
      })
      .from(spaces)
      .where(and(eq(spaces.vaultId, vaultId), isNull(spaces.deletedAt)))
      .orderBy(asc(spaces.position), desc(spaces.createdAt)),
    db
      .select({ spaceId: resources.spaceId, resourceCount: count() })
      .from(resources)
      .where(eq(resources.vaultId, vaultId))
      .groupBy(resources.spaceId),
  ]);
  const resourceCountBySpaceId = new Map(
    resourceCountRows.map((row) => [row.spaceId, row.resourceCount]),
  );

  return {
    vault,
    spaces: spaceRows.map((space) => ({
      ...space,
      resourceCount: resourceCountBySpaceId.get(space.id) ?? 0,
    })),
    resources: [],
  };
}

type ResourcePageCursor = {
  createdAt: string;
  id: string;
  position: number;
  spacePosition: number;
};

type VaultResourcePageInput = {
  cursor?: string;
  limit?: number;
  spaceId?: string;
};

function decodeResourcePageCursor(value?: string) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as ResourcePageCursor;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.createdAt !== "string" ||
      !Number.isInteger(parsed.position) ||
      !Number.isInteger(parsed.spacePosition)
    ) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

function encodeResourcePageCursor(value: ResourcePageCursor) {
  return JSON.stringify(value);
}

async function selectVaultResourcePageRows(
  db: Db,
  vaultId: string,
  input: VaultResourcePageInput,
) {
  const cursor = decodeResourcePageCursor(input.cursor);
  const limit = Math.min(Math.max(input.limit ?? 50, 1), VAULT_DETAIL_INLINE_RESOURCE_LIMIT);
  const cursorCondition = cursor
    ? or(
        gt(spaces.position, cursor.spacePosition),
        and(eq(spaces.position, cursor.spacePosition), gt(resources.position, cursor.position)),
        and(
          eq(spaces.position, cursor.spacePosition),
          eq(resources.position, cursor.position),
          lt(resources.createdAt, cursor.createdAt),
        ),
        and(
          eq(spaces.position, cursor.spacePosition),
          eq(resources.position, cursor.position),
          eq(resources.createdAt, cursor.createdAt),
          gt(resources.id, cursor.id),
        ),
      )
    : undefined;
  return db
    .select({
      id: resources.id,
      spaceId: resources.spaceId,
      spacePosition: spaces.position,
      type: resources.type,
      title: resources.title,
      description: resources.description,
      url: resources.url,
      referer: resources.referer,
      metadataStatus: resources.metadataStatus,
      position: resources.position,
      createdBy: resources.createdBy,
      createdAt: resources.createdAt,
      updatedAt: resources.updatedAt,
      metadataProvider: resourceMetadata.provider,
      metadataDataJson: resourceMetadata.dataJson,
      metadataErrorMessage: resourceMetadata.errorMessage,
      metadataUpdatedAt: resourceMetadata.updatedAt,
    })
    .from(resources)
    .innerJoin(spaces, eq(resources.spaceId, spaces.id))
    .leftJoin(resourceMetadata, eq(resourceMetadata.resourceId, resources.id))
    .where(and(
      eq(resources.vaultId, vaultId),
      input.spaceId ? eq(resources.spaceId, input.spaceId) : undefined,
      cursorCondition,
    ))
    .orderBy(
      asc(spaces.position),
      asc(resources.position),
      desc(resources.createdAt),
      asc(resources.id),
    )
    .limit(limit + 1);
}

type VaultResourcePageRow = Awaited<ReturnType<typeof selectVaultResourcePageRows>>[number];

async function serializeVaultResourceRows(
  db: Db,
  pageRows: VaultResourcePageRow[],
  actor?: Actor,
) {
  const resourceIds = pageRows.map((resource) => resource.id);
  const [starRows, readLaterRows, annotationRows] = actor && resourceIds.length > 0
    ? await Promise.all([
        db.select({ sourceResourceId: starredResources.sourceResourceId }).from(starredResources).where(and(eq(starredResources.userId, actor.id), inArray(starredResources.sourceResourceId, resourceIds))),
        db.select({ resourceId: resourceReadLater.resourceId }).from(resourceReadLater).where(and(eq(resourceReadLater.userId, actor.id), inArray(resourceReadLater.resourceId, resourceIds))),
        db.select({ resourceId: resourceAnnotations.resourceId, rating: resourceAnnotations.rating, comment: resourceAnnotations.comment, checked: resourceAnnotations.checked, dataJson: resourceAnnotations.dataJson, createdAt: resourceAnnotations.createdAt, updatedAt: resourceAnnotations.updatedAt }).from(resourceAnnotations).where(and(eq(resourceAnnotations.userId, actor.id), inArray(resourceAnnotations.resourceId, resourceIds))),
      ])
    : [[], [], []] as const;
  const starredResourceIds = new Set(starRows.map((row) => row.sourceResourceId));
  const readLaterResourceIds = new Set(readLaterRows.map((row) => row.resourceId));
  const annotationByResourceId = new Map(annotationRows.map((row) => [row.resourceId, row]));
  return pageRows.map((resource) => ({
      id: resource.id,
      spaceId: resource.spaceId,
      type: resource.type,
      title: resource.title,
      description: resource.description,
      url: resource.url,
      referer: resource.referer,
      metadataStatus: resource.metadataStatus,
      position: resource.position,
      createdBy: resource.createdBy,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
      isStarred: starredResourceIds.has(resource.id),
      isReadLater: readLaterResourceIds.has(resource.id),
      annotation: annotationByResourceId.get(resource.id) ?? null,
      metadata: resource.metadataProvider
        ? {
            provider: resource.metadataProvider,
            data: normalizeResourceMetadata(resource.metadataDataJson),
            errorMessage: resource.metadataErrorMessage,
            updatedAt: resource.metadataUpdatedAt,
          }
        : null,
    }));
}

function getNextResourcePageCursor(
  rows: VaultResourcePageRow[],
  pageRows: VaultResourcePageRow[],
  limit: number,
) {
  const last = pageRows.at(-1);
  return rows.length > limit && last
    ? encodeResourcePageCursor({
        createdAt: last.createdAt,
        id: last.id,
        position: last.position,
        spacePosition: last.spacePosition,
      })
    : null;
}

/** Lists one vault-wide resource window, or one scoped Space window. */
export async function listVaultResources(
  db: Db,
  vaultId: string,
  input: VaultResourcePageInput & { actor?: Actor; userEmail?: string },
) {
  await requireVaultRead(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
  });

  const limit = Math.min(Math.max(input.limit ?? 50, 1), VAULT_DETAIL_INLINE_RESOURCE_LIMIT);
  const rows = await selectVaultResourcePageRows(db, vaultId, input);
  const pageRows = rows.slice(0, limit);
  return {
    items: await serializeVaultResourceRows(db, pageRows, input.actor),
    nextCursor: getNextResourcePageCursor(rows, pageRows, limit),
  };
}

/**
 * Fetches several independently paginated Spaces through one HTTP request.
 * Resource metadata and user-specific flags are hydrated across the whole
 * batch instead of being queried separately for every Space. The scoped page
 * query is the same production-proven query used by the single-Space endpoint.
 */
export async function listVaultResourceBatch(
  db: Db,
  vaultId: string,
  input: {
    actor?: Actor;
    limit?: number;
    spaces: Array<{ cursor?: string; spaceId: string }>;
    userEmail?: string;
  },
) {
  await requireVaultRead(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
  });
  const requestedSpaces = [...new Map(
    input.spaces
      .filter((space) => Boolean(space.spaceId))
      .slice(0, VAULT_RESOURCE_BATCH_SPACE_LIMIT)
      .map((space) => [space.spaceId, space]),
  ).values()];
  const limit = Math.min(
    Math.max(input.limit ?? VAULT_RESOURCE_BATCH_PAGE_LIMIT, 1),
    VAULT_RESOURCE_BATCH_PAGE_LIMIT,
  );
  const rowsBySpace = await Promise.all(requestedSpaces.map((space) =>
    selectVaultResourcePageRows(db, vaultId, { ...space, limit }),
  ));
  const pageRowsBySpace = rowsBySpace.map((rows) => rows.slice(0, limit));
  const items = await serializeVaultResourceRows(
    db,
    pageRowsBySpace.flat(),
    input.actor,
  );
  const itemById = new Map(items.map((resource) => [resource.id, resource]));

  return {
    pages: requestedSpaces.map((space, index) => {
      const rows = rowsBySpace[index] ?? [];
      const pageRows = pageRowsBySpace[index] ?? [];
      return {
        items: pageRows.flatMap((resource) => {
          const item = itemById.get(resource.id);
          return item ? [item] : [];
        }),
        nextCursor: getNextResourcePageCursor(rows, pageRows, limit),
        spaceId: space.spaceId,
      };
    }),
  };
}

export async function listVaultResourceMetadataStatus(
  db: Db,
  vaultId: string,
  input: {
    actor?: Actor;
    resourceIds?: string[];
    userEmail?: string;
  },
) {
  await requireVaultRead(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
  });

  const uniqueResourceIds = [...new Set(input.resourceIds ?? [])].filter(
    Boolean,
  );
  if (uniqueResourceIds.length === 0) return { items: [] };

  const rows = await db
    .select({
      id: resources.id,
      title: resources.title,
      description: resources.description,
      metadataStatus: resources.metadataStatus,
      metadataProvider: resourceMetadata.provider,
      metadataDataJson: resourceMetadata.dataJson,
      metadataErrorMessage: resourceMetadata.errorMessage,
      metadataUpdatedAt: resourceMetadata.updatedAt,
    })
    .from(resources)
    .leftJoin(resourceMetadata, eq(resourceMetadata.resourceId, resources.id))
    .where(
      and(
        eq(resources.vaultId, vaultId),
        uniqueResourceIds.length > 0
          ? inArray(resources.id, uniqueResourceIds)
          : undefined,
      ),
    );

  return {
    items: rows.map((resource) => ({
      id: resource.id,
      title: resource.title,
      description: resource.description,
      metadataStatus: resource.metadataStatus,
      metadata: resource.metadataProvider
        ? {
            provider: resource.metadataProvider,
            data: normalizeResourceMetadata(resource.metadataDataJson),
            errorMessage: resource.metadataErrorMessage,
            updatedAt: resource.metadataUpdatedAt,
          }
        : null,
    })),
  };
}

export async function readVaultDetail(
  db: Db,
  vaultId: string,
  input: {
    actor?: Actor;
  } = {},
) {
  const vault = await getVaultOrThrow(db, vaultId);

  const spaceRows = await db
    .select({
      id: spaces.id,
      name: spaces.name,
      description: spaces.description,
      icon: spaces.icon,
      position: spaces.position,
      createdAt: spaces.createdAt,
      updatedAt: spaces.updatedAt,
    })
    .from(spaces)
    .where(and(eq(spaces.vaultId, vaultId), isNull(spaces.deletedAt)))
    .orderBy(asc(spaces.position), desc(spaces.createdAt));
  const resourceCountRows = await db
    .select({ spaceId: resources.spaceId, resourceCount: count() })
    .from(resources)
    .where(eq(resources.vaultId, vaultId))
    .groupBy(resources.spaceId);
  const resourceCountBySpaceId = new Map(
    resourceCountRows.map((row) => [row.spaceId, row.resourceCount]),
  );

  const resourceRows = await db
    .select({
      id: resources.id,
      spaceId: resources.spaceId,
      type: resources.type,
      title: resources.title,
      description: resources.description,
      url: resources.url,
      referer: resources.referer,
      metadataStatus: resources.metadataStatus,
      position: resources.position,
      createdBy: resources.createdBy,
      createdAt: resources.createdAt,
      updatedAt: resources.updatedAt,
      metadataProvider: resourceMetadata.provider,
      metadataDataJson: resourceMetadata.dataJson,
      metadataErrorMessage: resourceMetadata.errorMessage,
      metadataUpdatedAt: resourceMetadata.updatedAt,
    })
    .from(resources)
    .leftJoin(resourceMetadata, eq(resourceMetadata.resourceId, resources.id))
    .where(eq(resources.vaultId, vaultId))
    .orderBy(
      asc(resources.spaceId),
      asc(resources.position),
      desc(resources.createdAt),
    );

  const resourceIds = resourceRows.map((resource) => resource.id);
  const starredResourceIds = new Set(
    input.actor && resourceIds.length > 0
      ? (
          await db
            .select({ sourceResourceId: starredResources.sourceResourceId })
            .from(starredResources)
            .where(
              and(
                eq(starredResources.userId, input.actor.id),
                inArray(starredResources.sourceResourceId, resourceIds),
              ),
            )
        ).map((item) => item.sourceResourceId)
      : [],
  );
  const readLaterResourceIds = new Set(
    input.actor && resourceIds.length > 0
      ? (
          await db
            .select({ resourceId: resourceReadLater.resourceId })
            .from(resourceReadLater)
            .where(
              and(
                eq(resourceReadLater.userId, input.actor.id),
                inArray(resourceReadLater.resourceId, resourceIds),
              ),
            )
        ).map((item) => item.resourceId)
      : [],
  );
  const annotationByResourceId = new Map(
    input.actor && resourceIds.length > 0
      ? (
          await db
            .select({
              resourceId: resourceAnnotations.resourceId,
              rating: resourceAnnotations.rating,
              comment: resourceAnnotations.comment,
              checked: resourceAnnotations.checked,
              dataJson: resourceAnnotations.dataJson,
              createdAt: resourceAnnotations.createdAt,
              updatedAt: resourceAnnotations.updatedAt,
            })
            .from(resourceAnnotations)
            .where(
              and(
                eq(resourceAnnotations.userId, input.actor.id),
                inArray(resourceAnnotations.resourceId, resourceIds),
              ),
            )
        ).map((item) => [item.resourceId, item] as const)
      : [],
  );

  return {
    vault,
    spaces: spaceRows.map((space) => ({
      ...space,
      resourceCount: resourceCountBySpaceId.get(space.id) ?? 0,
    })),
    resources: resourceRows.map((resource) => ({
      id: resource.id,
      spaceId: resource.spaceId,
      type: resource.type,
      title: resource.title,
      description: resource.description,
      url: resource.url,
      referer: resource.referer,
      metadataStatus: resource.metadataStatus,
      position: resource.position,
      createdBy: resource.createdBy,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
      isStarred: starredResourceIds.has(resource.id),
      isReadLater: readLaterResourceIds.has(resource.id),
      annotation: annotationByResourceId.get(resource.id) ?? null,
      metadata: resource.metadataProvider
        ? {
            provider: resource.metadataProvider,
            data: normalizeResourceMetadata(resource.metadataDataJson),
            errorMessage: resource.metadataErrorMessage,
            updatedAt: resource.metadataUpdatedAt,
          }
        : null,
    })),
  };
}

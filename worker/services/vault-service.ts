import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
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

type VaultVisibility = "public" | "private" | "password";
const IMPORT_INSERT_BATCH_SIZE = 100;

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
  const resourceCountByVaultId = new Map(
    resourceCountRows.map((row) => [row.vaultId, row.resourceCount]),
  );

  return rows.map((vault) => ({
    ...vault,
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
  const resourceCountByVaultId = new Map(
    resourceCounts.map((row) => [row.vaultId, row.resourceCount]),
  );

  return rows.map((vault) => ({
    ...vault,
    resourceCount: resourceCountByVaultId.get(vault.id) ?? 0,
  }));
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
  await getVaultOrThrow(db, vaultId);
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
  await getVaultOrThrow(db, vaultId);
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
    action: "vault:delete",
  });

  const now = new Date().toISOString();
  await updateVaultById(db, vaultId, { deletedAt: now, updatedAt: now });

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
  const detail = await readVaultDetail(db, vaultId, { actor: input.actor });
  return {
    ...detail,
    actorRole: input.actor
      ? await getVaultRoleForActor(db, vaultId, input.actor)
      : ("anonymous" as const),
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
    spaces: spaceRows,
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

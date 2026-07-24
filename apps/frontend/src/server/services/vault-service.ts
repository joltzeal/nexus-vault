import { and, asc, count, desc, eq, inArray, isNull, like, or } from "drizzle-orm"

import {
  collaborators,
  comments,
  resourceMetadata,
  resources,
  shares,
  spaces,
  starredResources,
  users,
  vaults,
} from "@nexus-vault/db/schema"
import { parseResourceMetadataJson } from "@nexus-vault/shared/resource-metadata"
import { parseMagnetLink, type ResourceType } from "@nexus-vault/shared/resource-input"
import { notFound } from "@/server/api/errors"
import type { Actor, Db } from "@/server/api/types"
import type { VaultExportPayload } from "@/server/schemas/vault"
import { ensureActorUser } from "@/server/services/user-service"
import {
  getVaultRoleForActor,
  requireVaultPermission,
  requireVaultRead,
} from "@/server/services/permission-service"
import { newId, newShareSlug, newToken } from "@/server/utils/id"

type VaultVisibility = "public" | "private" | "password"

export async function getVaultOrThrow(db: Db, vaultId: string) {
  const [vault] = await db
    .select({
      id: vaults.id,
      title: vaults.title,
      description: vaults.description,
      cover: vaults.cover,
      ownerName: users.name,
      visibility: vaults.visibility,
      collectionEnabled: vaults.collectionEnabled,
      nsfwEnabled: vaults.nsfwEnabled,
      ownerId: vaults.ownerId,
      starCount: vaults.starCount,
      forkCount: vaults.forkCount,
      forkedFromVaultId: vaults.forkedFromVaultId,
      createdAt: vaults.createdAt,
      updatedAt: vaults.updatedAt,
    })
    .from(vaults)
    .leftJoin(users, eq(vaults.ownerId, users.id))
    .where(and(eq(vaults.id, vaultId), isNull(vaults.deletedAt)))
    .limit(1)

  if (!vault) throw notFound("Vault not found.")
  return vault
}

export async function listVaults(
  db: Db,
  input: {
    query?: string
    actor: Actor
  }
) {
  const editorVaultIds = await listEditorVaultIdsForActor(db, input.actor)
  const accessFilter =
    editorVaultIds.length > 0
      ? or(eq(vaults.ownerId, input.actor.id), inArray(vaults.id, editorVaultIds))
      : eq(vaults.ownerId, input.actor.id)

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
        accessFilter,
        input.query
          ? or(
              like(vaults.title, `%${input.query}%`),
              like(vaults.description, `%${input.query}%`)
            )
          : undefined
      )
    )
    .orderBy(desc(vaults.createdAt))
    .limit(50)

  const vaultIds = rows.map((vault) => vault.id)
  if (vaultIds.length === 0) return rows.map((vault) => ({ ...vault, resourceCount: 0 }))

  const resourceCountRows = await db
    .select({
      vaultId: resources.vaultId,
      resourceCount: count(),
    })
    .from(resources)
    .where(and(inArray(resources.vaultId, vaultIds), isNull(resources.deletedAt)))
    .groupBy(resources.vaultId)
  const resourceCountByVaultId = new Map(
    resourceCountRows.map((row) => [row.vaultId, row.resourceCount])
  )

  return rows.map((vault) => ({
    ...vault,
    resourceCount: resourceCountByVaultId.get(vault.id) ?? 0,
  }))
}

async function listEditorVaultIdsForActor(db: Db, actor: Actor) {
  const rows = await db
    .select({ vaultId: collaborators.vaultId })
    .from(collaborators)
    .innerJoin(users, eq(collaborators.userId, users.id))
    .where(
      and(
        eq(collaborators.role, "editor"),
        or(eq(collaborators.userId, actor.id), eq(users.email, actor.email))
      )
    )
    .limit(100)

  return rows.map((row) => row.vaultId)
}

export async function createVault(
  db: Db,
  input: {
    title: string
    description: string
    cover?: string
    visibility: VaultVisibility
    collectionEnabled?: boolean
    actor: Actor
  }
) {
  const vaultId = newId()
  const spaceId = newId()
  const shareId = newId()
  const ownerId = await ensureActorUser(db, input.actor)

  await db.batch([
    db.insert(vaults).values({
      id: vaultId,
      title: input.title,
      description: input.description,
      cover: input.cover ?? "",
      visibility: input.visibility,
      collectionEnabled: input.collectionEnabled ?? false,
      ownerId,
    }),
    db.insert(spaces).values({
      id: spaceId,
      vaultId,
      name: "默认分区",
      description: "V1 default single-level space.",
      icon: "tv",
      position: 0,
    }),
    db.insert(shares).values({
      id: shareId,
      vaultId,
      visibility: input.visibility === "password" ? "private" : input.visibility,
      passwordHash: null,
      token: newToken(),
      slug: await createUniqueShareSlug(db),
    }),
  ])

  return { id: vaultId, defaultSpaceId: spaceId }
}

async function createUniqueShareSlug(db: Db) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = newShareSlug()
    const [existing] = await db
      .select({ id: shares.id })
      .from(shares)
      .where(eq(shares.slug, slug))
      .limit(1)

    if (!existing) return slug
  }

  return newToken().replaceAll("-", "").slice(0, 12)
}

export async function updateVault(
  db: Db,
  vaultId: string,
  input: {
    title?: string
    description?: string
    cover?: string
    visibility?: VaultVisibility
    collectionEnabled?: boolean
    nsfwEnabled?: boolean
    actor?: Actor
    userEmail?: string
  }
) {
  await getVaultOrThrow(db, vaultId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
    action: "vault:update",
  })

  await db
    .update(vaults)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.cover !== undefined ? { cover: input.cover } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      ...(input.collectionEnabled !== undefined
        ? { collectionEnabled: input.collectionEnabled }
        : {}),
      ...(input.nsfwEnabled !== undefined ? { nsfwEnabled: input.nsfwEnabled } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(vaults.id, vaultId), isNull(vaults.deletedAt)))

  return { id: vaultId }
}

export async function archiveVault(
  db: Db,
  vaultId: string,
  input: {
    actor?: Actor
    userEmail?: string
  }
) {
  await getVaultOrThrow(db, vaultId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
    action: "vault:delete",
  })

  const now = new Date().toISOString()
  await db
    .update(vaults)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(vaults.id, vaultId), isNull(vaults.deletedAt)))

  return { id: vaultId, archived: true }
}

export async function exportVault(
  db: Db,
  vaultId: string,
  input: {
    actor: Actor
  }
): Promise<VaultExportPayload> {
  await getVaultOrThrow(db, vaultId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    action: "vault:update",
  })

  const detail = await readVaultDetail(db, vaultId, { actor: input.actor })

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
      url: resource.url,
      metadataStatus: resource.metadataStatus,
      position: resource.position,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
      metadata: resource.metadata
        ? {
            provider: resource.metadata.provider,
            status: resource.metadata.data ? resource.metadataStatus : "pending",
            data: resource.metadata.data,
            errorMessage: resource.metadata.errorMessage,
            updatedAt: resource.metadata.updatedAt ?? undefined,
          }
        : null,
      comments: (resource.comments ?? [])
        .filter((comment) => !comment.deletedAt)
        .map((comment) => ({
          id: comment.id,
          parentId: comment.parentId,
          authorName: comment.authorName,
          body: comment.body,
          createdAt: comment.createdAt,
        })),
    })),
  }
}

export async function importVault(
  db: Db,
  input: {
    data: VaultExportPayload
    actor: Actor
  }
) {
  const ownerId = await ensureActorUser(db, input.actor)
  const now = new Date().toISOString()
  const vaultId = newId()
  const shareId = newId()
  const sortedSpaces = [...input.data.spaces].sort((a, b) => a.position - b.position)
  const fallbackSourceSpaceId = sortedSpaces[0]?.id ?? "default"
  const spaceIdBySourceId = new Map<string, string>()
  const resourceIdBySourceId = new Map<string, string>()
  const commentIdBySourceId = new Map<string, string>()

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
        ]

  for (const space of importedSpaces) {
    spaceIdBySourceId.set(space.id, newId())
  }

  for (const resource of input.data.resources) {
    resourceIdBySourceId.set(resource.id, newId())
    for (const comment of resource.comments ?? []) {
      commentIdBySourceId.set(comment.id, newId())
    }
  }

  await db.insert(vaults).values({
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
  })

  await db.insert(shares).values({
    id: shareId,
    vaultId,
    visibility:
      input.data.vault.visibility === "password" ? "private" : input.data.vault.visibility,
    passwordHash: null,
    token: newToken(),
    slug: await createUniqueShareSlug(db),
    createdAt: now,
    updatedAt: now,
  })

  for (const space of importedSpaces) {
    await db.insert(spaces).values({
      id: spaceIdBySourceId.get(space.id)!,
      vaultId,
      name: space.name,
      description: space.description,
      icon: space.icon,
      position: space.position,
      createdAt: space.createdAt ?? now,
      updatedAt: space.updatedAt ?? now,
    })
  }

  for (const resource of input.data.resources) {
    const resourceId = resourceIdBySourceId.get(resource.id)!
    const sourceSpaceId = resource.spaceId ?? fallbackSourceSpaceId
    const spaceId =
      spaceIdBySourceId.get(sourceSpaceId) ??
      spaceIdBySourceId.get(fallbackSourceSpaceId) ??
      null
    const metadata = resource.metadata

    await db.insert(resources).values({
      id: resourceId,
      vaultId,
      spaceId,
      type: resource.type,
      title: resource.title,
      description: resource.description,
      url: resource.url,
      dedupeKey: getImportResourceDedupeKey(resource.type, resource.url),
      metadataStatus: resource.metadataStatus,
      position: resource.position,
      createdBy: ownerId,
      createdAt: resource.createdAt ?? now,
      updatedAt: resource.updatedAt ?? now,
    })

    await db.insert(resourceMetadata).values({
      resourceId,
      provider: metadata?.provider ?? resource.type,
      status: metadata?.status ?? resource.metadataStatus,
      dataJson: JSON.stringify(metadata?.data ?? {}),
      errorMessage: metadata?.errorMessage ?? null,
      createdAt: metadata?.createdAt ?? resource.createdAt ?? now,
      updatedAt: metadata?.updatedAt ?? resource.updatedAt ?? now,
    })

    for (const comment of resource.comments ?? []) {
      await db.insert(comments).values({
        id: commentIdBySourceId.get(comment.id)!,
        vaultId,
        resourceId,
        parentId: comment.parentId ? commentIdBySourceId.get(comment.parentId) ?? null : null,
        authorId: null,
        authorName: comment.authorName,
        body: comment.body,
        createdAt: comment.createdAt ?? now,
        updatedAt: comment.updatedAt ?? comment.createdAt ?? now,
      })
    }
  }

  return {
    id: vaultId,
    importedResources: input.data.resources.length,
    importedSpaces: importedSpaces.length,
  }
}

function getImportResourceDedupeKey(type: ResourceType, url: string) {
  if (type === "magnet") {
    const magnet = parseMagnetLink(url)
    if (magnet) return `magnet:${magnet.infoHash}`
  }
  return `url:${url.trim()}`
}

export async function getVaultDetail(
  db: Db,
  vaultId: string,
  input: {
    actor?: Actor
    userEmail?: string
  }
) {
  await requireVaultRead(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
  })
  const detail = await readVaultDetail(db, vaultId, { actor: input.actor })
  return {
    ...detail,
    actorRole: input.actor
      ? await getVaultRoleForActor(db, vaultId, input.actor)
      : ("anonymous" as const),
  }
}

export async function readVaultDetail(
  db: Db,
  vaultId: string,
  input: {
    actor?: Actor
  } = {}
) {
  const vault = await getVaultOrThrow(db, vaultId)

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

  const resourceRows = await db
    .select({
      id: resources.id,
      spaceId: resources.spaceId,
      type: resources.type,
      title: resources.title,
      description: resources.description,
      url: resources.url,
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
    .where(and(eq(resources.vaultId, vaultId), isNull(resources.deletedAt)))
    .orderBy(asc(resources.spaceId), asc(resources.position), desc(resources.createdAt))

  const commentRows = await db
    .select({
      id: comments.id,
      resourceId: comments.resourceId,
      parentId: comments.parentId,
      authorName: comments.authorName,
      body: comments.body,
      createdAt: comments.createdAt,
      deletedAt: comments.deletedAt,
    })
    .from(comments)
    .where(eq(comments.vaultId, vaultId))
    .orderBy(desc(comments.createdAt))
  const commentsByResourceId = new Map<string, typeof commentRows>()
  for (const comment of commentRows) {
    commentsByResourceId.set(comment.resourceId, [
      ...(commentsByResourceId.get(comment.resourceId) ?? []),
      comment,
    ])
  }

  const starredResourceIds = new Set(
    input.actor
      ? (
          await db
            .select({ sourceResourceId: starredResources.sourceResourceId })
            .from(starredResources)
            .where(eq(starredResources.userId, input.actor.id))
        ).map((item) => item.sourceResourceId)
      : []
  )

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
      metadataStatus: resource.metadataStatus,
      position: resource.position,
      createdBy: resource.createdBy,
      createdAt: resource.createdAt,
      updatedAt: resource.updatedAt,
      comments: commentsByResourceId.get(resource.id) ?? [],
      isStarred: starredResourceIds.has(resource.id),
      metadata: resource.metadataProvider
        ? {
            provider: resource.metadataProvider,
            data: parseResourceMetadataJson(resource.metadataDataJson),
            errorMessage: resource.metadataErrorMessage,
            updatedAt: resource.metadataUpdatedAt,
          }
        : null,
    })),
  }
}

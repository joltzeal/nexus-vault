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
import { notFound } from "@/server/api/errors"
import type { Actor, Db } from "@/server/api/types"
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
  const vaultId = newId("vault")
  const spaceId = newId("space")
  const shareId = newId("share")
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

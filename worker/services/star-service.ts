import { and, desc, eq, isNull, or, sql } from "drizzle-orm"

import {
  resourceMetadata,
  resourceReadLater,
  resources,
  collaborators,
  spaces,
  starredResources,
  users,
  vaultStars,
  vaults,
} from "../db/schema"
import type { Actor, Db } from "../types/legacy-api"
import { requireVaultRead } from "./permission-service"
import { requireResourceReadPermission } from "./resource-service"
import { ensureActorUser } from "./user-service"
import { getVaultOrThrow } from "./vault-service"
import { getResourceOrThrow } from "./resource-service"
import { newId } from "../lib/id"

export async function listStarredVaults(
  db: Db,
  input: {
    actor: Actor
  }
) {
  const rows = await db
    .select({
      id: vaults.id,
      title: vaults.title,
      description: vaults.description,
      visibility: vaults.visibility,
      starCount: vaults.starCount,
      forkCount: vaults.forkCount,
      createdAt: vaults.createdAt,
      updatedAt: vaults.updatedAt,
    })
    .from(vaultStars)
    .innerJoin(vaults, eq(vaultStars.vaultId, vaults.id))
    .innerJoin(users, eq(vaultStars.userId, users.id))
    .where(and(orActor(input.actor), isNull(vaults.deletedAt)))
    .orderBy(desc(vaultStars.createdAt))
    .limit(50)

  return rows
}

export async function starVault(
  db: Db,
  vaultId: string,
  input: {
    actor: Actor
  }
) {
  await getVaultOrThrow(db, vaultId)
  await requireVaultRead(db, {
    vaultId,
    actor: input.actor,
  })

  const userId = await ensureActorUser(db, input.actor)

  const [existing] = await db
    .select({ id: vaultStars.id })
    .from(vaultStars)
    .where(and(eq(vaultStars.vaultId, vaultId), eq(vaultStars.userId, userId)))
    .limit(1)

  if (!existing) {
    await db.transaction(async (tx) => {
      await tx.insert(vaultStars).values({
        id: newId(),
        vaultId,
        userId,
      })
      await tx
        .update(vaults)
        .set({ starCount: sql`${vaults.starCount} + 1` })
        .where(eq(vaults.id, vaultId))
    })
  }

  return { starred: true }
}

export async function unstarVault(
  db: Db,
  vaultId: string,
  input: {
    actor: Actor
  }
) {
  await getVaultOrThrow(db, vaultId)
  await requireVaultRead(db, {
    vaultId,
    actor: input.actor,
  })

  const userId = await ensureActorUser(db, input.actor)

  const [existing] = await db
    .select({ id: vaultStars.id })
    .from(vaultStars)
    .where(and(eq(vaultStars.vaultId, vaultId), eq(vaultStars.userId, userId)))
    .limit(1)

  if (existing) {
    await db.transaction(async (tx) => {
      await tx.delete(vaultStars).where(eq(vaultStars.id, existing.id))
      await tx
        .update(vaults)
        .set({ starCount: sql`GREATEST(${vaults.starCount} - 1, 0)` })
        .where(eq(vaults.id, vaultId))
    })
  }

  return { starred: false }
}

export async function starResource(
  db: Db,
  resourceId: string,
  input: {
    actor: Actor
  }
) {
  const resource = await getResourceOrThrow(db, resourceId)
  await requireResourceReadPermission(db, resource, input.actor)

  const userId = await ensureActorUser(db, input.actor)
  const [existing] = await db
    .select({ id: starredResources.id })
    .from(starredResources)
    .where(
      and(
        eq(starredResources.userId, userId),
        eq(starredResources.sourceResourceId, resourceId)
      )
    )
    .limit(1)

  if (!existing) {
    const metadata = await db
      .select({
        provider: resourceMetadata.provider,
        dataJson: resourceMetadata.dataJson,
        errorMessage: resourceMetadata.errorMessage,
      })
      .from(resourceMetadata)
      .where(eq(resourceMetadata.resourceId, resourceId))
      .limit(1)
      .then((rows) => rows[0])

    await db.insert(starredResources).values({
      id: newId(),
      userId,
      sourceResourceId: resource.id,
      type: resource.type,
      title: resource.title,
      description: resource.description,
      url: resource.url,
      metadataStatus: resource.metadataStatus,
      metadataProvider: metadata?.provider,
      metadataDataJson: metadata?.dataJson ?? {},
      metadataErrorMessage: metadata?.errorMessage,
      sourceCreatedAt: resource.createdAt,
    })
  }

  return { starred: true }
}

export async function unstarResource(
  db: Db,
  resourceId: string,
  input: {
    actor: Actor
  }
) {
  const userId = await ensureActorUser(db, input.actor)
  await db
    .delete(starredResources)
    .where(
      and(
        eq(starredResources.userId, userId),
        eq(starredResources.sourceResourceId, resourceId)
      )
    )

  return { starred: false }
}

export async function listStarredResources(
  db: Db,
  input: {
    actor: Actor
  }
) {
  const userId = await ensureActorUser(db, input.actor)

  const rows = await db
    .select({
      id: starredResources.id,
      sourceResourceId: resources.id,
      sourceVaultId: resources.vaultId,
      sourceSpaceId: resources.spaceId,
      sourceVaultTitle: vaults.title,
      sourceSpaceName: spaces.name,
      type: resources.type,
      title: resources.title,
      description: resources.description,
      url: resources.url,
      referer: resources.referer,
      metadataStatus: resources.metadataStatus,
      metadataProvider: resourceMetadata.provider,
      metadataDataJson: resourceMetadata.dataJson,
      metadataErrorMessage: resourceMetadata.errorMessage,
      metadataUpdatedAt: resourceMetadata.updatedAt,
      position: resources.position,
      resourceUpdatedAt: resources.updatedAt,
      sourceCreatedAt: resources.createdAt,
      isReadLater: resourceReadLater.id,
      createdAt: starredResources.createdAt,
    })
    .from(starredResources)
    .innerJoin(resources, eq(starredResources.sourceResourceId, resources.id))
    .leftJoin(vaults, eq(resources.vaultId, vaults.id))
    .leftJoin(collaborators, and(eq(collaborators.vaultId, vaults.id), eq(collaborators.userId, userId)))
    .leftJoin(spaces, eq(resources.spaceId, spaces.id))
    .leftJoin(resourceMetadata, eq(resourceMetadata.resourceId, resources.id))
    .leftJoin(
      resourceReadLater,
      and(
        eq(resourceReadLater.resourceId, resources.id),
        eq(resourceReadLater.userId, userId),
      ),
    )
    .where(and(
      eq(starredResources.userId, userId),
      isNull(vaults.deletedAt),
      or(
        eq(resources.stashUserId, userId),
        eq(vaults.ownerId, userId),
        eq(vaults.visibility, "public"),
        eq(collaborators.userId, userId),
      ),
    ))
    .orderBy(desc(starredResources.createdAt))
    .limit(100)

  return rows.map((row) => ({
    ...row,
    sourceVaultId: row.sourceVaultId ?? "flash-stash",
    sourceVaultTitle: row.sourceVaultTitle ?? "Flash stash",
    sourceSpaceName: row.sourceSpaceName ?? "Unsorted",
    isReadLater: Boolean(row.isReadLater),
  }))
}

function orActor(actor: Actor) {
  return or(eq(users.id, actor.id), eq(users.email, actor.email))
}

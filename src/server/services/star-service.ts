import { and, desc, eq, isNull, or, sql } from "drizzle-orm"

import {
  resourceMetadata,
  starredResources,
  users,
  vaultStars,
  vaults,
} from "@/db/schema"
import type { Actor, Db } from "@/server/api/types"
import { requireVaultRead } from "@/server/services/permission-service"
import { ensureActorUser } from "@/server/services/user-service"
import { getVaultOrThrow } from "@/server/services/vault-service"
import { getResourceOrThrow } from "@/server/services/resource-service"
import { newId } from "@/server/utils/id"

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
  await requireVaultRead(db, {
    vaultId: resource.vaultId,
    actor: input.actor,
  })

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

  return db
    .select({
      id: starredResources.id,
      sourceResourceId: starredResources.sourceResourceId,
      type: starredResources.type,
      title: starredResources.title,
      description: starredResources.description,
      url: starredResources.url,
      metadataStatus: starredResources.metadataStatus,
      metadataProvider: starredResources.metadataProvider,
      metadataDataJson: starredResources.metadataDataJson,
      metadataErrorMessage: starredResources.metadataErrorMessage,
      sourceCreatedAt: starredResources.sourceCreatedAt,
      createdAt: starredResources.createdAt,
    })
    .from(starredResources)
    .where(eq(starredResources.userId, userId))
    .orderBy(desc(starredResources.createdAt))
    .limit(100)
}

function orActor(actor: Actor) {
  return or(eq(users.id, actor.id), eq(users.email, actor.email))
}

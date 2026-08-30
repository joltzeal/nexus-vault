import { and, eq, inArray, isNull, sql } from "drizzle-orm"

import { forks, resourceMetadata, resources, spaces, vaults } from "../db/schema"
import { conflict } from "../lib/errors"
import type { Actor, Db } from "../types/legacy-api"
import { requireVaultRead } from "./permission-service"
import { ensureActorUser } from "./user-service"
import { getVaultOrThrow } from "./vault-service"
import { newId } from "../lib/id"

export async function forkVault(
  db: Db,
  sourceVaultId: string,
  input: {
    actor: Actor
    userEmail?: string
  }
) {
  const sourceVault = await getVaultOrThrow(db, sourceVaultId)
  await requireVaultRead(db, {
    vaultId: sourceVaultId,
    actor: input.actor,
    userEmail: input.userEmail,
  })
  const ownerId = await ensureActorUser(db, input.actor)
  if (sourceVault.ownerId === ownerId) {
    throw conflict("不能 fork 自己的 vault。")
  }

  const sourceSpaces = await db
    .select({
      id: spaces.id,
      name: spaces.name,
      description: spaces.description,
      position: spaces.position,
    })
    .from(spaces)
    .where(and(eq(spaces.vaultId, sourceVaultId), isNull(spaces.deletedAt)))

  const sourceResources = await db
    .select({
      id: resources.id,
      spaceId: resources.spaceId,
      type: resources.type,
      title: resources.title,
      description: resources.description,
      url: resources.url,
      referer: resources.referer,
      dedupeKey: resources.dedupeKey,
      metadataStatus: resources.metadataStatus,
      position: resources.position,
    })
    .from(resources)
    .where(eq(resources.vaultId, sourceVaultId))

  const sourceMetadata =
    sourceResources.length > 0
      ? await db
          .select({
            resourceId: resourceMetadata.resourceId,
            provider: resourceMetadata.provider,
            status: resourceMetadata.status,
            dataJson: resourceMetadata.dataJson,
            errorMessage: resourceMetadata.errorMessage,
          })
          .from(resourceMetadata)
          .where(
            inArray(
              resourceMetadata.resourceId,
              sourceResources.map((resource) => resource.id)
            )
          )
      : []

  const targetVaultId = newId()
  const forkId = newId()
  const spaceIdMap = new Map<string, string>()
  const resourceIdMap = new Map<string, string>()

  const newSpaces = sourceSpaces.map((space, index) => {
    const nextSpaceId = newId()
    spaceIdMap.set(space.id, nextSpaceId)

    return {
      id: nextSpaceId,
      vaultId: targetVaultId,
      name: space.name,
      description: space.description,
      position: index,
    }
  })

  const newResources = sourceResources.map((resource) => {
    const nextResourceId = newId()
    resourceIdMap.set(resource.id, nextResourceId)

    return {
      id: nextResourceId,
      vaultId: targetVaultId,
      spaceId: resource.spaceId ? (spaceIdMap.get(resource.spaceId) ?? null) : null,
      type: resource.type,
      title: resource.title,
      description: resource.description,
      url: resource.url,
      referer: resource.referer,
      dedupeKey: resource.dedupeKey,
      metadataStatus: resource.metadataStatus,
      position: resource.position,
      createdBy: ownerId,
    }
  })

  const newMetadata = sourceMetadata
    .map((metadata) => {
      const nextResourceId = resourceIdMap.get(metadata.resourceId)
      if (!nextResourceId) return null

      return {
        resourceId: nextResourceId,
        provider: metadata.provider,
        status: metadata.status,
        dataJson: metadata.dataJson,
        errorMessage: metadata.errorMessage,
      }
    })
    .filter((metadata): metadata is NonNullable<typeof metadata> => Boolean(metadata))

  await db.transaction(async (tx) => {
    await tx.insert(vaults).values({
      id: targetVaultId,
      title: sourceVault.title,
      description: sourceVault.description,
      cover: sourceVault.cover,
      visibility: "private",
      forkedFromVaultId: sourceVaultId,
      ownerId,
    })
    for (const space of newSpaces) {
      await tx.insert(spaces).values(space)
    }
    for (const resource of newResources) {
      await tx.insert(resources).values(resource)
    }
    for (const metadata of newMetadata) {
      await tx.insert(resourceMetadata).values(metadata)
    }
    await tx.insert(forks).values({
      id: forkId,
      sourceVaultId,
      targetVaultId,
      createdBy: ownerId,
    })
    await tx
      .update(vaults)
      .set({ forkCount: sql`${vaults.forkCount} + 1` })
      .where(eq(vaults.id, sourceVaultId))
  })

  return { id: targetVaultId, forkId }
}

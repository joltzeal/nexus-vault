import { and, eq, inArray, isNull, sql } from "drizzle-orm"

import { forks, resourceMetadata, resources, spaces, vaults } from "@nexus-vault/db/schema"
import { conflict } from "@/server/api/errors"
import type { Actor, Db } from "@/server/api/types"
import { requireVaultRead } from "@/server/services/permission-service"
import { ensureActorUser } from "@/server/services/user-service"
import { getVaultOrThrow } from "@/server/services/vault-service"
import { newId } from "@/server/utils/id"

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
      metadataStatus: resources.metadataStatus,
      position: resources.position,
    })
    .from(resources)
    .where(and(eq(resources.vaultId, sourceVaultId), isNull(resources.deletedAt)))

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

  const targetVaultId = newId("vault")
  const forkId = newId("fork")
  const spaceIdMap = new Map<string, string>()
  const resourceIdMap = new Map<string, string>()

  const newSpaces = sourceSpaces.map((space, index) => {
    const nextSpaceId = newId("space")
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
    const nextResourceId = newId("resource")
    resourceIdMap.set(resource.id, nextResourceId)

    return {
      id: nextResourceId,
      vaultId: targetVaultId,
      spaceId: resource.spaceId ? (spaceIdMap.get(resource.spaceId) ?? null) : null,
      type: resource.type,
      title: resource.title,
      description: resource.description,
      url: resource.url,
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

  await db.batch([
    db.insert(vaults).values({
      id: targetVaultId,
      title: sourceVault.title,
      description: sourceVault.description,
      cover: sourceVault.cover,
      visibility: "private",
      forkedFromVaultId: sourceVaultId,
      ownerId,
    }),
    ...newSpaces.map((space) => db.insert(spaces).values(space)),
    ...newResources.map((resource) => db.insert(resources).values(resource)),
    ...newMetadata.map((metadata) => db.insert(resourceMetadata).values(metadata)),
    db.insert(forks).values({
      id: forkId,
      sourceVaultId,
      targetVaultId,
      createdBy: ownerId,
    }),
    db
      .update(vaults)
      .set({ forkCount: sql`${vaults.forkCount} + 1` })
      .where(eq(vaults.id, sourceVaultId)),
  ])

  return { id: targetVaultId, forkId }
}

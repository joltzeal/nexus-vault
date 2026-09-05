import { and, eq, inArray, isNull } from "drizzle-orm"

import { resourceMetadata, resources, spaces, vaults } from "../db/schema"
import {
  getLocalMediaObjectKeys,
  LOCAL_MEDIA_PROVIDER,
} from "../domain/media-storage"
import {
  parseMagnetLink,
  parseResourceInput,
  type ResourceType,
} from "../domain/resources/input"
import { createMetadataQueueMessage } from "../metadata/index"
import { conflict, forbidden, notFound } from "../lib/errors"
import type { Actor, Db } from "../types/legacy-api"
import {
  getVaultRoleForActor,
  requireVaultPermission,
  requireVaultRead,
} from "./permission-service"
import { getDefaultSpaceId, getSpaceInVaultOrThrow } from "./space-service"
import { ensureActorUser } from "./user-service"
import { getVaultOrThrow } from "./vault-service"
import { newId } from "../lib/id"
import {
  countResourcesInSpace,
  findResourceById,
  findResourceMetadata,
  findResourceIdByDedupeKey,
} from "../repositories/resource.repository"
import { requireUserXComCookieString } from "./account-integration-service"

export async function createResource(
  db: Db,
  vaultId: string,
  input: {
    spaceId?: string
    type?: ResourceType
    title?: string
    description: string
    extractionCode?: string
    url: string
    referer?: string
    actor: Actor
    userEmail?: string
  }
) {
  await getVaultOrThrow(db, vaultId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
    action: "resource:create",
  })
  const createdBy = await ensureActorUser(db, input.actor)

  const spaceId = input.spaceId
    ? (await getSpaceInVaultOrThrow(db, vaultId, input.spaceId)).id
    : await getDefaultSpaceId(db, vaultId)

  const resourceId = newId()
  const parsedInput = parseResourceInput(input)
  if (parsedInput.type === "twitter") {
    await requireUserXComCookieString(db, createdBy)
  }
  const dedupeKey = getDuplicateResourceKey(parsedInput.url)
  await ensureResourceUrlNotDuplicate(db, vaultId, dedupeKey)

  await db.transaction(async (tx) => {
    await tx.insert(resources).values({
      id: resourceId,
      vaultId,
      spaceId,
      type: parsedInput.type,
      title: parsedInput.title,
      description: input.description,
      url: parsedInput.url,
      referer: input.referer || null,
      dedupeKey,
      metadataStatus: "pending",
      createdBy,
    })
    await tx.insert(resourceMetadata).values({
      resourceId,
      provider: parsedInput.type,
      status: "pending",
      dataJson: {
        input: parsedInput.metadata ?? {},
      },
    })
  })

  if (parsedInput.metadata && Object.keys(parsedInput.metadata).length > 0) {
    console.log("Resource input parsed", {
      resourceId,
      vaultId,
      type: parsedInput.type,
      url: parsedInput.url,
      metadata: parsedInput.metadata,
    })
  }

  return {
    id: resourceId,
    metadataStatus: "pending" as const,
    metadataTask: createMetadataQueueMessage(
      vaultId,
      resourceId,
      parsedInput.type,
      parsedInput.url
    ),
  }
}

export async function updateResource(
  db: Db,
  resourceId: string,
  input: {
    spaceId?: string | null
    type?: ResourceType
    title?: string
    description?: string
    url?: string
    referer?: string
    position?: number
    actor?: Actor
    userEmail?: string
  }
) {
  const resource = await getResourceOrThrow(db, resourceId)
  await requireResourceMutationPermission(db, resource, input.actor)

  if (resource.stashUserId && input.spaceId !== undefined) {
    throw conflict("闪存中的 Resource 只能整理到 Vault，不能直接设置 Space。")
  }

  const nextSpaceId =
    input.spaceId === undefined
      ? undefined
      : input.spaceId === null
        ? null
        : (await getSpaceInVaultOrThrow(db, resource.vaultId!, input.spaceId)).id

  const parsedInput =
    input.url !== undefined
      ? parseResourceInput({
          url: input.url,
          type: input.type,
          title: input.title ?? resource.title,
        })
      : undefined
  const nextType = parsedInput?.type ?? input.type
  const nextTitle = parsedInput?.title ?? input.title
  const nextUrl = parsedInput?.url ?? input.url
  const nextDedupeKey = nextUrl !== undefined ? getDuplicateResourceKey(nextUrl) : undefined
  const shouldResetMetadata =
    (nextType !== undefined && nextType !== resource.type) ||
    (nextUrl !== undefined && nextUrl !== resource.url)

  if (shouldResetMetadata && (nextType ?? resource.type) === "twitter") {
    await requireUserXComCookieString(db, input.actor?.id)
  }

  if (nextUrl !== undefined && nextUrl !== resource.url) {
    if (resource.vaultId) {
      await ensureResourceUrlNotDuplicate(db, resource.vaultId, nextDedupeKey!, resourceId)
    } else if (resource.stashUserId) {
      await ensureStashResourceUrlNotDuplicate(db, resource.stashUserId, nextDedupeKey!, resourceId)
    }
  }

  const updates = {
    ...(nextSpaceId !== undefined ? { spaceId: nextSpaceId } : {}),
    ...(nextType !== undefined ? { type: nextType } : {}),
    ...(nextTitle !== undefined ? { title: nextTitle } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(nextUrl !== undefined ? { url: nextUrl } : {}),
    ...(input.referer !== undefined ? { referer: input.referer || null } : {}),
    ...(nextDedupeKey !== undefined ? { dedupeKey: nextDedupeKey } : {}),
    ...(input.position !== undefined ? { position: input.position } : {}),
    ...(shouldResetMetadata ? { metadataStatus: "pending" as const } : {}),
    updatedAt: new Date().toISOString(),
  }

  if (shouldResetMetadata) {
    await db.transaction(async (tx) => {
      await tx
        .update(resources)
        .set(updates)
        .where(eq(resources.id, resourceId))
      await tx.delete(resourceMetadata).where(eq(resourceMetadata.resourceId, resourceId))
      await tx.insert(resourceMetadata).values({
        resourceId,
        provider: nextType ?? resource.type,
        status: "pending",
        dataJson: {
          input: parsedInput?.metadata ?? {},
        },
      })
    })
  } else {
    await db
      .update(resources)
      .set(updates)
      .where(eq(resources.id, resourceId))
  }

  return {
    id: resourceId,
    metadataStatus: shouldResetMetadata ? ("pending" as const) : resource.metadataStatus,
    metadataTask: shouldResetMetadata && (nextUrl ?? resource.url)
      ? createMetadataQueueMessage(
          resource.vaultId,
          resourceId,
          nextType ?? resource.type,
          (nextUrl ?? resource.url)!
        )
      : undefined,
  }
}

export async function ensureResourceUrlNotDuplicate(
  db: Db,
  vaultId: string,
  dedupeKey: string,
  excludeResourceId?: string
) {
  const duplicateId = await findResourceIdByDedupeKey(db, vaultId, dedupeKey)
  const duplicate = duplicateId && duplicateId !== excludeResourceId ? duplicateId : null

  if (duplicate) {
    throw conflict("当前 vault 中已经有该链接，请不要重复添加。")
  }
}

export async function ensureStashResourceUrlNotDuplicate(
  db: Db,
  stashUserId: string,
  dedupeKey: string,
  excludeResourceId?: string,
) {
  const rows = await db
    .select({ id: resources.id })
    .from(resources)
    .where(and(eq(resources.stashUserId, stashUserId), eq(resources.dedupeKey, dedupeKey)))
    .limit(1)

  const duplicate = rows.find((resource) => resource.id !== excludeResourceId)
  if (duplicate) throw conflict("闪存中已经有该链接，请不要重复添加。")
}

export function getDuplicateResourceKey(url: string) {
  const magnet = parseMagnetLink(url)
  if (magnet) return `magnet:${magnet.infoHash}`
  return `url:${url.trim()}`
}

export async function archiveResource(
  db: Db,
  resourceId: string,
  input: {
    actor?: Actor
    media?: R2Bucket
    userEmail?: string
  }
) {
  const resource = await getResourceOrThrow(db, resourceId)
  await requireResourceMutationPermission(db, resource, input.actor)
  const metadata = await findResourceMetadata(db, resourceId)

  await db
    .delete(resources)
    .where(eq(resources.id, resourceId))

  if (input.media && metadata?.provider === LOCAL_MEDIA_PROVIDER) {
    const objectKeys = getLocalMediaObjectKeys(metadata.dataJson)
    if (objectKeys.length > 0) {
      await input.media.delete(objectKeys).catch((error) => {
        console.error("Failed to delete uploaded resource media.", { error, resourceId })
      })
    }
  }

  return { id: resourceId, deleted: true }
}

export async function reorderResources(
  db: Db,
  vaultId: string,
  input: {
    items: Array<{
      id: string
      spaceId: string
      position: number
    }>
    actor?: Actor
    userEmail?: string
  }
) {
  await getVaultOrThrow(db, vaultId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
    action: "resource:update",
  })

  const now = new Date().toISOString()
  if (input.items.length === 0) return { updated: 0 }

  await db.transaction(async (tx) => {
    for (const item of input.items) {
      await tx
        .update(resources)
        .set({
          spaceId: item.spaceId,
          position: item.position,
          updatedAt: now,
        })
        .where(and(eq(resources.id, item.id), eq(resources.vaultId, vaultId)))
    }
  })

  return { updated: input.items.length }
}

export async function listResourceTransferTargets(
  db: Db,
  input: {
    actor: Actor
  }
) {
  const vaultRows = await db
    .select({
      id: vaults.id,
      title: vaults.title,
      cover: vaults.cover,
    })
    .from(vaults)
    .where(and(eq(vaults.ownerId, input.actor.id), isNull(vaults.deletedAt)))

  if (vaultRows.length === 0) return { items: [] }

  const spaceRows = await db
    .select({
      id: spaces.id,
      vaultId: spaces.vaultId,
      name: spaces.name,
      icon: spaces.icon,
      position: spaces.position,
    })
    .from(spaces)
    .where(and(inArray(spaces.vaultId, vaultRows.map((vault) => vault.id)), isNull(spaces.deletedAt)))

  return {
    items: vaultRows.map((vault) => ({
      ...vault,
      spaces: spaceRows
        .filter((space) => space.vaultId === vault.id)
        .sort((a, b) => a.position - b.position)
        .map((space) => ({
          id: space.id,
          name: space.name,
          icon: space.icon,
        })),
    })),
  }
}

export async function transferResource(
  db: Db,
  resourceId: string,
  input: {
    action: "move" | "copy"
    targetVaultId: string
    targetSpaceId: string
    actor: Actor
  }
) {
  const resource = await getResourceOrThrow(db, resourceId)
  if (resource.stashUserId) {
    if (input.action !== "move") throw conflict("闪存中的 Resource 只能整理到 Vault，不能复制。")
    if (resource.stashUserId !== input.actor.id) throw forbidden("Only the stash owner can organize this resource.")
    await getVaultOrThrow(db, input.targetVaultId)
    await getSpaceInVaultOrThrow(db, input.targetVaultId, input.targetSpaceId)
    await requireVaultPermission(db, {
      vaultId: input.targetVaultId,
      actor: input.actor,
      action: "resource:create",
    })
    await ensureResourceUrlNotDuplicate(db, input.targetVaultId, resource.dedupeKey)
    const position = await getNextResourcePosition(db, input.targetSpaceId)
    await db.update(resources).set({
      vaultId: input.targetVaultId,
      stashUserId: null,
      spaceId: input.targetSpaceId,
      position,
      updatedAt: new Date().toISOString(),
    }).where(eq(resources.id, resourceId))
    return { id: resourceId, action: "move" as const, vaultId: input.targetVaultId, spaceId: input.targetSpaceId }
  }
  if (input.targetSpaceId === resource.spaceId) {
    throw conflict("目标就是当前 Space，无需操作。")
  }

  const sourceRole = await getVaultRoleForActor(db, resource.vaultId!, input.actor)
  if (sourceRole !== "owner") {
    throw forbidden("Only the vault owner can transfer resources.")
  }
  await getVaultOrThrow(db, input.targetVaultId)
  await getSpaceInVaultOrThrow(db, input.targetVaultId, input.targetSpaceId)
  await requireVaultPermission(db, {
    vaultId: input.targetVaultId,
    actor: input.actor,
    action: "resource:create",
  })
  await ensureResourceUrlNotDuplicate(
    db,
    input.targetVaultId,
    resource.dedupeKey,
    input.action === "move" ? resource.id : undefined
  )

  const now = new Date().toISOString()
  const position = await getNextResourcePosition(db, input.targetSpaceId)

  if (input.action === "move") {
    await db
      .update(resources)
      .set({
        vaultId: input.targetVaultId,
        spaceId: input.targetSpaceId,
        position,
        updatedAt: now,
      })
      .where(eq(resources.id, resourceId))

    return {
      id: resourceId,
      action: "move" as const,
      vaultId: input.targetVaultId,
      spaceId: input.targetSpaceId,
    }
  }

  const copiedResourceId = newId()
  const [metadata] = await db
    .select({
      provider: resourceMetadata.provider,
      status: resourceMetadata.status,
      dataJson: resourceMetadata.dataJson,
      errorMessage: resourceMetadata.errorMessage,
    })
    .from(resourceMetadata)
    .where(eq(resourceMetadata.resourceId, resourceId))
    .limit(1)

  await db.transaction(async (tx) => {
    await tx.insert(resources).values({
      id: copiedResourceId,
      vaultId: input.targetVaultId,
      spaceId: input.targetSpaceId,
      type: resource.type,
      title: resource.title,
      description: resource.description,
      url: resource.url,
      referer: resource.referer,
      dedupeKey: resource.dedupeKey,
      metadataStatus: resource.metadataStatus,
      position,
      createdBy: input.actor.id,
    })
    await tx.insert(resourceMetadata).values({
      resourceId: copiedResourceId,
      provider: metadata?.provider ?? resource.type,
      status: metadata?.status ?? resource.metadataStatus,
      dataJson: metadata?.dataJson ?? {},
      errorMessage: metadata?.errorMessage,
    })
  })

  return {
    id: copiedResourceId,
    action: "copy" as const,
    vaultId: input.targetVaultId,
    spaceId: input.targetSpaceId,
  }
}

export async function transferResources(
  db: Db,
  input: {
    action: "move" | "copy"
    resourceIds: string[]
    targetVaultId: string
    targetSpaceId: string
    actor: Actor
  }
) {
  const resourceIds = [...new Set(input.resourceIds)]
  if (resourceIds.length === 0) return { action: input.action, items: [] }

  const resourceRows = await db
    .select({
      id: resources.id,
      vaultId: resources.vaultId,
      stashUserId: resources.stashUserId,
      spaceId: resources.spaceId,
      type: resources.type,
      title: resources.title,
      description: resources.description,
      url: resources.url,
      referer: resources.referer,
      dedupeKey: resources.dedupeKey,
      metadataStatus: resources.metadataStatus,
      createdBy: resources.createdBy,
    })
    .from(resources)
    .where(inArray(resources.id, resourceIds))

  if (resourceRows.length !== resourceIds.length) {
    throw notFound("Some resources were not found.")
  }

  if (resourceRows.some((resource) => resource.stashUserId)) {
    throw conflict("闪存中的 Resource 请逐条整理到 Vault。")
  }

  const orderedResources = resourceIds.map((resourceId) => {
    const resource = resourceRows.find((item) => item.id === resourceId)
    if (!resource) throw notFound("Resource not found.")
    return resource
  })

  const sameSpaceResource = orderedResources.find(
    (resource) => resource.spaceId === input.targetSpaceId
  )
  if (sameSpaceResource) {
    throw conflict("部分 Resource 已经在目标 Space 中，无需操作。")
  }

  for (const vaultId of new Set(orderedResources.map((resource) => resource.vaultId!))) {
    const sourceRole = await getVaultRoleForActor(db, vaultId, input.actor)
    if (sourceRole !== "owner") {
      throw forbidden("Only the vault owner can transfer resources.")
    }
  }

  await getVaultOrThrow(db, input.targetVaultId)
  await getSpaceInVaultOrThrow(db, input.targetVaultId, input.targetSpaceId)
  await requireVaultPermission(db, {
    vaultId: input.targetVaultId,
    actor: input.actor,
    action: "resource:create",
  })

  const movingResourceIds = new Set(input.action === "move" ? resourceIds : [])
  const duplicateRows = await db
    .select({
      id: resources.id,
      dedupeKey: resources.dedupeKey,
    })
    .from(resources)
    .where(
      and(
        eq(resources.vaultId, input.targetVaultId),
        inArray(resources.dedupeKey, orderedResources.map((resource) => resource.dedupeKey))
      )
    )
  const conflictingDuplicate = duplicateRows.find((row) => !movingResourceIds.has(row.id))
  if (conflictingDuplicate) {
    throw conflict("目标 vault 中已经存在部分链接，请不要重复添加。")
  }

  const now = new Date().toISOString()
  const basePosition = await getNextResourcePosition(db, input.targetSpaceId)

  if (input.action === "move") {
    await db.transaction(async (tx) => {
      for (const [index, resource] of orderedResources.entries()) {
        await tx
          .update(resources)
          .set({
            vaultId: input.targetVaultId,
            spaceId: input.targetSpaceId,
            position: basePosition + index,
            updatedAt: now,
          })
          .where(eq(resources.id, resource.id))
      }
    })

    return {
      action: "move" as const,
      items: orderedResources.map((resource) => ({
        id: resource.id,
        action: "move" as const,
        vaultId: input.targetVaultId,
        spaceId: input.targetSpaceId,
      })),
    }
  }

  const metadataRows = await db
    .select({
      resourceId: resourceMetadata.resourceId,
      provider: resourceMetadata.provider,
      status: resourceMetadata.status,
      dataJson: resourceMetadata.dataJson,
      errorMessage: resourceMetadata.errorMessage,
    })
    .from(resourceMetadata)
    .where(inArray(resourceMetadata.resourceId, resourceIds))
  const metadataByResourceId = new Map(
    metadataRows.map((metadata) => [metadata.resourceId, metadata])
  )
  const copiedResources = orderedResources.map((resource, index) => ({
    sourceId: resource.id,
    id: newId(),
    resource,
    metadata: metadataByResourceId.get(resource.id),
    position: basePosition + index,
  }))

  await db.transaction(async (tx) => {
    for (const item of copiedResources) {
      await tx.insert(resources).values({
        id: item.id,
        vaultId: input.targetVaultId,
        spaceId: input.targetSpaceId,
        type: item.resource.type,
        title: item.resource.title,
        description: item.resource.description,
        url: item.resource.url,
        referer: item.resource.referer,
        dedupeKey: item.resource.dedupeKey,
        metadataStatus: item.resource.metadataStatus,
        position: item.position,
        createdBy: input.actor.id,
      })
      await tx.insert(resourceMetadata).values({
        resourceId: item.id,
        provider: item.metadata?.provider ?? item.resource.type,
        status: item.metadata?.status ?? item.resource.metadataStatus,
        dataJson: item.metadata?.dataJson ?? {},
        errorMessage: item.metadata?.errorMessage,
      })
    }
  })

  return {
    action: "copy" as const,
    items: copiedResources.map((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      action: "copy" as const,
      vaultId: input.targetVaultId,
      spaceId: input.targetSpaceId,
    })),
  }
}

export async function getResourceOrThrow(db: Db, resourceId: string) {
  const resource = await findResourceById(db, resourceId)
  if (!resource) throw notFound("Resource not found.")
  return resource
}

export async function getNextResourcePosition(db: Db, spaceId: string) {
  return countResourcesInSpace(db, spaceId)
}

export async function requireResourceMutationPermission(
  db: Db,
  resource: Awaited<ReturnType<typeof getResourceOrThrow>>,
  actor?: Actor
) {
  if (!actor) throw forbidden("Missing permission: resource:update")

  if (resource.stashUserId) {
    if (resource.stashUserId !== actor.id) throw forbidden("Only the stash owner can modify this resource.")
    return
  }

  const role = await getVaultRoleForActor(db, resource.vaultId!, actor)
  if (role === "owner") return
  if (role === "editor" && resource.createdBy === actor.id) return

  throw forbidden("Editors can only modify resources they created.")
}

export async function requireResourceReadPermission(
  db: Db,
  resource: Awaited<ReturnType<typeof getResourceOrThrow>>,
  actor?: Actor,
) {
  if (resource.stashUserId) {
    if (!actor || resource.stashUserId !== actor.id) throw forbidden("Only the stash owner can access this resource.")
    return
  }
  await requireVaultRead(db, { actor, vaultId: resource.vaultId! })
}

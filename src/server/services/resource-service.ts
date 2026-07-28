import { and, count, eq, inArray, isNull } from "drizzle-orm"

import { resourceMetadata, resources, spaces, vaults } from "@/db/schema"
import {
  parseMagnetLink,
  parseResourceInput,
  type ResourceType,
} from "@/domain/resources/input"
import {
  createMetadataQueueMessage,
  type MetadataQueueMessage,
} from "@/server/metadata"
import { conflict, forbidden, notFound } from "@/server/api/errors"
import type { Actor, Db } from "@/server/api/types"
import {
  getVaultRoleForActor,
  requireVaultPermission,
} from "@/server/services/permission-service"
import { getDefaultSpaceId, getSpaceInVaultOrThrow } from "@/server/services/space-service"
import { ensureActorUser } from "@/server/services/user-service"
import { getVaultOrThrow } from "@/server/services/vault-service"
import { newId } from "@/server/utils/id"

export async function createResource(
  db: Db,
  vaultId: string,
  input: {
    spaceId?: string
    type?: ResourceType
    title?: string
    description: string
    url: string
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
    position?: number
    actor?: Actor
    userEmail?: string
  }
) {
  const resource = await getResourceOrThrow(db, resourceId)
  await requireResourceMutationPermission(db, resource, input.actor)

  const nextSpaceId =
    input.spaceId === undefined
      ? undefined
      : input.spaceId === null
        ? null
        : (await getSpaceInVaultOrThrow(db, resource.vaultId, input.spaceId)).id

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

  if (nextUrl !== undefined && nextUrl !== resource.url) {
    await ensureResourceUrlNotDuplicate(db, resource.vaultId, nextDedupeKey!, resourceId)
  }

  const updates = {
    ...(nextSpaceId !== undefined ? { spaceId: nextSpaceId } : {}),
    ...(nextType !== undefined ? { type: nextType } : {}),
    ...(nextTitle !== undefined ? { title: nextTitle } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(nextUrl !== undefined ? { url: nextUrl } : {}),
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
    metadataTask: shouldResetMetadata
      ? createMetadataQueueMessage(
          resource.vaultId,
          resourceId,
          nextType ?? resource.type,
          nextUrl ?? resource.url
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
  const rows = await db
    .select({
      id: resources.id,
    })
    .from(resources)
    .where(
      and(
        eq(resources.vaultId, vaultId),
        eq(resources.dedupeKey, dedupeKey)
      )
    )
    .limit(1)

  const duplicate = rows.find((resource) => resource.id !== excludeResourceId)

  if (duplicate) {
    throw conflict("当前 vault 中已经有该链接，请不要重复添加。")
  }
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
    userEmail?: string
  }
) {
  const resource = await getResourceOrThrow(db, resourceId)
  await requireResourceMutationPermission(db, resource, input.actor)

  await db
    .delete(resources)
    .where(eq(resources.id, resourceId))

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
  if (input.targetSpaceId === resource.spaceId) {
    throw conflict("目标就是当前 Space，无需操作。")
  }

  const sourceRole = await getVaultRoleForActor(db, resource.vaultId, input.actor)
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

export async function getResourceOrThrow(db: Db, resourceId: string) {
  const [resource] = await db
    .select({
      id: resources.id,
      vaultId: resources.vaultId,
      spaceId: resources.spaceId,
      type: resources.type,
      title: resources.title,
      description: resources.description,
      url: resources.url,
      dedupeKey: resources.dedupeKey,
      metadataStatus: resources.metadataStatus,
      position: resources.position,
      createdBy: resources.createdBy,
      createdAt: resources.createdAt,
      updatedAt: resources.updatedAt,
    })
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)

  if (!resource) throw notFound("Resource not found.")
  return resource
}

async function getNextResourcePosition(db: Db, spaceId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(resources)
    .where(eq(resources.spaceId, spaceId))

  return row?.value ?? 0
}

export async function requireResourceMutationPermission(
  db: Db,
  resource: Awaited<ReturnType<typeof getResourceOrThrow>>,
  actor?: Actor
) {
  if (!actor) throw forbidden("Missing permission: resource:update")

  const role = await getVaultRoleForActor(db, resource.vaultId, actor)
  if (role === "owner") return
  if (role === "editor" && resource.createdBy === actor.id) return

  throw forbidden("Editors can only modify resources they created.")
}

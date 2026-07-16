import { and, eq, isNull } from "drizzle-orm"

import { resourceMetadata, resources } from "@nexus-vault/db/schema"
import {
  parseCloudDriveLink,
  parseMagnetLink,
  parseResourceInput,
  parseTwitterLink,
  isCloudDriveResourceType,
  type ResourceType,
} from "@nexus-vault/shared/resource-input"
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

export type MetadataQueueMessage = {
  kind: "metadata.resolve"
  resourceId: string
  vaultId: string
  type: ResourceType
  dedupeKey?: string
  requestedAt: string
}

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

  const resourceId = newId("resource")
  const parsedInput = parseResourceInput(input)
  const dedupeKey = getDuplicateResourceKey(parsedInput.url)
  await ensureResourceUrlNotDuplicate(db, vaultId, dedupeKey)

  await db.batch([
    db.insert(resources).values({
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
    }),
    db.insert(resourceMetadata).values({
      resourceId,
      provider: parsedInput.type,
      status: "pending",
      dataJson: JSON.stringify({
        input: parsedInput.metadata ?? {},
      }),
    }),
  ])

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
    await db.batch([
      db
        .update(resources)
        .set(updates)
        .where(and(eq(resources.id, resourceId), isNull(resources.deletedAt))),
      db.delete(resourceMetadata).where(eq(resourceMetadata.resourceId, resourceId)),
      db.insert(resourceMetadata).values({
        resourceId,
        provider: nextType ?? resource.type,
        status: "pending",
        dataJson: JSON.stringify({
          input: parsedInput?.metadata ?? {},
        }),
      }),
    ])
  } else {
    await db
      .update(resources)
      .set(updates)
      .where(and(eq(resources.id, resourceId), isNull(resources.deletedAt)))
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
        eq(resources.dedupeKey, dedupeKey),
        isNull(resources.deletedAt)
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

  const now = new Date().toISOString()
  await db
    .update(resources)
    .set({
      dedupeKey: `archived:${resource.id}:${resource.dedupeKey}`,
      deletedAt: now,
      updatedAt: now,
    })
    .where(and(eq(resources.id, resourceId), isNull(resources.deletedAt)))

  return { id: resourceId, archived: true }
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

  const statements = input.items.map((item) =>
    db
      .update(resources)
      .set({
        spaceId: item.spaceId,
        position: item.position,
        updatedAt: now,
      })
      .where(and(eq(resources.id, item.id), eq(resources.vaultId, vaultId), isNull(resources.deletedAt)))
  )
  await db.batch(statements as [typeof statements[number], ...typeof statements])

  return { updated: input.items.length }
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
      deletedAt: resources.deletedAt,
    })
    .from(resources)
    .where(and(eq(resources.id, resourceId), isNull(resources.deletedAt)))
    .limit(1)

  if (!resource) throw notFound("Resource not found.")
  return resource
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

export function createMetadataQueueMessage(
  vaultId: string,
  resourceId: string,
  type: ResourceType,
  url: string
): MetadataQueueMessage {
  const parsedMagnet = type === "magnet" ? parseMagnetLink(url) : null
  const parsedTwitter = type === "twitter" ? parseTwitterLink(url) : null
  const parsedCloudDrive = isCloudDriveResourceType(type) ? parseCloudDriveLink(url) : null

  return {
    kind: "metadata.resolve",
    vaultId,
    resourceId,
    type,
    dedupeKey: parsedMagnet
      ? `magnet:${parsedMagnet.infoHash}`
      : parsedTwitter
        ? `twitter:${parsedTwitter.tweetId}`
        : parsedCloudDrive
          ? `${parsedCloudDrive.provider}:${parsedCloudDrive.url}`
          : undefined,
    requestedAt: new Date().toISOString(),
  }
}

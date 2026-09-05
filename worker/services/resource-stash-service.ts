import { and, asc, eq } from "drizzle-orm"

import {
  resourceAnnotations,
  resourceMetadata,
  resourceReadLater,
  resources,
  starredResources,
} from "../db/schema"
import { normalizeResourceMetadata } from "../domain/resources/metadata"
import { parseResourceInput, type ResourceType } from "../domain/resources/input"
import { conflict } from "../lib/errors"
import { createMetadataQueueMessage } from "../metadata/index"
import type { Actor, Db } from "../types/legacy-api"
import { newId } from "../lib/id"
import { ensureActorUser } from "./user-service"
import {
  ensureStashResourceUrlNotDuplicate,
  getDuplicateResourceKey,
  getResourceOrThrow,
  transferResource,
} from "./resource-service"
import { requireUserXComCookieString } from "./account-integration-service"

export async function createStashResource(
  db: Db,
  input: {
    type?: ResourceType
    title?: string
    description: string
    extractionCode?: string
    url: string
    referer?: string
    actor: Actor
  },
) {
  const stashUserId = await ensureActorUser(db, input.actor)
  const parsedInput = parseResourceInput(input)
  if (parsedInput.type === "twitter") {
    await requireUserXComCookieString(db, stashUserId)
  }
  const dedupeKey = getDuplicateResourceKey(parsedInput.url)
  await ensureStashResourceUrlNotDuplicate(db, stashUserId, dedupeKey)

  const resourceId = newId()
  await db.transaction(async (tx) => {
    await tx.insert(resources).values({
      id: resourceId,
      vaultId: null,
      stashUserId,
      spaceId: null,
      type: parsedInput.type,
      title: parsedInput.title,
      description: input.description,
      url: parsedInput.url,
      referer: input.referer || null,
      dedupeKey,
      metadataStatus: "pending",
      createdBy: stashUserId,
    })
    await tx.insert(resourceMetadata).values({
      resourceId,
      provider: parsedInput.type,
      status: "pending",
      dataJson: { input: parsedInput.metadata ?? {} },
    })
  })

  return {
    id: resourceId,
    metadataStatus: "pending" as const,
    metadataTask: createMetadataQueueMessage(null, resourceId, parsedInput.type, parsedInput.url),
  }
}

export async function listStashResources(db: Db, input: { actor: Actor }) {
  const userId = await ensureActorUser(db, input.actor)
  const rows = await db
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
      isStarred: starredResources.id,
      isReadLater: resourceReadLater.id,
      annotationRating: resourceAnnotations.rating,
      annotationComment: resourceAnnotations.comment,
      annotationChecked: resourceAnnotations.checked,
      annotationDataJson: resourceAnnotations.dataJson,
      annotationCreatedAt: resourceAnnotations.createdAt,
      annotationUpdatedAt: resourceAnnotations.updatedAt,
    })
    .from(resources)
    .leftJoin(resourceMetadata, eq(resourceMetadata.resourceId, resources.id))
    .leftJoin(starredResources, and(
      eq(starredResources.sourceResourceId, resources.id),
      eq(starredResources.userId, userId),
    ))
    .leftJoin(resourceReadLater, and(
      eq(resourceReadLater.resourceId, resources.id),
      eq(resourceReadLater.userId, userId),
    ))
    .leftJoin(resourceAnnotations, and(
      eq(resourceAnnotations.resourceId, resources.id),
      eq(resourceAnnotations.userId, userId),
    ))
    .where(eq(resources.stashUserId, userId))
    .orderBy(asc(resources.position), asc(resources.createdAt))
    .limit(200)

  return {
    items: rows.map((row) => ({
      id: row.id,
      spaceId: null,
      type: row.type,
      title: row.title,
      description: row.description,
      url: row.url,
      referer: row.referer,
      metadataStatus: row.metadataStatus,
      position: row.position,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      isStarred: Boolean(row.isStarred),
      isReadLater: Boolean(row.isReadLater),
      annotation: row.annotationRating !== null || Boolean(row.annotationComment) || Boolean(row.annotationChecked) || Object.keys(row.annotationDataJson ?? {}).length > 0
        ? {
            rating: row.annotationRating,
            comment: row.annotationComment ?? "",
            checked: row.annotationChecked ?? false,
            dataJson: row.annotationDataJson ?? {},
            createdAt: row.annotationCreatedAt,
            updatedAt: row.annotationUpdatedAt,
          }
        : null,
      metadata: row.metadataProvider
        ? {
            provider: row.metadataProvider,
            data: normalizeResourceMetadata(row.metadataDataJson),
            errorMessage: row.metadataErrorMessage,
            updatedAt: row.metadataUpdatedAt,
          }
        : null,
    })),
  }
}

export async function organizeStashResource(
  db: Db,
  resourceId: string,
  input: { actor: Actor; targetVaultId: string; targetSpaceId: string },
) {
  const resource = await getResourceOrThrow(db, resourceId)
  if (resource.stashUserId !== input.actor.id) throw conflict("只能整理自己的闪存 Resource。")
  return transferResource(db, resourceId, {
    action: "move",
    targetVaultId: input.targetVaultId,
    targetSpaceId: input.targetSpaceId,
    actor: input.actor,
  })
}

export async function reorderStashResources(
  db: Db,
  input: { actor: Actor; items: Array<{ id: string; position: number }> },
) {
  const userId = await ensureActorUser(db, input.actor)
  const now = new Date().toISOString()
  await db.transaction(async (tx) => {
    for (const item of input.items) {
      await tx.update(resources).set({ position: item.position, updatedAt: now }).where(
        and(eq(resources.id, item.id), eq(resources.stashUserId, userId)),
      )
    }
  })
  return { updated: input.items.length }
}

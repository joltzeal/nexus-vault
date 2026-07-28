import { and, desc, eq, inArray, isNull, or } from "drizzle-orm"

import {
  collaborators,
  resourceAnnotations,
  resourceMetadata,
  resourceReadLater,
  resources,
  spaces,
  vaults,
} from "@/db/schema"
import { normalizeResourceMetadata } from "@/domain/resources/metadata"
import type { JsonObject } from "@/db/domain/enums"
import type { Actor, Db } from "@/server/api/types"
import { requireVaultRead } from "@/server/services/permission-service"
import { getResourceOrThrow } from "@/server/services/resource-service"
import { ensureActorUser } from "@/server/services/user-service"

export type ResourceAnnotationPatch = {
  checked?: boolean
  rating?: number | null
  comment?: string
  dataJson?: JsonObject
}

export async function listReadLaterResources(
  db: Db,
  input: {
    actor: Actor
  }
) {
  const userId = await ensureActorUser(db, input.actor)
  const collaboratorVaultIds = await db
    .select({ vaultId: collaborators.vaultId })
    .from(collaborators)
    .where(eq(collaborators.userId, userId))
    .then((rows) => rows.map((row) => row.vaultId))

  const accessFilter =
    collaboratorVaultIds.length > 0
      ? or(
          eq(vaults.ownerId, userId),
          eq(vaults.visibility, "public"),
          inArray(vaults.id, collaboratorVaultIds)
        )
      : or(eq(vaults.ownerId, userId), eq(vaults.visibility, "public"))

  const rows = await db
    .select({
      id: resourceReadLater.id,
      resourceId: resources.id,
      vaultId: resources.vaultId,
      vaultName: vaults.title,
      spaceId: resources.spaceId,
      spaceName: spaces.name,
      type: resources.type,
      title: resources.title,
      description: resources.description,
      url: resources.url,
      metadataStatus: resources.metadataStatus,
      position: resources.position,
      createdBy: resources.createdBy,
      resourceCreatedAt: resources.createdAt,
      resourceUpdatedAt: resources.updatedAt,
      savedAt: resourceReadLater.createdAt,
      metadataProvider: resourceMetadata.provider,
      metadataDataJson: resourceMetadata.dataJson,
      metadataErrorMessage: resourceMetadata.errorMessage,
      metadataUpdatedAt: resourceMetadata.updatedAt,
      annotationRating: resourceAnnotations.rating,
      annotationComment: resourceAnnotations.comment,
      annotationChecked: resourceAnnotations.checked,
      annotationDataJson: resourceAnnotations.dataJson,
      annotationCreatedAt: resourceAnnotations.createdAt,
      annotationUpdatedAt: resourceAnnotations.updatedAt,
    })
    .from(resourceReadLater)
    .innerJoin(resources, eq(resourceReadLater.resourceId, resources.id))
    .innerJoin(vaults, eq(resources.vaultId, vaults.id))
    .leftJoin(spaces, eq(resources.spaceId, spaces.id))
    .leftJoin(resourceMetadata, eq(resourceMetadata.resourceId, resources.id))
    .leftJoin(
      resourceAnnotations,
      and(
        eq(resourceAnnotations.resourceId, resources.id),
        eq(resourceAnnotations.userId, userId)
      )
    )
    .where(and(eq(resourceReadLater.userId, userId), isNull(vaults.deletedAt), accessFilter))
    .orderBy(desc(resourceReadLater.createdAt))
    .limit(100)

  return {
    items: rows.map((row) => ({
      id: row.id,
      resourceId: row.resourceId,
      vaultId: row.vaultId,
      vaultName: row.vaultName,
      spaceId: row.spaceId ?? "",
      spaceName: row.spaceName ?? "Unsorted",
      savedAt: row.savedAt,
      resource: {
        id: row.resourceId,
        spaceId: row.spaceId ?? "",
        type: row.type,
        title: row.title,
        description: row.description,
        url: row.url,
        metadataStatus: row.metadataStatus,
        position: row.position,
        createdBy: row.createdBy,
        createdAt: row.resourceCreatedAt,
        updatedAt: row.resourceUpdatedAt,
        isReadLater: true,
        annotation:
          row.annotationRating !== null ||
          row.annotationComment ||
          row.annotationChecked ||
          Object.keys(row.annotationDataJson ?? {}).length > 0
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
      },
    })),
  }
}

export async function addResourceReadLater(
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
    .select({ id: resourceReadLater.id })
    .from(resourceReadLater)
    .where(and(eq(resourceReadLater.userId, userId), eq(resourceReadLater.resourceId, resourceId)))
    .limit(1)

  if (!existing) {
    await db.insert(resourceReadLater).values({
      userId,
      resourceId,
    })
  }

  return { readLater: true }
}

export async function removeResourceReadLater(
  db: Db,
  resourceId: string,
  input: {
    actor: Actor
  }
) {
  const userId = await ensureActorUser(db, input.actor)
  await db
    .delete(resourceReadLater)
    .where(and(eq(resourceReadLater.userId, userId), eq(resourceReadLater.resourceId, resourceId)))

  return { readLater: false }
}

export async function updateResourceAnnotation(
  db: Db,
  resourceId: string,
  input: ResourceAnnotationPatch & {
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
    .select({
      id: resourceAnnotations.id,
      checked: resourceAnnotations.checked,
      rating: resourceAnnotations.rating,
      comment: resourceAnnotations.comment,
      dataJson: resourceAnnotations.dataJson,
      createdAt: resourceAnnotations.createdAt,
    })
    .from(resourceAnnotations)
    .where(
      and(
        eq(resourceAnnotations.userId, userId),
        eq(resourceAnnotations.resourceId, resourceId)
      )
    )
    .limit(1)

  const next = {
    checked: input.checked ?? existing?.checked ?? false,
    rating: input.rating === undefined ? existing?.rating ?? null : input.rating,
    comment: input.comment ?? existing?.comment ?? "",
    dataJson: input.dataJson ?? existing?.dataJson ?? {},
  }

  if (!hasAnnotationValue(next)) {
    if (existing) {
      await db.delete(resourceAnnotations).where(eq(resourceAnnotations.id, existing.id))
    }
    return { annotation: null }
  }

  const now = new Date().toISOString()
  if (existing) {
    await db
      .update(resourceAnnotations)
      .set({
        ...next,
        updatedAt: now,
      })
      .where(eq(resourceAnnotations.id, existing.id))
  } else {
    await db.insert(resourceAnnotations).values({
      userId,
      resourceId,
      ...next,
    })
  }

  return {
    annotation: {
      ...next,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    },
  }
}

export async function clearResourceAnnotation(
  db: Db,
  resourceId: string,
  input: {
    actor: Actor
  }
) {
  const userId = await ensureActorUser(db, input.actor)
  await db
    .delete(resourceAnnotations)
    .where(
      and(
        eq(resourceAnnotations.userId, userId),
        eq(resourceAnnotations.resourceId, resourceId)
      )
    )

  return { annotation: null }
}

function hasAnnotationValue(annotation: {
  checked: boolean
  rating: number | null
  comment: string
  dataJson: JsonObject
}) {
  return (
    annotation.checked ||
    Boolean(annotation.rating && annotation.rating > 0) ||
    Boolean(annotation.comment.trim()) ||
    Object.keys(annotation.dataJson).length > 0
  )
}

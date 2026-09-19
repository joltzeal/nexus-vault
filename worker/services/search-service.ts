import { and, desc, ilike, isNull, or, eq, sql } from "drizzle-orm"

import {
  collaborators,
  resourceAnnotations,
  resourceMetadata,
  resourceReadLater,
  resources,
  spaces,
  starredResources,
  vaults,
} from "../db/schema"
import { normalizeResourceMetadata } from "../domain/resources/metadata"
import type { Actor, Db } from "../types/legacy-api"

export async function searchWorkspace(
  db: Db,
  input: { actor: Actor; query: string },
) {
  const query = input.query.trim()
  if (!query) return { resources: [] }
  // Treat SQL wildcard characters as literal search text. A query for an
  // actual URL or identifier should not silently turn into a broad match.
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`
  const access = or(
    eq(vaults.ownerId, input.actor.id),
    eq(collaborators.userId, input.actor.id),
  )

  const resourceRows = await db
    .selectDistinct({
      id: resources.id,
      title: resources.title,
      description: resources.description,
      url: resources.url,
      referer: resources.referer,
      type: resources.type,
      metadataStatus: resources.metadataStatus,
      position: resources.position,
      createdBy: resources.createdBy,
      createdAt: resources.createdAt,
      updatedAt: resources.updatedAt,
      vaultId: resources.vaultId,
      vaultTitle: vaults.title,
      spaceId: resources.spaceId,
      spaceName: spaces.name,
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
    .leftJoin(vaults, eq(vaults.id, resources.vaultId))
    .leftJoin(spaces, eq(spaces.id, resources.spaceId))
    .leftJoin(resourceMetadata, eq(resourceMetadata.resourceId, resources.id))
    .leftJoin(collaborators, eq(collaborators.vaultId, vaults.id))
    .leftJoin(starredResources, and(
      eq(starredResources.sourceResourceId, resources.id),
      eq(starredResources.userId, input.actor.id),
    ))
    .leftJoin(resourceReadLater, and(
      eq(resourceReadLater.resourceId, resources.id),
      eq(resourceReadLater.userId, input.actor.id),
    ))
    .leftJoin(resourceAnnotations, and(
      eq(resourceAnnotations.resourceId, resources.id),
      eq(resourceAnnotations.userId, input.actor.id),
    ))
    .where(and(or(eq(resources.stashUserId, input.actor.id), and(isNull(vaults.deletedAt), access)), or(ilike(resources.title, pattern), ilike(resources.url, pattern), ilike(resources.description, pattern), ilike(vaults.title, pattern), ilike(vaults.description, pattern), ilike(spaces.name, pattern), ilike(spaces.description, pattern), ilike(sql<string>`${resourceMetadata.dataJson}::text`, pattern))))
    .orderBy(desc(resources.createdAt))
    .limit(24)

  return {
    resources: resourceRows.map((row) => ({
      resource: {
        id: row.id,
        spaceId: row.spaceId,
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
        annotation:
          row.annotationRating !== null ||
          Boolean(row.annotationComment) ||
          Boolean(row.annotationChecked) ||
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
      vaultId: row.vaultId ?? "flash-stash",
      vaultTitle: row.vaultTitle ?? "Flash stash",
      spaceId: row.spaceId,
      spaceName: row.spaceName,
    })),
  }
}

import { and, count, eq } from "drizzle-orm"

import { resourceMetadata, resources } from "../db/schema"
import type { Db } from "../types/legacy-api"

const resourceSelection = {
  id: resources.id,
  vaultId: resources.vaultId,
  spaceId: resources.spaceId,
  type: resources.type,
  title: resources.title,
  description: resources.description,
  url: resources.url,
  referer: resources.referer,
  dedupeKey: resources.dedupeKey,
  metadataStatus: resources.metadataStatus,
  position: resources.position,
  createdBy: resources.createdBy,
  createdAt: resources.createdAt,
  updatedAt: resources.updatedAt,
} as const

/** Database-only resource queries. Business rules belong in services. */
export async function findResourceById(db: Db, resourceId: string) {
  const [resource] = await db
    .select(resourceSelection)
    .from(resources)
    .where(eq(resources.id, resourceId))
    .limit(1)
  return resource ?? null
}

export async function findResourceIdByDedupeKey(
  db: Db,
  vaultId: string,
  dedupeKey: string,
) {
  const [resource] = await db
    .select({ id: resources.id })
    .from(resources)
    .where(and(eq(resources.vaultId, vaultId), eq(resources.dedupeKey, dedupeKey)))
    .limit(1)
  return resource?.id ?? null
}

export async function countResourcesInSpace(db: Db, spaceId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(resources)
    .where(eq(resources.spaceId, spaceId))
  return row?.value ?? 0
}

export async function findResourceMetadata(db: Db, resourceId: string) {
  const [metadata] = await db
    .select({
      provider: resourceMetadata.provider,
      status: resourceMetadata.status,
      dataJson: resourceMetadata.dataJson,
      errorMessage: resourceMetadata.errorMessage,
      updatedAt: resourceMetadata.updatedAt,
    })
    .from(resourceMetadata)
    .where(eq(resourceMetadata.resourceId, resourceId))
    .limit(1)
  return metadata ?? null
}

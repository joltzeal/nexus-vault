import { and, eq, isNull, max } from "drizzle-orm"

import { spaces } from "../db/schema"
import type { Db } from "../types/legacy-api"

/** Database-only space queries. Authorization and naming rules stay in services. */
export async function findSpaceByIdInVault(db: Db, vaultId: string, spaceId: string) {
  const [space] = await db
    .select({
      id: spaces.id,
      vaultId: spaces.vaultId,
      name: spaces.name,
      description: spaces.description,
      icon: spaces.icon,
      position: spaces.position,
      createdAt: spaces.createdAt,
      updatedAt: spaces.updatedAt,
    })
    .from(spaces)
    .where(and(eq(spaces.id, spaceId), eq(spaces.vaultId, vaultId), isNull(spaces.deletedAt)))
    .limit(1)
  return space ?? null
}

export async function findSpaceIdByName(db: Db, vaultId: string, name: string) {
  const [space] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(and(eq(spaces.vaultId, vaultId), eq(spaces.name, name), isNull(spaces.deletedAt)))
    .limit(1)
  return space?.id ?? null
}

export async function findNextSpacePosition(db: Db, vaultId: string) {
  const [row] = await db
    .select({ value: max(spaces.position) })
    .from(spaces)
    .where(and(eq(spaces.vaultId, vaultId), isNull(spaces.deletedAt)))
  return (row?.value ?? -1) + 1
}

import { and, eq, isNull } from "drizzle-orm"

import { users, vaults } from "../db/schema"
import type { Db } from "../types/legacy-api"

const vaultSelection = {
  id: vaults.id,
  title: vaults.title,
  description: vaults.description,
  cover: vaults.cover,
  ownerName: users.name,
  visibility: vaults.visibility,
  collectionEnabled: vaults.collectionEnabled,
  nsfwEnabled: vaults.nsfwEnabled,
  ownerId: vaults.ownerId,
  starCount: vaults.starCount,
  forkCount: vaults.forkCount,
  forkedFromVaultId: vaults.forkedFromVaultId,
  createdAt: vaults.createdAt,
  updatedAt: vaults.updatedAt,
} as const

/** Database-only vault queries. No authentication or authorization belongs here. */
export async function findVaultById(db: Db, vaultId: string) {
  const [vault] = await db
    .select(vaultSelection)
    .from(vaults)
    .leftJoin(users, eq(vaults.ownerId, users.id))
    .where(and(eq(vaults.id, vaultId), isNull(vaults.deletedAt)))
    .limit(1)
  return vault ?? null
}

export async function updateVaultById(
  db: Db,
  vaultId: string,
  values: {
    title?: string
    description?: string
    cover?: string
    visibility?: "public" | "private" | "password"
    collectionEnabled?: boolean
    nsfwEnabled?: boolean
    passwordHash?: string | null
    deletedAt?: string | null
    updatedAt: string
  },
) {
  await db
    .update(vaults)
    .set(values)
    .where(and(eq(vaults.id, vaultId), isNull(vaults.deletedAt)))
}

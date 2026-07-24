import { and, eq, isNull, ne, sql } from "drizzle-orm"

import { resources, spaces } from "@nexus-vault/db/schema"
import { conflict, notFound } from "@/server/api/errors"
import type { Actor, Db } from "@/server/api/types"
import { requireVaultPermission } from "@/server/services/permission-service"
import { getVaultOrThrow } from "@/server/services/vault-service"
import { newId } from "@/server/utils/id"

export async function createSpace(
  db: Db,
  vaultId: string,
  input: {
    name: string
    description: string
    icon?: string
    actor?: Actor
    userEmail?: string
  }
) {
  await getVaultOrThrow(db, vaultId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
    action: "space:create",
  })
  await ensureSpaceNameNotDuplicate(db, vaultId, input.name)

  const spaceId = newId()
  await db.insert(spaces).values({
    id: spaceId,
    vaultId,
    name: input.name,
    description: input.description,
    icon: input.icon ?? "tv",
  })

  return { id: spaceId }
}

export async function updateSpace(
  db: Db,
  vaultId: string,
  spaceId: string,
  input: {
    name?: string
    description?: string
    icon?: string
    position?: number
    actor?: Actor
    userEmail?: string
  }
) {
  await getVaultOrThrow(db, vaultId)
  await getSpaceInVaultOrThrow(db, vaultId, spaceId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
    action: "space:update",
  })
  if (input.name !== undefined) {
    await ensureSpaceNameNotDuplicate(db, vaultId, input.name, spaceId)
  }

  await db
    .update(spaces)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(spaces.id, spaceId), eq(spaces.vaultId, vaultId), isNull(spaces.deletedAt)))

  return { id: spaceId }
}

export async function archiveSpace(
  db: Db,
  vaultId: string,
  spaceId: string,
  input: {
    actor?: Actor
    userEmail?: string
  }
) {
  await getVaultOrThrow(db, vaultId)
  await getSpaceInVaultOrThrow(db, vaultId, spaceId)
  await requireVaultPermission(db, {
    vaultId,
    actor: input.actor,
    userEmail: input.userEmail,
    action: "space:delete",
  })

  const now = new Date().toISOString()
  await db
    .update(spaces)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(spaces.id, spaceId), eq(spaces.vaultId, vaultId), isNull(spaces.deletedAt)))
  await db
    .update(resources)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(resources.vaultId, vaultId), eq(resources.spaceId, spaceId), isNull(resources.deletedAt)))

  return { id: spaceId, archived: true }
}

export async function reorderSpaces(
  db: Db,
  vaultId: string,
  input: {
    items: Array<{
      id: string
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
    action: "space:update",
  })

  const now = new Date().toISOString()
  if (input.items.length === 0) return { updated: 0 }

  const statements = input.items.map((item) =>
    db
      .update(spaces)
      .set({
        position: item.position,
        updatedAt: now,
      })
      .where(and(eq(spaces.id, item.id), eq(spaces.vaultId, vaultId), isNull(spaces.deletedAt)))
  )
  await db.batch(statements as [typeof statements[number], ...typeof statements])

  return { updated: input.items.length }
}

export async function getSpaceInVaultOrThrow(db: Db, vaultId: string, spaceId: string) {
  const [space] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(and(eq(spaces.id, spaceId), eq(spaces.vaultId, vaultId), isNull(spaces.deletedAt)))
    .limit(1)

  if (!space) throw notFound("Space not found.")
  return space
}

export async function getDefaultSpaceId(db: Db, vaultId: string) {
  const [space] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(and(eq(spaces.vaultId, vaultId), isNull(spaces.deletedAt)))
    .limit(1)

  return space?.id
}

async function ensureSpaceNameNotDuplicate(
  db: Db,
  vaultId: string,
  name: string,
  ignoreSpaceId?: string
) {
  const normalizedName = name.trim().toLowerCase()
  const conditions = [
    eq(spaces.vaultId, vaultId),
    isNull(spaces.deletedAt),
    sql`lower(${spaces.name}) = ${normalizedName}`,
    ...(ignoreSpaceId ? [ne(spaces.id, ignoreSpaceId)] : []),
  ]
  const [existing] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(and(...conditions))
    .limit(1)

  if (existing) throw conflict("Space 名称已存在。")
}

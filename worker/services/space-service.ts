import { and, eq, isNull, ne, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { resources, spaces } from "../db/schema"
import { conflict, forbidden, notFound } from "../lib/errors"
import type { Actor, Db } from "../types/legacy-api"
import {
  getVaultRoleForActor,
  requireVaultPermission,
} from "./permission-service"
import { getVaultOrThrow } from "./vault-service"
import { newId } from "../lib/id"
import {
  findNextSpacePosition,
  findSpaceByIdInVault,
} from "../repositories/space.repository"

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
    .delete(resources)
    .where(and(eq(resources.vaultId, vaultId), eq(resources.spaceId, spaceId)))

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

  await db.transaction(async (tx) => {
    for (const item of input.items) {
      await tx
        .update(spaces)
        .set({
          position: item.position,
          updatedAt: now,
        })
        .where(and(eq(spaces.id, item.id), eq(spaces.vaultId, vaultId), isNull(spaces.deletedAt)))
    }
  })

  return { updated: input.items.length }
}

export async function transferSpace(
  db: Db,
  vaultId: string,
  spaceId: string,
  input: {
    targetVaultId: string
    actor: Actor
  },
) {
  if (input.targetVaultId === vaultId) {
    throw conflict("目标 Vault 就是当前 Vault，无需移动。")
  }

  await getVaultOrThrow(db, vaultId)
  const sourceSpace = await getSpaceInVaultOrThrow(db, vaultId, spaceId)
  const sourceRole = await getVaultRoleForActor(db, vaultId, input.actor)
  if (sourceRole !== "owner") {
    throw forbidden("只有 Vault 所有者可以移动 Space。")
  }

  await getVaultOrThrow(db, input.targetVaultId)
  const targetRole = await getVaultRoleForActor(db, input.targetVaultId, input.actor)
  if (targetRole !== "owner") {
    throw forbidden("Space 只能移动到自己拥有的 Vault。")
  }

  await ensureSpaceNameNotDuplicate(db, input.targetVaultId, sourceSpace.name)

  const targetResources = alias(resources, "target_resources")
  const [duplicateResource] = await db
    .select({ id: targetResources.id })
    .from(resources)
    .innerJoin(
      targetResources,
      and(
        eq(targetResources.vaultId, input.targetVaultId),
        eq(targetResources.dedupeKey, resources.dedupeKey),
      ),
    )
    .where(and(eq(resources.vaultId, vaultId), eq(resources.spaceId, spaceId)))
    .limit(1)

  if (duplicateResource) {
    throw conflict("目标 Vault 中已存在这个 Space 内的部分资源，请先处理重复资源。")
  }

  const targetPosition = await findNextSpacePosition(db, input.targetVaultId)
  const now = new Date().toISOString()

  await db.transaction(async (tx) => {
    await tx
      .update(resources)
      .set({
        vaultId: input.targetVaultId,
        updatedAt: now,
      })
      .where(and(eq(resources.vaultId, vaultId), eq(resources.spaceId, spaceId)))

    await tx
      .update(spaces)
      .set({
        vaultId: input.targetVaultId,
        position: targetPosition,
        updatedAt: now,
      })
      .where(and(eq(spaces.id, spaceId), eq(spaces.vaultId, vaultId), isNull(spaces.deletedAt)))
  })

  return {
    id: spaceId,
    sourceVaultId: vaultId,
    targetVaultId: input.targetVaultId,
  }
}

export async function getSpaceInVaultOrThrow(db: Db, vaultId: string, spaceId: string) {
  const space = await findSpaceByIdInVault(db, vaultId, spaceId)

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

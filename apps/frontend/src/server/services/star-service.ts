import { and, desc, eq, isNull, or, sql } from "drizzle-orm"

import { stars, users, vaults } from "@nexus-vault/db/schema"
import type { Actor, Db } from "@/server/api/types"
import { requireVaultRead } from "@/server/services/permission-service"
import { ensureActorUser } from "@/server/services/user-service"
import { getVaultOrThrow } from "@/server/services/vault-service"
import { newId } from "@/server/utils/id"

export async function listStarredVaults(
  db: Db,
  input: {
    actor: Actor
  }
) {
  const rows = await db
    .select({
      id: vaults.id,
      title: vaults.title,
      description: vaults.description,
      visibility: vaults.visibility,
      starCount: vaults.starCount,
      forkCount: vaults.forkCount,
      createdAt: vaults.createdAt,
      updatedAt: vaults.updatedAt,
    })
    .from(stars)
    .innerJoin(vaults, eq(stars.vaultId, vaults.id))
    .innerJoin(users, eq(stars.userId, users.id))
    .where(and(orActor(input.actor), isNull(vaults.deletedAt)))
    .orderBy(desc(stars.createdAt))
    .limit(50)

  return rows
}

export async function starVault(
  db: Db,
  vaultId: string,
  input: {
    actor: Actor
  }
) {
  await getVaultOrThrow(db, vaultId)
  await requireVaultRead(db, {
    vaultId,
    actor: input.actor,
  })

  const userId = await ensureActorUser(db, input.actor)

  const [existing] = await db
    .select({ id: stars.id })
    .from(stars)
    .where(and(eq(stars.vaultId, vaultId), eq(stars.userId, userId)))
    .limit(1)

  if (!existing) {
    await db.batch([
      db.insert(stars).values({
        id: newId("star"),
        vaultId,
        userId,
      }),
      db
        .update(vaults)
        .set({ starCount: sql`${vaults.starCount} + 1` })
        .where(eq(vaults.id, vaultId)),
    ])
  }

  return { starred: true }
}

export async function unstarVault(
  db: Db,
  vaultId: string,
  input: {
    actor: Actor
  }
) {
  await getVaultOrThrow(db, vaultId)
  await requireVaultRead(db, {
    vaultId,
    actor: input.actor,
  })

  const userId = await ensureActorUser(db, input.actor)

  const [existing] = await db
    .select({ id: stars.id })
    .from(stars)
    .where(and(eq(stars.vaultId, vaultId), eq(stars.userId, userId)))
    .limit(1)

  if (existing) {
    await db.batch([
      db.delete(stars).where(eq(stars.id, existing.id)),
      db
        .update(vaults)
        .set({ starCount: sql`MAX(${vaults.starCount} - 1, 0)` })
        .where(eq(vaults.id, vaultId)),
    ])
  }

  return { starred: false }
}

function orActor(actor: Actor) {
  return or(eq(users.id, actor.id), eq(users.email, actor.email))
}

import { eq } from "drizzle-orm"

import { users } from "@nexus-vault/db/schema"
import type { Actor, Db } from "@/server/api/types"
import { newId } from "@/server/utils/id"

export async function ensureUser(
  db: Db,
  input: {
    email: string
    name?: string
  }
) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1)

  if (existing) return existing.id

  const userId = newId("user")
  await db.insert(users).values({
    id: userId,
    email: input.email,
    name: input.name,
  })

  return userId
}

export async function ensureActorUser(db: Db, actor: Actor) {
  const [existingById] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, actor.id))
    .limit(1)

  if (existingById) {
    await db
      .update(users)
      .set({
        email: actor.email,
        name: actor.name,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, actor.id))
    return existingById.id
  }

  const [existingByEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, actor.email))
    .limit(1)

  if (existingByEmail) {
    await db
      .update(users)
      .set({
        name: actor.name,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, existingByEmail.id))
    return existingByEmail.id
  }

  await db.insert(users).values({
    id: actor.id,
    email: actor.email,
    name: actor.name,
  })

  return actor.id
}

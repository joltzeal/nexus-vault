import { eq } from "drizzle-orm"

import { users } from "@/db/schema"
import { notFound } from "@/server/api/errors"
import type { Actor, Db } from "@/server/api/types"

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

  throw notFound("该用户尚未注册，无法添加为协作者。")
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
        name: actor.name || actor.email,
        updatedAt: new Date(),
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
        name: actor.name || actor.email,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingByEmail.id))
    return existingByEmail.id
  }

  throw notFound("当前登录用户不存在，请重新登录。")
}

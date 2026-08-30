import { eq } from "drizzle-orm"

import { users } from "../db/schema"
import type { Db } from "../types/legacy-api"

/** Database-only user lookups and synchronization primitives. */
export async function findUserIdByEmail(db: Db, email: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  return user?.id ?? null
}

export async function findUserIdById(db: Db, userId: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return user?.id ?? null
}

export async function updateUserProfile(
  db: Db,
  userId: string,
  values: { email?: string; name?: string },
) {
  await db
    .update(users)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(users.id, userId))
}

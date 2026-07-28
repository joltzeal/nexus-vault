import { sql } from "drizzle-orm"

import type { Db } from "@/db"

const BCRYPT_COST = 12
const MAX_PASSWORD_BYTES = 72

export function validatePassword(password: string) {
  const byteLength = new TextEncoder().encode(password).byteLength
  return password.length >= 8 && byteLength <= MAX_PASSWORD_BYTES
}

export function isBcryptHash(hash: string) {
  return /^\$2[aby]\$\d{2}\$/.test(hash)
}

export async function hashPassword(db: Db, password: string) {
  const rows = await db.execute(
    sql`select crypt(${password}, gen_salt('bf', ${BCRYPT_COST})) as hash`,
  )
  const hash = rows[0]?.hash
  if (typeof hash !== "string" || !hash) {
    throw new Error("PostgreSQL did not return a password hash.")
  }
  return hash
}

export async function verifyPassword(db: Db, password: string, hash: string) {
  if (!isBcryptHash(hash)) return false

  const rows = await db.execute(
    sql`select crypt(${password}, ${hash}) = ${hash} as valid`,
  )
  return rows[0]?.valid === true
}

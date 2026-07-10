import { drizzle } from "drizzle-orm/d1"

import { betterAuthSchema } from "./better-auth-schema"
import * as schema from "./schema"

export const dbSchema = {
  ...schema,
  ...betterAuthSchema,
}

export function getDb(db: D1Database) {
  return drizzle(db, { schema: dbSchema })
}

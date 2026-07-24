import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import { betterAuthSchema } from "./better-auth-schema"
import * as schema from "./schema"

export const dbSchema = {
  ...schema,
  ...betterAuthSchema,
}

type BaseDb = ReturnType<typeof drizzle<typeof dbSchema>>
type BatchResult<T extends readonly unknown[]> = {
  [K in keyof T]: Awaited<T[K]>
}

export type Db = BaseDb & {
  batch<T extends readonly unknown[]>(queries: T): Promise<BatchResult<T>>
}

export type DbSession = {
  close: () => Promise<void>
  db: Db
}

export function getDb(client: postgres.Sql) {
  const db = drizzle(client, { schema: dbSchema }) as unknown as BaseDb

  return Object.assign(db, {
    batch<T extends readonly unknown[]>(queries: T) {
      return Promise.all(queries) as Promise<BatchResult<T>>
    },
  }) satisfies Db
}

export async function createDbSession(env: { HYPERDRIVE: Hyperdrive }) {
  const client = postgres(env.HYPERDRIVE.connectionString, {
    max: 1,
    prepare: false,
    fetch_types: false,
  })

  return {
    db: getDb(client),
    close: () => client.end({ timeout: 1 }),
  } satisfies DbSession
}

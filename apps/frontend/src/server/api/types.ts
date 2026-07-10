import type { getDb } from "@nexus-vault/db"

export type Db = ReturnType<typeof getDb>

export type ApiBindings = CloudflareEnv

export type Actor = {
  id: string
  email: string
  name?: string | null
}

export type ApiVariables = {
  actor?: Actor
  db: Db
}

export type ApiEnv = {
  Bindings: ApiBindings
  Variables: ApiVariables
}

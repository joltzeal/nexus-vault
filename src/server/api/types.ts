import type { Db } from "@/db"

export type { Db }

export type ApiBindings = CloudflareEnv

export type Actor = {
  id: string
  email: string
  name?: string | null
}

export type ApiExecutionContext = {
  waitUntil(promise: Promise<unknown>): void
}

export type ApiContext = {
  env: ApiBindings
  executionCtx: ApiExecutionContext
}

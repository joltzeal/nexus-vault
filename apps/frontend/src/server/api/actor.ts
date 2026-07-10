import type { Context } from "hono"

import { unauthorized } from "@/server/api/errors"
import type { Actor, ApiEnv } from "@/server/api/types"

export function getActor(c: Context<ApiEnv>): Actor | undefined {
  return c.get("actor")
}

export function getActorEmail(c: Context<ApiEnv>) {
  return getActor(c)?.email
}

export function getActorId(c: Context<ApiEnv>) {
  return getActor(c)?.id
}

export function requireActor(c: Context<ApiEnv>) {
  const actor = getActor(c)
  if (!actor) throw unauthorized()
  return actor
}

import { createMiddleware } from "hono/factory"

import { getDb } from "@nexus-vault/db"
import { createAuth } from "@nexus-vault/auth/server"
import type { ApiEnv } from "@/server/api/types"

export const dbMiddleware = createMiddleware<ApiEnv>(async (c, next) => {
  c.set("db", getDb(c.env.DB))
  await next()
})

export const actorMiddleware = createMiddleware<ApiEnv>(async (c, next) => {
  const session = await createAuth(c.env, c.executionCtx).api.getSession({
    headers: c.req.raw.headers,
  })

  if (session?.user?.id && session.user.email) {
    c.set("actor", {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    })
  }

  await next()
})

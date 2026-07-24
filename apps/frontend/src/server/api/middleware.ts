import { createMiddleware } from "hono/factory"

import { createDbSession } from "@nexus-vault/db"
import { createAuth } from "@nexus-vault/auth/server"
import type { ApiEnv } from "@/server/api/types"

export const dbMiddleware = createMiddleware<ApiEnv>(async (c, next) => {
  const session = await createDbSession(c.env)
  c.set("db", session.db)

  try {
    await next()
  } finally {
    await session.close()
  }
})

export const actorMiddleware = createMiddleware<ApiEnv>(async (c, next) => {
  const pathname = new URL(c.req.url).pathname
  if (pathname === "/api/v1/auth-policy" || pathname === "/api/v1/health") {
    await next()
    return
  }

  const session = await createAuth(c.env, c.get("db"), c.executionCtx).api.getSession({
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

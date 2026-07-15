import { Hono } from "hono"
import { getRegistrationPolicy } from "@nexus-vault/auth"

import { ok } from "@/server/api/response"
import type { ApiEnv } from "@/server/api/types"

export const authPolicyRoutes = new Hono<ApiEnv>()

authPolicyRoutes.get("/auth-policy", async (c) => {
  const policy = await getRegistrationPolicy(c.var.db, c.env)

  return ok(c, policy)
})

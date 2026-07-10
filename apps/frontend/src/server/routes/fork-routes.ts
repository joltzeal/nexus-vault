import { Hono } from "hono"

import { requireActor } from "@/server/api/actor"
import { ok } from "@/server/api/response"
import type { ApiEnv } from "@/server/api/types"
import { forkVault } from "@/server/services/fork-service"

export const forkRoutes = new Hono<ApiEnv>()

forkRoutes.post("/vaults/:vaultId/fork", async (c) => {
  const result = await forkVault(c.get("db"), c.req.param("vaultId"), {
    actor: requireActor(c),
  })
  return ok(c, result, 201)
})

import { Hono } from "hono"

import { requireActor } from "@/server/api/actor"
import { ok } from "@/server/api/response"
import type { ApiEnv } from "@/server/api/types"
import { parseJson } from "@/server/api/validation"
import { starSchema } from "@/server/schemas/vault"
import {
  listStarredVaults,
  starVault,
  unstarVault,
} from "@/server/services/star-service"

export const starRoutes = new Hono<ApiEnv>()

starRoutes.get("/stars", async (c) => {
  const rows = await listStarredVaults(c.get("db"), {
    actor: requireActor(c),
  })
  return ok(c, { items: rows })
})

starRoutes.post("/vaults/:vaultId/star", async (c) => {
  const input = await parseJson(c, starSchema)
  const result = await starVault(c.get("db"), c.req.param("vaultId"), {
    ...input,
    actor: requireActor(c),
  })
  return ok(c, result)
})

starRoutes.delete("/vaults/:vaultId/star", async (c) => {
  const input = await parseJson(c, starSchema)
  const result = await unstarVault(c.get("db"), c.req.param("vaultId"), {
    ...input,
    actor: requireActor(c),
  })
  return ok(c, result)
})

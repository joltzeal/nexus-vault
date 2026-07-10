import { Hono } from "hono"

import { getActor, requireActor } from "@/server/api/actor"
import { ok } from "@/server/api/response"
import type { ApiEnv } from "@/server/api/types"
import { parseJson } from "@/server/api/validation"
import { createVaultSchema, updateVaultSchema } from "@/server/schemas/vault"
import {
  archiveVault,
  createVault,
  getVaultDetail,
  listVaults,
  updateVault,
} from "@/server/services/vault-service"

export const vaultRoutes = new Hono<ApiEnv>()

vaultRoutes.get("/vaults", async (c) => {
  const rows = await listVaults(c.get("db"), {
    query: c.req.query("q")?.trim(),
    actor: getActor(c),
  })
  return ok(c, { items: rows })
})

vaultRoutes.post("/vaults", async (c) => {
  const input = await parseJson(c, createVaultSchema)
  const result = await createVault(c.get("db"), {
    ...input,
    actor: requireActor(c),
  })
  return ok(c, result, 201)
})

vaultRoutes.get("/vaults/:vaultId", async (c) => {
  const result = await getVaultDetail(c.get("db"), c.req.param("vaultId"), {
    actor: getActor(c),
  })
  return ok(c, result)
})

vaultRoutes.patch("/vaults/:vaultId", async (c) => {
  const input = await parseJson(c, updateVaultSchema)
  const result = await updateVault(c.get("db"), c.req.param("vaultId"), {
    ...input,
    actor: requireActor(c),
  })
  return ok(c, result)
})

vaultRoutes.delete("/vaults/:vaultId", async (c) => {
  const result = await archiveVault(c.get("db"), c.req.param("vaultId"), {
    actor: requireActor(c),
  })
  return ok(c, result)
})

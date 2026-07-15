import { Hono } from "hono"

import { ok } from "@/server/api/response"
import type { ApiEnv } from "@/server/api/types"
import { parseJson } from "@/server/api/validation"
import { requireActor } from "@/server/api/actor"
import {
  createSpaceSchema,
  reorderSpacesSchema,
  updateSpaceSchema,
} from "@/server/schemas/space"
import {
  archiveSpace,
  createSpace,
  reorderSpaces,
  updateSpace,
} from "@/server/services/space-service"

export const spaceRoutes = new Hono<ApiEnv>()

spaceRoutes.post("/vaults/:vaultId/spaces", async (c) => {
  const input = await parseJson(c, createSpaceSchema)
  const result = await createSpace(c.get("db"), c.req.param("vaultId"), {
    ...input,
    actor: requireActor(c),
  })
  return ok(c, result, 201)
})

spaceRoutes.patch("/vaults/:vaultId/spaces/reorder", async (c) => {
  const input = await parseJson(c, reorderSpacesSchema)
  const result = await reorderSpaces(c.get("db"), c.req.param("vaultId"), {
    ...input,
    actor: requireActor(c),
  })
  return ok(c, result)
})

spaceRoutes.patch("/vaults/:vaultId/spaces/:spaceId", async (c) => {
  const input = await parseJson(c, updateSpaceSchema)
  const result = await updateSpace(
    c.get("db"),
    c.req.param("vaultId"),
    c.req.param("spaceId"),
    {
      ...input,
      actor: requireActor(c),
    }
  )
  return ok(c, result)
})

spaceRoutes.delete("/vaults/:vaultId/spaces/:spaceId", async (c) => {
  const result = await archiveSpace(
    c.get("db"),
    c.req.param("vaultId"),
    c.req.param("spaceId"),
    {
      actor: requireActor(c),
    }
  )
  return ok(c, result)
})

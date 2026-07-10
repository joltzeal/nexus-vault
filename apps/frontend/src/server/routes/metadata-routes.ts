import { Hono } from "hono"

import { requireActor } from "@/server/api/actor"
import { ok } from "@/server/api/response"
import type { ApiEnv } from "@/server/api/types"
import { resolveResourceMetadata } from "@/server/services/metadata-service"

export const metadataRoutes = new Hono<ApiEnv>()

metadataRoutes.post("/resources/:resourceId/metadata/resolve", async (c) => {
  const result = await resolveResourceMetadata(c.get("db"), c.req.param("resourceId"), {
    actor: requireActor(c),
  })
  return ok(c, result)
})

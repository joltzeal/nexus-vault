import { Hono } from "hono"

import { ok } from "@/server/api/response"
import type { ApiEnv } from "@/server/api/types"

export const healthRoutes = new Hono<ApiEnv>()

healthRoutes.get("/health", (c) =>
  ok(c, {
    service: "nexus-vault-api",
    storage: "d1",
  })
)

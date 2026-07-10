import { Hono } from "hono"

import { requireActor } from "@/server/api/actor"
import { ok } from "@/server/api/response"
import type { ApiEnv } from "@/server/api/types"
import {
  getNotificationSummary,
  listNotifications,
  markNotificationRead,
} from "@/server/services/notification-service"

export const notificationRoutes = new Hono<ApiEnv>()

notificationRoutes.get("/notifications", async (c) => {
  const rows = await listNotifications(c.get("db"), {
    actor: requireActor(c),
  })
  return ok(c, { items: rows })
})

notificationRoutes.get("/notifications/summary", async (c) => {
  const summary = await getNotificationSummary(c.get("db"), {
    actor: requireActor(c),
  })
  return ok(c, summary)
})

notificationRoutes.patch("/notifications/:notificationId/read", async (c) => {
  const result = await markNotificationRead(c.get("db"), c.req.param("notificationId"), {
    actor: requireActor(c),
  })
  return ok(c, result)
})

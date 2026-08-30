import { z } from "zod"

import { handleApiRequest, ok, parseJson, requireActor } from "../../../lib/http"
import {
  listNotifications,
  markNotificationsRead,
} from "../../../services/notification-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok({ items: await listNotifications(db, { actor: requireActor(actor) }) }),
  )
}

const markNotificationsReadSchema = z.object({
  notificationIds: z.array(z.string()).max(100).default([]),
})

export function PATCH(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, markNotificationsReadSchema)
    return ok(
      await markNotificationsRead(db, {
        actor: requireActor(actor),
        notificationIds: input.notificationIds,
      }),
    )
  })
}

import { handleApiRequest, ok, requireActor } from "@/server/http"
import { listNotifications } from "@/server/services/notification-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok({ items: await listNotifications(db, { actor: requireActor(actor) }) }),
  )
}

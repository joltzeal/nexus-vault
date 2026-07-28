import { handleApiRequest, ok, requireActor } from "@/server/http"
import { getNotificationSummary } from "@/server/services/notification-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await getNotificationSummary(db, { actor: requireActor(actor) })),
  )
}

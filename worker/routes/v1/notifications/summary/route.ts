import { handleApiRequest, ok, requireActor } from "../../../../lib/http"
import { getNotificationSummary } from "../../../../services/notification-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await getNotificationSummary(db, { actor: requireActor(actor) })),
  )
}

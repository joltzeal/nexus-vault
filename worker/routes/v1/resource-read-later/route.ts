import { handleApiRequest, ok, requireActor } from "../../../lib/http"
import { listReadLaterResources } from "../../../services/resource-interaction-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await listReadLaterResources(db, { actor: requireActor(actor) })),
  )
}

import { handleApiRequest, ok, requireActor } from "../../../lib/http"
import { listStarredResources } from "../../../services/star-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok({ items: await listStarredResources(db, { actor: requireActor(actor) }) }),
  )
}

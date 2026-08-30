import { handleApiRequest, ok, requireActor } from "../../../lib/http"
import { listStarredVaults } from "../../../services/star-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok({ items: await listStarredVaults(db, { actor: requireActor(actor) }) }),
  )
}

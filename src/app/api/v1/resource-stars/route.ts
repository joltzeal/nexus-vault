import { handleApiRequest, ok, requireActor } from "@/server/http"
import { listStarredResources } from "@/server/services/star-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok({ items: await listStarredResources(db, { actor: requireActor(actor) }) }),
  )
}

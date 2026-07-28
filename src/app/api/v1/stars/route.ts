import { handleApiRequest, ok, requireActor } from "@/server/http"
import { listStarredVaults } from "@/server/services/star-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok({ items: await listStarredVaults(db, { actor: requireActor(actor) }) }),
  )
}

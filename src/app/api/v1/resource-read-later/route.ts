import { handleApiRequest, ok, requireActor } from "@/server/http"
import { listReadLaterResources } from "@/server/services/resource-interaction-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await listReadLaterResources(db, { actor: requireActor(actor) })),
  )
}

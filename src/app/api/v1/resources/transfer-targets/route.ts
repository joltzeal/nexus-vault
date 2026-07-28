import { handleApiRequest, ok, requireActor } from "@/server/http"
import { listResourceTransferTargets } from "@/server/services/resource-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await listResourceTransferTargets(db, { actor: requireActor(actor) })),
  )
}

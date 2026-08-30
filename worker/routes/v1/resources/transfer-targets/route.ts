import { handleApiRequest, ok, requireActor } from "../../../../lib/http"
import { listResourceTransferTargets } from "../../../../services/resource-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await listResourceTransferTargets(db, { actor: requireActor(actor) })),
  )
}

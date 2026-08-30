import { handleApiRequest, ok, requireActor } from "../../../../lib/http"
import { listSharedVaults } from "../../../../services/vault-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok({ items: await listSharedVaults(db, { actor: requireActor(actor) }) }),
  )
}

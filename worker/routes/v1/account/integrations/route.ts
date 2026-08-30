import { handleApiRequest, ok, requireActor } from "../../../../lib/http"
import { getAccountIntegrationsSummary } from "../../../../services/account-integration-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await getAccountIntegrationsSummary(db, requireActor(actor).id)),
  )
}

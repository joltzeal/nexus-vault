import { handleApiRequest, ok, requireActor } from "@/server/http"
import { getAccountIntegrationsSummary } from "@/server/services/account-integration-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await getAccountIntegrationsSummary(db, requireActor(actor).id)),
  )
}

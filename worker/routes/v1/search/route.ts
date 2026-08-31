import { handleApiRequest, ok, requireActor } from "../../../lib/http"
import { searchWorkspace } from "../../../services/search-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db, url }) =>
    ok(await searchWorkspace(db, { actor: requireActor(actor), query: url.searchParams.get("q") ?? "" })),
  )
}


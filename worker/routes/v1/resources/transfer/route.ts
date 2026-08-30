import { handleApiRequest, ok, parseJson, requireActor } from "../../../../lib/http"
import { transferResourcesSchema } from "../../../../schemas/resource"
import { transferResources } from "../../../../services/resource-service"

export async function POST(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, transferResourcesSchema)
    return ok(await transferResources(db, { ...input, actor: requireActor(actor) }))
  })
}

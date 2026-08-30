import { handleApiRequest, ok, parseJson, requireActor } from "../../../../../lib/http"
import { transferResourceSchema } from "../../../../../schemas/resource"
import { transferResource } from "../../../../../services/resource-service"

type Context = { params: Promise<{ resourceId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, transferResourceSchema)
    return ok(await transferResource(db, resourceId, { ...input, actor: requireActor(actor) }))
  })
}

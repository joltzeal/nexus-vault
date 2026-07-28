import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { transferResourceSchema } from "@/server/schemas/resource"
import { transferResource } from "@/server/services/resource-service"

type Context = { params: Promise<{ resourceId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, transferResourceSchema)
    return ok(await transferResource(db, resourceId, { ...input, actor: requireActor(actor) }))
  })
}

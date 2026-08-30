import { handleApiRequest, ok, parseJson, requireActor } from "../../../../../../lib/http"
import { reorderResourcesSchema } from "../../../../../../schemas/resource"
import { reorderResources } from "../../../../../../services/resource-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function PATCH(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, reorderResourcesSchema)
    return ok(await reorderResources(db, vaultId, { ...input, actor: requireActor(actor) }))
  })
}

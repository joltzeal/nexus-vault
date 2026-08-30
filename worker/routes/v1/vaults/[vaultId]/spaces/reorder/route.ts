import { handleApiRequest, ok, parseJson, requireActor } from "../../../../../../lib/http"
import { reorderSpacesSchema } from "../../../../../../schemas/space"
import { reorderSpaces } from "../../../../../../services/space-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function PATCH(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, reorderSpacesSchema)
    return ok(await reorderSpaces(db, vaultId, { ...input, actor: requireActor(actor) }))
  })
}

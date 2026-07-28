import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { reorderResourcesSchema } from "@/server/schemas/resource"
import { reorderResources } from "@/server/services/resource-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function PATCH(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, reorderResourcesSchema)
    return ok(await reorderResources(db, vaultId, { ...input, actor: requireActor(actor) }))
  })
}

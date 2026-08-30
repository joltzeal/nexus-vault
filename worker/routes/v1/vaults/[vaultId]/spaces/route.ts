import { handleApiRequest, ok, parseJson, requireActor } from "../../../../../lib/http"
import { createSpaceSchema } from "../../../../../schemas/space"
import { createSpace } from "../../../../../services/space-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, createSpaceSchema)
    return ok(await createSpace(db, vaultId, { ...input, actor: requireActor(actor) }), 201)
  })
}

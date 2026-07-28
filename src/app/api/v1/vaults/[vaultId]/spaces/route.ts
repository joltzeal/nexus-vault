import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { createSpaceSchema } from "@/server/schemas/space"
import { createSpace } from "@/server/services/space-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, createSpaceSchema)
    return ok(await createSpace(db, vaultId, { ...input, actor: requireActor(actor) }), 201)
  })
}

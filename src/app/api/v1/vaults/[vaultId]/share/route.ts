import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { updateShareSchema } from "@/server/schemas/vault"
import { getShare, upsertShare } from "@/server/services/share-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function GET(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok({ share: await getShare(db, vaultId, { actor: requireActor(actor) }) }),
  )
}

export async function PUT(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, updateShareSchema)
    return ok(await upsertShare(db, vaultId, { ...input, actor: requireActor(actor) }))
  })
}

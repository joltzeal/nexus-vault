import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { starSchema } from "@/server/schemas/vault"
import { starVault, unstarVault } from "@/server/services/star-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, starSchema)
    return ok(await starVault(db, vaultId, { ...input, actor: requireActor(actor) }))
  })
}

export async function DELETE(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, starSchema)
    return ok(await unstarVault(db, vaultId, { ...input, actor: requireActor(actor) }))
  })
}

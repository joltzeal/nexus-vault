import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { updateVaultSchema } from "@/server/schemas/vault"
import { archiveVault, getVaultDetail, updateVault } from "@/server/services/vault-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function GET(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, { auth: "optional" }, async ({ actor, db }) =>
    ok(await getVaultDetail(db, vaultId, { actor })),
  )
}

export async function PATCH(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, updateVaultSchema)
    return ok(await updateVault(db, vaultId, { ...input, actor: requireActor(actor) }))
  })
}

export async function DELETE(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await archiveVault(db, vaultId, { actor: requireActor(actor) })),
  )
}

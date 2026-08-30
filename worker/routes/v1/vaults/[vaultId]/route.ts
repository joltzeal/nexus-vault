import { handleApiRequest, ok, parseJson, requireActor } from "../../../../lib/http"
import { updateVaultSchema } from "../../../../schemas/vault"
import { archiveVault, getVaultDetail, updateVault } from "../../../../services/vault-service"
import { isResourceMediaUploadEnabled } from "../../../../services/resource-media-upload-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function GET(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, { auth: "optional" }, async ({ actor, db, env }) =>
    ok({
      ...(await getVaultDetail(db, vaultId, { actor })),
      allowResourceMediaUpload: isResourceMediaUploadEnabled(env),
    }),
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

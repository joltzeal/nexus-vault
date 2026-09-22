import { handleApiRequest, ok, parseJson } from "../../../../../../lib/http"
import { batchVaultResourcesSchema } from "../../../../../../schemas/resource"
import { listVaultResourceBatch } from "../../../../../../services/vault-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, { auth: "optional" }, async ({ actor, db }) => {
    const input = await parseJson(request, batchVaultResourcesSchema)
    return ok(await listVaultResourceBatch(db, vaultId, {
      actor,
      ...input,
    }))
  })
}

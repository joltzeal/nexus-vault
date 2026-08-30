import { handleApiRequest, ok, parseJson, requireActor } from "../../../../lib/http"
import { importVaultSchema } from "../../../../schemas/vault"
import { importVault } from "../../../../services/vault-service"
import { newId } from "../../../../lib/id"

export function POST(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, importVaultSchema)
    const result = await importVault(
      db,
      { data: input.data, actor: requireActor(actor) },
      { vaultId: newId() },
    )
    return ok(result, 201)
  })
}

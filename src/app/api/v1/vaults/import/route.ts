import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { importVaultSchema } from "@/server/schemas/vault"
import { importVault } from "@/server/services/vault-service"
import { newId } from "@/server/utils/id"

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

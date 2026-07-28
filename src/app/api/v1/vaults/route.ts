import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { createVaultSchema } from "@/server/schemas/vault"
import { createVault, listVaults } from "@/server/services/vault-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db, url }) => {
    const items = await listVaults(db, {
      actor: requireActor(actor),
      query: url.searchParams.get("q")?.trim(),
    })
    return ok({ items })
  })
}

export function POST(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, createVaultSchema)
    const result = await createVault(db, { ...input, actor: requireActor(actor) })
    return ok(result, 201)
  })
}

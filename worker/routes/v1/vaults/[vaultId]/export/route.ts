import { handleApiRequest, ok, requireActor } from "../../../../../lib/http"
import { exportVault } from "../../../../../services/vault-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function GET(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await exportVault(db, vaultId, { actor: requireActor(actor) })),
  )
}

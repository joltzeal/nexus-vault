import { handleApiRequest, ok, requireActor } from "@/server/http"
import { exportVault } from "@/server/services/vault-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function GET(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await exportVault(db, vaultId, { actor: requireActor(actor) })),
  )
}

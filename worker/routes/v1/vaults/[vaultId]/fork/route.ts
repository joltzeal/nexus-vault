import { handleApiRequest, ok, requireActor } from "../../../../../lib/http"
import { forkVault } from "../../../../../services/fork-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db }) =>
    ok(await forkVault(db, vaultId, { actor: requireActor(actor) }), 201),
  )
}

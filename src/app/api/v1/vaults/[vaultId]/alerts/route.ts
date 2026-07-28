import { handleApiRequest, ok, requireActor } from "@/server/http"
import { getVaultAlerts } from "@/server/services/alert-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function GET(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async ({ actor, db, url }) =>
    ok(
      await getVaultAlerts(db, vaultId, {
        actor: requireActor(actor),
        includeSubmissions: url.searchParams.get("includeSubmissions") !== "false",
      }),
    ),
  )
}

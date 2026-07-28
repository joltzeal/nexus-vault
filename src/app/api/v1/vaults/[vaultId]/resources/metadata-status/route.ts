import { handleApiRequest, ok } from "@/server/http"
import { listVaultResourceMetadataStatus } from "@/server/services/vault-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function GET(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, { auth: "optional" }, async ({ actor, db, url }) => {
    const resourceIds = (url.searchParams.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 100)

    return ok(await listVaultResourceMetadataStatus(db, vaultId, { actor, resourceIds }))
  })
}

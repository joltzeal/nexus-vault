import { handleApiRequest, ok, parseJson, requireActor } from "../../../../../lib/http"
import { createResourceSchema } from "../../../../../schemas/resource"
import { enqueueMetadataTask } from "../../../../../services/metadata-service"
import { createResource } from "../../../../../services/resource-service"
import { listVaultResources } from "../../../../../services/vault-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function GET(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, { auth: "optional" }, async ({ actor, db }) => {
    const url = new URL(request.url)
    const spaceId = url.searchParams.get("spaceId")?.trim()
    if (!spaceId) throw new Error("spaceId is required.")
    const limit = Number(url.searchParams.get("limit"))
    return ok(await listVaultResources(db, vaultId, {
      actor,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
      spaceId,
    }))
  })
}

export async function POST(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async (context) => {
    const input = await parseJson(request, createResourceSchema)
    const result = await createResource(context.db, vaultId, {
      ...input,
      actor: requireActor(context.actor),
    })
    enqueueMetadataTask(context, result.metadataTask)
    return ok(result, 201)
  })
}

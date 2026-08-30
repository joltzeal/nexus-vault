import { handleApiRequest, ok, parseJson, requireActor } from "../../../../../lib/http"
import { createResourceSchema } from "../../../../../schemas/resource"
import { enqueueMetadataTask } from "../../../../../services/metadata-service"
import { createResource } from "../../../../../services/resource-service"

type Context = { params: Promise<{ vaultId: string }> }

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

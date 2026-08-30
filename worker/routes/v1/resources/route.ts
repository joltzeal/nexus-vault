import { handleApiRequest, ok, parseJson, requireActor } from "../../../lib/http"
import { createResourceWithVaultSchema } from "../../../schemas/resource"
import { createResource } from "../../../services/resource-service"
import { enqueueMetadataTask } from "../../../services/metadata-service"

export function POST(request: Request) {
  return handleApiRequest(request, {}, async (context) => {
    const input = await parseJson(request, createResourceWithVaultSchema)
    const result = await createResource(context.db, input.vaultId, {
      ...input,
      actor: requireActor(context.actor),
    })
    enqueueMetadataTask(context, result.metadataTask)
    return ok(result, 201)
  })
}

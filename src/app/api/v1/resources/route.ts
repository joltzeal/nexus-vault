import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { createResourceWithVaultSchema } from "@/server/schemas/resource"
import { createResource } from "@/server/services/resource-service"
import { enqueueMetadataTask } from "@/server/services/metadata-service"

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

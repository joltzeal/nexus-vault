import { handleApiRequest, ok, parseJson, requireActor } from "../../../lib/http"
import { createResourceSchema } from "../../../schemas/resource"
import { enqueueMetadataTask } from "../../../services/metadata-service"
import { createStashResource, listStashResources, reorderStashResources } from "../../../services/resource-stash-service"
import { z } from "zod"

const reorderSchema = z.object({
  items: z.array(z.object({ id: z.string().trim().min(1), position: z.number().int().min(0) })).min(1),
})

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) => ok(await listStashResources(db, { actor: requireActor(actor) })))
}

export async function POST(request: Request) {
  return handleApiRequest(request, {}, async (context) => {
    const input = await parseJson(request, createResourceSchema.omit({ vaultId: true, spaceId: true }))
    const result = await createStashResource(context.db, { ...input, actor: requireActor(context.actor) })
    enqueueMetadataTask(context, result.metadataTask)
    return ok(result, 201)
  })
}

export async function PATCH(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db }) => {
    const input = await parseJson(request, reorderSchema)
    return ok(await reorderStashResources(db, { ...input, actor: requireActor(actor) }))
  })
}

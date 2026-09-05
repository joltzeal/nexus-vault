import { handleApiRequest, ok, parseJson, requireActor } from "../../../../lib/http"
import { updateResourceSchema } from "../../../../schemas/resource"
import { enqueueMetadataTask } from "../../../../services/metadata-service"
import {
  archiveResource,
  getResourceOrThrow,
  readResource,
  requireResourceReadPermission,
  updateResource,
} from "../../../../services/resource-service"

type Context = { params: Promise<{ resourceId: string }> }

export async function GET(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, { auth: "optional" }, async ({ actor, db }) => {
    const resource = await getResourceOrThrow(db, resourceId)
    await requireResourceReadPermission(db, resource, actor)
    return ok(await readResource(db, resource, actor))
  })
}

export async function PATCH(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, {}, async (context) => {
    const input = await parseJson(request, updateResourceSchema)
    const result = await updateResource(context.db, resourceId, {
      ...input,
      actor: requireActor(context.actor),
    })
    if (result.metadataTask) enqueueMetadataTask(context, result.metadataTask)
    return ok(result)
  })
}

export async function DELETE(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, {}, async ({ actor, db, env }) =>
    ok(await archiveResource(db, resourceId, {
      actor: requireActor(actor),
      media: env.MEDIA,
    })),
  )
}

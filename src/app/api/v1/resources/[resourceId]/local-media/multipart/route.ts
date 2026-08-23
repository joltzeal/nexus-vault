import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { prepareLocalMediaMultipartSchema } from "@/server/schemas/local-media-multipart"
import { prepareUpdatedMediaResource } from "@/server/services/resource-media-upload-service"

type Context = { params: Promise<{ resourceId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, {}, async (context) => {
    const input = await parseJson(request, prepareLocalMediaMultipartSchema)
    const result = await prepareUpdatedMediaResource(context.db, resourceId, {
      actor: requireActor(context.actor),
      env: context.env,
      files: input.files,
    })
    return ok(result, 201)
  })
}

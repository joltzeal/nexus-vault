import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { updateUploadedLocalMediaSchema } from "@/server/schemas/local-media-multipart"
import { updateUploadedMediaResource } from "@/server/services/resource-media-upload-service"

type Context = { params: Promise<{ resourceId: string }> }

export async function PATCH(request: Request, { params }: Context) {
  const { resourceId } = await params
  return handleApiRequest(request, {}, async (context) => {
    const input = await parseJson(request, updateUploadedLocalMediaSchema)
    const result = await updateUploadedMediaResource(context.db, resourceId, {
      actor: requireActor(context.actor),
      description: input.description,
      files: input.files,
      media: context.env.MEDIA,
      order: input.order,
      referer: input.referer,
      spaceId: input.spaceId,
      title: input.title,
    })
    return ok(result)
  })
}

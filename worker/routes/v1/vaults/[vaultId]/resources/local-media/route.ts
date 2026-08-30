import { handleApiRequest, ok, parseJson, requireActor } from "../../../../../../lib/http"
import { createUploadedLocalMediaSchema } from "../../../../../../schemas/local-media-multipart"
import {
  createUploadedMediaResource,
  isResourceMediaUploadEnabled,
} from "../../../../../../services/resource-media-upload-service"
import { forbidden } from "../../../../../../lib/errors"

type Context = { params: Promise<{ vaultId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { vaultId } = await params

  return handleApiRequest(request, {}, async (context) => {
    if (!isResourceMediaUploadEnabled(context.env)) {
      throw forbidden("Resource media upload is disabled.")
    }

    const input = await parseJson(request, createUploadedLocalMediaSchema)

    const result = await createUploadedMediaResource(context.db, vaultId, {
      actor: requireActor(context.actor),
      description: input.description,
      env: context.env,
      files: input.files,
      media: context.env.MEDIA,
      referer: input.referer,
      resourceId: input.resourceId,
      spaceId: input.spaceId,
      title: input.title,
    })

    return ok(result, 201)
  })
}

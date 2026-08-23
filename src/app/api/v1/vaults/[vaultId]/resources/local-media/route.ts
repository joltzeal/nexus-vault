import { handleApiRequest, ok, parseJson, requireActor } from "@/server/http"
import { createUploadedLocalMediaSchema } from "@/server/schemas/local-media-multipart"
import {
  createUploadedMediaResource,
  isResourceMediaUploadEnabled,
} from "@/server/services/resource-media-upload-service"
import { forbidden } from "@/server/api/errors"

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

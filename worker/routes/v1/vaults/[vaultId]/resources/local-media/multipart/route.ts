import { forbidden } from "../../../../../../../lib/errors"
import { handleApiRequest, ok, parseJson, requireActor } from "../../../../../../../lib/http"
import { prepareLocalMediaMultipartSchema } from "../../../../../../../schemas/local-media-multipart"
import {
  isResourceMediaUploadEnabled,
  prepareUploadedMediaResource,
} from "../../../../../../../services/resource-media-upload-service"

type Context = { params: Promise<{ vaultId: string }> }

export async function POST(request: Request, { params }: Context) {
  const { vaultId } = await params
  return handleApiRequest(request, {}, async (context) => {
    if (!isResourceMediaUploadEnabled(context.env)) {
      throw forbidden("Resource media upload is disabled.")
    }

    const input = await parseJson(request, prepareLocalMediaMultipartSchema)
    const result = await prepareUploadedMediaResource(context.db, vaultId, {
      actor: requireActor(context.actor),
      env: context.env,
      files: input.files,
    })
    return ok(result, 201)
  })
}

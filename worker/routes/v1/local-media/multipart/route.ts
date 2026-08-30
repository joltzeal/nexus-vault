import { validationFailed } from "../../../../lib/errors"
import { handleApiRequest, ok, parseJson, requireActor } from "../../../../lib/http"
import {
  abortLocalMediaMultipartSchema,
  completeLocalMediaMultipartSchema,
} from "../../../../schemas/local-media-multipart"
import {
  abortResourceMediaUpload,
  completeResourceMediaUpload,
  signResourceMediaPart,
} from "../../../../services/resource-media-upload-service"

export function GET(request: Request) {
  return handleApiRequest(request, {}, async (context) => {
    const url = new URL(request.url)
    const key = url.searchParams.get("key")?.trim()
    const uploadId = url.searchParams.get("uploadId")?.trim()
    const partNumber = Number(url.searchParams.get("partNumber"))
    if (!key || !uploadId || !Number.isInteger(partNumber)) {
      throw validationFailed({ multipart: ["Invalid multipart upload parameters."] })
    }

    const result = await signResourceMediaPart(context.env, {
      actor: requireActor(context.actor),
      key,
      partNumber,
      uploadId,
    })
    return ok(result)
  })
}

export function POST(request: Request) {
  return handleApiRequest(request, {}, async (context) => {
    const input = await parseJson(request, completeLocalMediaMultipartSchema)
    const result = await completeResourceMediaUpload(context.env, {
      actor: requireActor(context.actor),
      ...input,
    })
    return ok(result)
  })
}

export function DELETE(request: Request) {
  return handleApiRequest(request, {}, async (context) => {
    const input = await parseJson(request, abortLocalMediaMultipartSchema)
    await abortResourceMediaUpload(context.db, context.env, {
      actor: requireActor(context.actor),
      ...input,
    })
    return ok({ deleted: true })
  })
}

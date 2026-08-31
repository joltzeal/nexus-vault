import { handleApiRequest, ok, parseJson, requireActor } from "../../../../../lib/http"
import { signLocalMediaMultipartSchema } from "../../../../../schemas/local-media-multipart"
import { signResourceMediaParts } from "../../../../../services/resource-media-upload-service"

export function POST(request: Request) {
  return handleApiRequest(request, {}, async (context) => {
    const input = await parseJson(request, signLocalMediaMultipartSchema)
    const result = await signResourceMediaParts(context.env, {
      actor: requireActor(context.actor),
      uploads: input.uploads,
    })
    return ok(result)
  })
}

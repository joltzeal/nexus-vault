import { handleApiRequest } from "@/server/http"
import { isPublicMediaObjectKey } from "@/domain/media-storage"
import { getMediaProxyResponse } from "@/server/media-response"

type Context = { params: Promise<{ key: string[] }> }

export async function GET(_request: Request, { params }: Context) {
  const { key } = await params
  const objectKey = key.map(decodeURIComponent).join("/")

  if (!isPublicMediaObjectKey(objectKey)) {
    return new Response("Media not found.", { status: 404 })
  }

  return handleApiRequest(_request, { auth: "none" }, async ({ env }) =>
    getMediaProxyResponse(_request, env.MEDIA, objectKey)
  )
}

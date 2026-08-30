import { handleApiRequest } from "../../../../lib/http"
import { isPublicMediaObjectKey } from "../../../../domain/media-storage"
import { getMediaProxyResponse } from "../../../../storage/media-response"

type Context = { params: Promise<{ key?: string | string[] }> }

export async function GET(_request: Request, { params }: Context) {
  const { key } = await params
  const pathnameKey = new URL(_request.url).pathname.split("/api/v1/media/")[1] ?? ""
  const rawKey = key ?? pathnameKey
  const segments = Array.isArray(rawKey) ? rawKey : rawKey.split("/")
  const objectKey = segments.map(decodeURIComponent).join("/")

  if (!isPublicMediaObjectKey(objectKey)) {
    return new Response("Media not found.", { status: 404 })
  }

  return handleApiRequest(_request, { auth: "none" }, async ({ env }) =>
    getMediaProxyResponse(
      _request,
      env.MEDIA,
      objectKey,
      env.S3_MEDIA_PUBLIC_BASE_URL,
    )
  )
}

import { getCloudflareContext } from "@opennextjs/cloudflare"

type Context = { params: Promise<{ key: string[] }> }

export async function GET(_request: Request, { params }: Context) {
  const { key } = await params
  const objectKey = key.map(decodeURIComponent).join("/")

  if (!objectKey.startsWith("screenshots/")) {
    return new Response("Media not found.", { status: 404 })
  }

  const { env } = await getCloudflareContext({ async: true })
  const object = await env.MEDIA.get(objectKey)
  if (!object) return new Response("Media not found.", { status: 404 })

  const headers = new Headers({
    "cache-control": object.httpMetadata?.cacheControl ?? "public, max-age=31536000, immutable",
    etag: object.httpEtag,
  })
  const metadata = object.httpMetadata

  if (metadata?.contentType) headers.set("content-type", metadata.contentType)
  if (metadata?.contentLanguage) headers.set("content-language", metadata.contentLanguage)
  if (metadata?.contentDisposition) headers.set("content-disposition", metadata.contentDisposition)
  if (metadata?.contentEncoding) headers.set("content-encoding", metadata.contentEncoding)
  if (metadata?.cacheExpiry) headers.set("expires", metadata.cacheExpiry.toUTCString())

  return new Response(object.body, { headers })
}

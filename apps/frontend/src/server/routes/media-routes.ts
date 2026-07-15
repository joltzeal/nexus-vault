import { Hono } from "hono"

import { notFound } from "@/server/api/errors"
import type { ApiEnv } from "@/server/api/types"

export const mediaRoutes = new Hono<ApiEnv>()

mediaRoutes.get("/media/*", async (c) => {
  const key = getMediaKey(c.req.path)
  if (!key || !key.startsWith("screenshots/")) {
    throw notFound("Media not found.")
  }

  if (!c.env.MEDIA) throw notFound("Media not found.")

  const object = await c.env.MEDIA.get(key)
  if (!object) throw notFound("Media not found.")

  const headers = getR2ObjectHeaders(object)

  return new Response(object.body, {
    headers,
    status: 200,
  })
})

function getR2ObjectHeaders(object: R2ObjectBody) {
  const headers: Record<string, string> = {
    "cache-control":
      object.httpMetadata?.cacheControl ?? "public, max-age=31536000, immutable",
    etag: object.httpEtag,
  }
  const metadata = object.httpMetadata

  if (metadata?.contentType) headers["content-type"] = metadata.contentType
  if (metadata?.contentLanguage) headers["content-language"] = metadata.contentLanguage
  if (metadata?.contentDisposition) headers["content-disposition"] = metadata.contentDisposition
  if (metadata?.contentEncoding) headers["content-encoding"] = metadata.contentEncoding
  if (metadata?.cacheExpiry) headers.expires = metadata.cacheExpiry.toUTCString()

  return headers
}

function getMediaKey(path: string) {
  const marker = "/media/"
  const index = path.indexOf(marker)
  if (index === -1) return ""

  return decodeURIComponent(path.slice(index + marker.length))
}

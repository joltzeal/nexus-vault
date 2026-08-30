export async function getMediaProxyResponse(
  request: Request,
  media: R2Bucket,
  objectKey: string,
  publicBaseUrl?: string,
) {
  const range = parseByteRange(request.headers.get("range"))
  const object = await media.get(objectKey, range ? { range } : undefined)
  if (!object) {
    const fallbackUrl = createPublicMediaUrl(publicBaseUrl, objectKey)
    if (fallbackUrl) return Response.redirect(fallbackUrl, 307)
    return new Response("Media not found.", { status: 404 })
  }

  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control": object.httpMetadata?.cacheControl ?? "public, max-age=31536000, immutable",
    etag: object.httpEtag,
  })
  const metadata = object.httpMetadata
  if (metadata?.contentType) headers.set("content-type", metadata.contentType)
  if (metadata?.contentLanguage) headers.set("content-language", metadata.contentLanguage)
  if (metadata?.contentDisposition) headers.set("content-disposition", metadata.contentDisposition)
  if (metadata?.contentEncoding) headers.set("content-encoding", metadata.contentEncoding)
  if (metadata?.cacheExpiry) headers.set("expires", metadata.cacheExpiry.toUTCString())

  const offset = object.range && "offset" in object.range ? object.range.offset : undefined
  const length = object.range && "length" in object.range ? object.range.length : undefined
  if (typeof offset === "number" && typeof length === "number") {
    const end = offset + length - 1
    headers.set("content-length", String(length))
    headers.set("content-range", `bytes ${offset}-${end}/${object.size}`)
    return new Response(object.body, { headers, status: 206 })
  }

  headers.set("content-length", String(object.size))
  return new Response(object.body, { headers })
}

function createPublicMediaUrl(baseUrl: string | undefined, objectKey: string) {
  const normalized = baseUrl?.trim()
  if (!normalized) return undefined
  try {
    const url = new URL(normalized.endsWith("/") ? normalized : `${normalized}/`)
    for (const segment of objectKey.split("/").filter(Boolean)) {
      url.pathname += `${encodeURIComponent(segment)}/`
    }
    url.pathname = url.pathname.replace(/\/$/, "")
    return url.toString()
  } catch {
    return undefined
  }
}

function parseByteRange(value: string | null) {
  if (!value) return undefined

  const match = /^bytes=(\d+)-(\d*)$/i.exec(value.trim())
  if (!match) return undefined

  const offset = Number.parseInt(match[1]!, 10)
  const end = match[2] ? Number.parseInt(match[2], 10) : undefined
  if (!Number.isFinite(offset) || offset < 0) return undefined
  if (end !== undefined && (!Number.isFinite(end) || end < offset)) return undefined

  return end === undefined ? { offset } : { offset, length: end - offset + 1 }
}

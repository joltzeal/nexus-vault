import { eq } from "drizzle-orm"

import { resourceMetadata } from "../../../../../../../db/schema"
import { isPublicMediaObjectKey } from "../../../../../../../domain/media-storage"
import { normalizeResourceMetadata } from "../../../../../../../domain/resources/metadata"
import { ApiError, notFound } from "../../../../../../../lib/errors"
import { handleApiRequest } from "../../../../../../../lib/http"
import { getMediaProxyResponse } from "../../../../../../../storage/media-response"
import { requireVaultRead } from "../../../../../../../services/permission-service"
import { getResourceOrThrow } from "../../../../../../../services/resource-service"

type Context = {
  params: Promise<{ mediaIndex: string; resourceId: string }>
}

const LOCAL_MEDIA_PATH_PREFIX = "/api/v1/media/"
const MAX_REDIRECTS = 4

export async function GET(request: Request, { params }: Context) {
  const { mediaIndex: mediaIndexValue, resourceId } = await params

  return handleApiRequest(request, { auth: "optional" }, async ({ actor, db, env }) => {
    if (!/^\d+$/.test(mediaIndexValue)) throw notFound("Media not found.")
    const mediaIndex = Number.parseInt(mediaIndexValue, 10)
    const resource = await getResourceOrThrow(db, resourceId)
    await requireVaultRead(db, { actor, vaultId: resource.vaultId })

    const [row] = await db
      .select({ dataJson: resourceMetadata.dataJson })
      .from(resourceMetadata)
      .where(eq(resourceMetadata.resourceId, resourceId))
      .limit(1)
    const metadata = normalizeResourceMetadata(row?.dataJson)
    const media = metadata?.media?.[mediaIndex]
    const sourceUrl = getMediaSourceUrl(media)
    if (!sourceUrl) throw notFound("Media not found.")

    const fileName = getDownloadFileName(resource.title, media, sourceUrl, mediaIndex)
    const requestUrl = new URL(request.url)
    const targetUrl = new URL(sourceUrl, requestUrl)
    const localMediaKey = getLocalMediaObjectKey(targetUrl, requestUrl)

    if (localMediaKey) {
      const response = await getMediaProxyResponse(request, env.MEDIA, localMediaKey)
      if (response.status === 404) throw notFound("Media not found.")
      return withDownloadHeaders(response, fileName)
    }

    if (targetUrl.origin === requestUrl.origin) {
      if (targetUrl.pathname === requestUrl.pathname) throw notFound("Media not found.")
      return Response.redirect(targetUrl.toString(), 302)
    }
    if (!isSafeExternalMediaUrl(targetUrl, requestUrl.origin)) {
      throw notFound("Media not found.")
    }

    const response = await fetchExternalMedia(
      targetUrl,
      request.headers.get("range"),
      requestUrl.origin,
    )
    if (!response.ok && response.status !== 206) {
      throw new ApiError(
        "MEDIA_DOWNLOAD_FAILED",
        `Media source returned HTTP ${response.status}.`,
        502,
      )
    }

    return withDownloadHeaders(response, fileName)
  })
}

function getMediaSourceUrl(value: unknown) {
  if (!value || typeof value !== "object") return undefined
  const item = value as Record<string, unknown>
  for (const candidate of [item.url, item.thumbnailUrl]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim()
  }
  return undefined
}

function getLocalMediaObjectKey(targetUrl: URL, requestUrl: URL) {
  if (
    targetUrl.origin !== requestUrl.origin ||
    !targetUrl.pathname.startsWith(LOCAL_MEDIA_PATH_PREFIX)
  ) {
    return undefined
  }

  try {
    const key = targetUrl.pathname
      .slice(LOCAL_MEDIA_PATH_PREFIX.length)
      .split("/")
      .map(decodeURIComponent)
      .join("/")
    return isPublicMediaObjectKey(key) ? key : undefined
  } catch {
    return undefined
  }
}

async function fetchExternalMedia(
  initialUrl: URL,
  range: string | null,
  blockedOrigin: string,
) {
  let targetUrl = initialUrl

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const headers = new Headers({ accept: "*/*" })
    if (range) headers.set("range", range)
    const response = await fetch(targetUrl, {
      headers,
      redirect: "manual",
    })
    if (response.status < 300 || response.status >= 400) return response

    const location = response.headers.get("location")
    if (!location || redirectCount === MAX_REDIRECTS) {
      throw new ApiError("MEDIA_DOWNLOAD_FAILED", "Media source redirect failed.", 502)
    }
    const nextUrl = new URL(location, targetUrl)
    if (!isSafeExternalMediaUrl(nextUrl, blockedOrigin)) {
      throw notFound("Media not found.")
    }
    targetUrl = nextUrl
  }

  throw new ApiError("MEDIA_DOWNLOAD_FAILED", "Media source redirect failed.", 502)
}

function isSafeExternalMediaUrl(url: URL, blockedOrigin: string) {
  if (url.protocol !== "https:" || url.origin === blockedOrigin) return false
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "")
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    return false
  }

  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const octets = ipv4.slice(1).map(Number)
    if (octets.some((octet) => octet > 255)) return false
    const [first, second] = octets
    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    )
  }

  return !(
    hostname === "::" ||
    hostname === "::1" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("fe8") ||
    hostname.startsWith("fe9") ||
    hostname.startsWith("fea") ||
    hostname.startsWith("feb") ||
    hostname.startsWith("::ffff:")
  )
}

function withDownloadHeaders(response: Response, fileName: string) {
  const headers = new Headers()
  for (const name of [
    "accept-ranges",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
  ]) {
    const value = response.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set("cache-control", "private, no-store")
  headers.set("content-disposition", formatContentDisposition(fileName))
  return new Response(response.body, { headers, status: response.status })
}

function formatContentDisposition(fileName: string) {
  const asciiName = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
  const encodedName = encodeURIComponent(fileName).replace(/[!'()*]/g, (value) =>
    `%${value.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`
}

function getDownloadFileName(
  resourceTitle: string,
  media: unknown,
  sourceUrl: string,
  index: number,
) {
  const item = media && typeof media === "object"
    ? media as Record<string, unknown>
    : {}
  const persistedName = typeof item.fileName === "string" ? item.fileName.trim() : ""
  const urlName = getUrlFileName(sourceUrl)
  const extension = getMediaExtension(item)
  const fallbackName = `${resourceTitle.trim() || "resource"}-${index + 1}${extension}`
  const resolvedName = persistedName || urlName || fallbackName
  const fileName = extension && !/\.[a-z0-9]{1,8}$/i.test(resolvedName)
    ? `${resolvedName}${extension}`
    : resolvedName
  return sanitizeFileName(fileName)
}

function getUrlFileName(url: string) {
  try {
    const segments = new URL(url, "https://nexus-vault.local").pathname
      .split("/")
      .filter(Boolean)
    const value = segments[segments.length - 1]
    return value ? decodeURIComponent(value) : ""
  } catch {
    return ""
  }
}

function getMediaExtension(item: Record<string, unknown>) {
  const mimeType = typeof item.mimeType === "string" ? item.mimeType.toLowerCase() : ""
  const mimeExtensions: Record<string, string> = {
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
  }
  if (mimeExtensions[mimeType]) return mimeExtensions[mimeType]
  if (item.kind === "image") return ".jpg"
  if (item.kind === "video") return ".mp4"
  if (item.kind === "audio") return ".mp3"
  return ""
}

function sanitizeFileName(value: string) {
  const withoutControlCharacters = Array.from(value, (character) =>
    character.charCodeAt(0) <= 0x1f ? "_" : character,
  ).join("")
  const sanitized = withoutControlCharacters
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
  return (sanitized || "media").slice(0, 180)
}

import {
  createBaseResourceMetadata,
  type ResourceMediaMetadata,
} from "@/domain/resources/metadata"
import { parseDouyinLink } from "@/domain/resources/input"

import type { MetadataProvider } from "../metadata-provider"
import { resolveSnapDouyinMetadata } from "./snapdouyin"

type DouyinPageMetadata = {
  canonicalUrl: string
  description?: string
  imageUrl?: string
  source: "html" | "json" | "fallback"
  title?: string
  videoId?: string
  videoUrl?: string
  warning?: string
}

export const douyinMetadataProvider: MetadataProvider = {
  name: "douyin",
  supports: (resource) =>
    resource.type === "douyin" || parseDouyinLink(resource.url) !== null,
  async resolve(resource) {
    const parsed = parseDouyinLink(resource.url)
    const baseMetadata = createBaseResourceMetadata({
      type: "douyin",
      title: resource.title,
    })

    if (!parsed) {
      return {
        provider: "douyin",
        status: "failed",
        data: baseMetadata,
        errorMessage: "Invalid Douyin URL.",
      }
    }

    const snapdouyinResult = await resolveSnapDouyinMetadata(resource, parsed).catch((error) => ({
      errorMessage:
        error instanceof Error ? error.message : "SnapDouyin metadata request failed.",
    }))
    if (
      "status" in snapdouyinResult &&
      snapdouyinResult.status === "completed" &&
      Array.isArray(snapdouyinResult.data.media) &&
      snapdouyinResult.data.media.length > 0
    ) {
      return snapdouyinResult
    }

    const fetchedAt = new Date().toISOString()
    const page = await fetchDouyinPageMetadata(parsed.url)
    const title = normalizeTitle(page.title) || resource.title || "抖音视频"
    const description = normalizeDescription(page.description)
    const media = getDouyinMedia(page)

    return {
      provider: "douyin",
      status: "completed",
      data: {
        ...createBaseResourceMetadata({
          type: "douyin",
          title,
          fetchedAt,
        }),
        title,
        ...(description ? { description } : {}),
        ...(media ? { media } : {}),
        identifiers: {
          ...(parsed.videoId ? { videoId: parsed.videoId } : {}),
          ...(page.videoId ? { awemeId: page.videoId } : {}),
          ...(parsed.shareCode ? { shareCode: parsed.shareCode } : {}),
        },
        source: {
          name: "douyin",
          url: page.canonicalUrl || parsed.url,
        },
        extra: {
          douyin: {
            host: parsed.host,
            metadataSource: page.source,
            ...("errorMessage" in snapdouyinResult
              ? { snapdouyinWarning: snapdouyinResult.errorMessage }
              : {}),
            ...(page.warning ? { warning: page.warning } : {}),
          },
        },
      },
    }
  },
}

async function fetchDouyinPageMetadata(url: string): Promise<DouyinPageMetadata> {
  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    })
    const canonicalUrl = response.url || url

    if (!response.ok) {
      return {
        canonicalUrl,
        source: "fallback",
        warning: `Douyin page request failed with HTTP ${response.status}.`,
      }
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
    if (contentType && !contentType.includes("html")) {
      return {
        canonicalUrl,
        source: "fallback",
        warning: `Douyin page request returned ${contentType}.`,
      }
    }

    const html = await response.text()
    const htmlMetadata = extractHtmlMetadata(html, canonicalUrl)
    const jsonMetadata = extractRenderDataMetadata(html)

    return {
      canonicalUrl: htmlMetadata.canonicalUrl || canonicalUrl,
      description: jsonMetadata.description || htmlMetadata.description,
      imageUrl: jsonMetadata.imageUrl || htmlMetadata.imageUrl,
      source: jsonMetadata.source ?? htmlMetadata.source,
      title: jsonMetadata.title || htmlMetadata.title,
      videoId: jsonMetadata.videoId || extractDouyinId(canonicalUrl),
      videoUrl: jsonMetadata.videoUrl || htmlMetadata.videoUrl,
    }
  } catch (error) {
    return {
      canonicalUrl: url,
      source: "fallback",
      warning: error instanceof Error ? error.message : "Douyin page request failed.",
    }
  }
}

function extractHtmlMetadata(html: string, fallbackUrl: string): DouyinPageMetadata {
  const title =
    getMetaContent(html, "property", "og:title") ||
    getMetaContent(html, "name", "twitter:title") ||
    extractHtmlTitle(html)
  const description =
    getMetaContent(html, "property", "og:description") ||
    getMetaContent(html, "name", "description") ||
    getMetaContent(html, "name", "twitter:description")
  const imageUrl =
    getMetaContent(html, "property", "og:image") ||
    getMetaContent(html, "name", "twitter:image")
  const videoUrl =
    getMetaContent(html, "property", "og:video") ||
    getMetaContent(html, "property", "og:video:url") ||
    getMetaContent(html, "property", "og:video:secure_url")
  const canonicalUrl = extractCanonicalUrl(html, fallbackUrl)

  return {
    canonicalUrl,
    description: description ? decodeHtmlEntities(description) : undefined,
    imageUrl: normalizeAbsoluteUrl(imageUrl, canonicalUrl),
    source: title || description || imageUrl || videoUrl ? "html" : "fallback",
    title: title ? decodeHtmlEntities(title) : undefined,
    videoId: extractDouyinId(canonicalUrl),
    videoUrl: normalizeAbsoluteUrl(videoUrl, canonicalUrl),
  }
}

function extractRenderDataMetadata(html: string): Partial<DouyinPageMetadata> & { source?: "json" } {
  const payloads = [
    html.match(/<script[^>]+id=["']RENDER_DATA["'][^>]*>([\s\S]*?)<\/script>/i)?.[1],
    html.match(/<script[^>]+id=["']SIGI_STATE["'][^>]*>([\s\S]*?)<\/script>/i)?.[1],
  ].filter((value): value is string => Boolean(value))

  for (const payload of payloads) {
    const parsed = parseJsonPayload(payload)
    if (!parsed) continue

    const title = findStringByKey(parsed, ["desc", "description", "title"])
    const imageUrl = findStringByKey(parsed, [
      "cover",
      "coverUrl",
      "dynamicCover",
      "originCover",
      "poster",
      "thumbnail",
    ])
    const videoUrl = findStringByKey(parsed, [
      "playAddr",
      "playUrl",
      "downloadAddr",
      "videoUrl",
      "src",
    ])
    const videoId = findStringByKey(parsed, ["awemeId", "aweme_id", "itemId", "item_id"])

    if (title || imageUrl || videoUrl || videoId) {
      return {
        description: title,
        imageUrl: normalizeUrlLikeValue(imageUrl),
        source: "json",
        title,
        videoId,
        videoUrl: normalizeUrlLikeValue(videoUrl),
      }
    }
  }

  return {}
}

function getDouyinMedia(page: DouyinPageMetadata): ResourceMediaMetadata[] | undefined {
  const media: ResourceMediaMetadata[] = []

  if (page.videoUrl) {
    media.push({
      kind: "video",
      provider: "douyin",
      ...(page.videoId ? { sourceId: page.videoId } : {}),
      sourceUrl: page.canonicalUrl,
      url: page.videoUrl,
      ...(page.imageUrl ? { thumbnailUrl: page.imageUrl } : {}),
      mimeType: "video/mp4",
    })
  } else if (page.imageUrl) {
    media.push({
      kind: "image",
      provider: "douyin",
      ...(page.videoId ? { sourceId: page.videoId } : {}),
      sourceUrl: page.canonicalUrl,
      url: page.imageUrl,
      thumbnailUrl: page.imageUrl,
    })
  }

  return media.length > 0 ? media : undefined
}

function getMetaContent(html: string, attrName: "name" | "property", attrValue: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const tag of tags) {
    const attrs = parseTagAttributes(tag)
    if (attrs[attrName]?.toLowerCase() === attrValue.toLowerCase() && attrs.content) {
      return attrs.content.trim()
    }
  }

  return undefined
}

function parseTagAttributes(tag: string) {
  const attrs: Record<string, string> = {}
  const matches = tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)
  for (const match of matches) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? ""
  }
  return attrs
}

function extractHtmlTitle(html: string) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  return title ? decodeHtmlEntities(title).replace(/\s+/g, " ").trim() : undefined
}

function extractCanonicalUrl(html: string, fallbackUrl: string) {
  const links = html.match(/<link\b[^>]*>/gi) ?? []
  for (const link of links) {
    const attrs = parseTagAttributes(link)
    if (attrs.rel?.toLowerCase() === "canonical" && attrs.href) {
      return normalizeAbsoluteUrl(attrs.href, fallbackUrl) ?? fallbackUrl
    }
  }

  return fallbackUrl
}

function parseJsonPayload(value: string) {
  const normalized = decodeHtmlEntities(value.trim())
  const candidates = [normalized]

  try {
    candidates.push(decodeURIComponent(normalized))
  } catch {
    // Keep the original JSON payload candidate.
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown
    } catch {
      // Try the next candidate.
    }
  }

  return null
}

function findStringByKey(value: unknown, keys: string[], seen = new Set<unknown>()): string | undefined {
  if (!value || typeof value !== "object") return undefined
  if (seen.has(value)) return undefined
  seen.add(value)

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKey(item, keys, seen)
      if (found) return found
    }
    return undefined
  }

  const record = value as Record<string, unknown>
  for (const key of keys) {
    const candidate = record[key]
    const stringValue = getStringFromUnknown(candidate)
    if (stringValue) return stringValue
  }

  for (const candidate of Object.values(record)) {
    const found = findStringByKey(candidate, keys, seen)
    if (found) return found
  }

  return undefined
}

function getStringFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined
  if (Array.isArray(value)) {
    return value.map(getStringFromUnknown).find(Boolean)
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    return getStringFromUnknown(record.url_list) ||
      getStringFromUnknown(record.urlList) ||
      getStringFromUnknown(record.urls) ||
      getStringFromUnknown(record.url)
  }
  return undefined
}

function normalizeUrlLikeValue(value?: string) {
  if (!value) return undefined
  const normalized = value
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .trim()
  if (!/^https?:\/\//i.test(normalized)) return undefined
  return normalized
}

function normalizeAbsoluteUrl(value: string | undefined, baseUrl: string) {
  if (!value) return undefined
  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString()
  } catch {
    return normalizeUrlLikeValue(value)
  }
}

function normalizeTitle(value?: string) {
  const title = value?.replace(/\s+/g, " ").trim()
  if (!title) return undefined
  return title.replace(/[-_ ]*抖音$/i, "").trim().slice(0, 200) || title.slice(0, 200)
}

function normalizeDescription(value?: string) {
  const description = value?.replace(/\s+/g, " ").trim()
  if (!description) return undefined
  return description.slice(0, 5000)
}

function extractDouyinId(value: string) {
  try {
    const url = new URL(value)
    const segments = url.pathname.split("/").filter(Boolean)
    const index = segments.findIndex((segment) =>
      ["video", "note"].includes(segment.toLowerCase())
    )
    const id = index >= 0 ? segments[index + 1] : undefined
    return id && /^\d+$/.test(id) ? id : undefined
  } catch {
    return undefined
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const numeric = Number(code)
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : ""
    })
    .replace(/&#x([a-f0-9]+);/gi, (_, code: string) => {
      const numeric = Number.parseInt(code, 16)
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : ""
    })
}

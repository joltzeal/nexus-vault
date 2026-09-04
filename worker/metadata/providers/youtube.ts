import { parseYoutubeVideoLink } from "../../domain/resources/input"
import {
  createBaseResourceMetadata,
  type ResourceMediaMetadata,
} from "../../domain/resources/metadata"

import {
  RetryableMetadataError,
  type MetadataProvider,
  type MetadataProviderResource,
  type MetadataResult,
} from "../metadata-provider"

export const YOUTUBE_METADATA_PROVIDER = "youtube"
const OEMBED_ENDPOINT = "https://www.youtube.com/oembed"
const WATCH_PAGE_URL = "https://www.youtube.com/watch"
// The consent cookies keep youtube.com from redirecting Workers to consent.youtube.com.
const WATCH_PAGE_HEADERS: Record<string, string> = {
  "accept": "text/html,application/xhtml+xml",
  "accept-language": "en-US,en;q=0.9",
  "cookie": "CONSENT=YES+cb; SOCS=CAI",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
}

export const youtubeMetadataProvider: MetadataProvider = {
  name: YOUTUBE_METADATA_PROVIDER,
  supports(resource) {
    return resource.type === "youtube" || parseYoutubeVideoLink(resource.url) !== null
  },
  async resolve(resource, options) {
    const parsed = parseYoutubeVideoLink(resource.url)
    const baseMetadata = createBaseResourceMetadata({ type: "youtube", title: resource.title })

    if (!parsed) {
      return {
        provider: YOUTUBE_METADATA_PROVIDER,
        status: "failed",
        data: baseMetadata,
        errorMessage: "Invalid YouTube video URL. Only video links are supported.",
      }
    }

    const [oembed, page] = await Promise.all([
      fetchOEmbed(parsed.url),
      fetchWatchPageData(parsed.videoId),
    ])

    if (!oembed.data && !page.data) {
      const retryable = [...(oembed.retryableError ? [oembed.retryableError] : []), ...(page.retryableError ? [page.retryableError] : [])]
      if (retryable.length > 0 && options?.retryTransient) {
        throw new RetryableMetadataError(retryable.join(" "))
      }
      return {
        provider: YOUTUBE_METADATA_PROVIDER,
        status: "failed",
        data: baseMetadata,
        errorMessage:
          retryable.join(" ") ||
          "YouTube video is unavailable. It may be private, removed, or region-locked.",
      }
    }

    return createVideoMetadataResult(resource, parsed.videoId, oembed.data, page.data)
  },
}

async function fetchOEmbed(url: string) {
  const endpoint = new URL(OEMBED_ENDPOINT)
  endpoint.searchParams.set("url", url)
  endpoint.searchParams.set("format", "json")

  try {
    const response = await fetch(endpoint, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) {
      return {
        retryableError: isTransientHttpResponse(response)
          ? `YouTube oEmbed request failed with HTTP ${response.status}.`
          : undefined,
      }
    }
    const payload: unknown = await response.json()
    return { data: isRecord(payload) ? payload : undefined }
  } catch (error) {
    console.warn("YouTube oEmbed request failed", { url, error })
    return { retryableError: isTransientNetworkError(error) ? getErrorMessage(error) : undefined }
  }
}

async function fetchWatchPageData(videoId: string) {
  const endpoint = new URL(WATCH_PAGE_URL)
  endpoint.searchParams.set("v", videoId)
  endpoint.searchParams.set("hl", "en")

  try {
    const response = await fetch(endpoint, {
      headers: WATCH_PAGE_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) {
      return {
        retryableError: isTransientHttpResponse(response)
          ? `YouTube watch page request failed with HTTP ${response.status}.`
          : undefined,
      }
    }

    const html = await response.text()
    const playerResponse = extractAssignedJson(html, "ytInitialPlayerResponse")
    const initialData = extractAssignedJson(html, "ytInitialData")

    return {
      data: {
        channel: extractChannelInfo(initialData),
        playerResponse,
      },
    }
  } catch (error) {
    console.warn("YouTube watch page request failed", { videoId, error })
    return { retryableError: isTransientNetworkError(error) ? getErrorMessage(error) : undefined }
  }
}

function createVideoMetadataResult(
  resource: MetadataProviderResource,
  videoId: string,
  oembed: Record<string, unknown> | undefined,
  page:
    | {
        channel?: YoutubeChannelInfo
        playerResponse?: Record<string, unknown>
      }
    | undefined,
): MetadataResult {
  const playerResponse = page?.playerResponse
  const videoDetails = recordValue(playerResponse?.videoDetails) ?? {}
  const microformat = recordValue(
    recordValue(playerResponse?.microformat)?.playerMicroformatRenderer,
  ) ?? {}
  const liveBroadcast = recordValue(microformat.liveBroadcastDetails) ?? {}

  const title = normalizeTitle(
    firstString(videoDetails.title, oembed?.title, resource.title),
  ) || "YouTube video"
  const description = normalizeMultilineText(
    firstString(videoDetails.shortDescription, recordValue(microformat.description)?.simpleText),
  )
  const authorName = firstString(videoDetails.author, oembed?.author_name)
  const channelId = firstString(videoDetails.channelId)
  const channelUrl = firstString(oembed?.author_url) ??
    (channelId ? `https://www.youtube.com/channel/${channelId}` : undefined)
  const thumbnailUrl = getThumbnailUrl(videoId, videoDetails, microformat, oembed)
  const duration = numberValue(Number(firstString(videoDetails.lengthSeconds, microformat.lengthSeconds)))
  const views = numberValue(Number(firstString(microformat.viewCount, videoDetails.viewCount)))
  const publishedAt = toIso(firstString(microformat.publishDate, microformat.uploadDate))
  const isLive = liveBroadcast.isLiveNow === true || videoDetails.isLive === true
  const subscribersText = page?.channel?.subscribersText

  const media: ResourceMediaMetadata[] = thumbnailUrl
    ? [{
        kind: "image",
        provider: YOUTUBE_METADATA_PROVIDER,
        sourceId: `thumb:${videoId}`,
        sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
        url: thumbnailUrl,
        thumbnailUrl,
        metadata: { mediaType: "thumbnail" },
      }]
    : []

  return {
    provider: YOUTUBE_METADATA_PROVIDER,
    status: "completed",
    data: {
      ...createBaseResourceMetadata({ type: "youtube", title }),
      title,
      ...(description ? { description } : {}),
      ...(media.length > 0 ? { media } : {}),
      identifiers: {
        videoId,
        ...(channelId ? { channelId } : {}),
      },
      source: {
        name: "youtube",
        url: `https://www.youtube.com/watch?v=${videoId}`,
      },
      preview: {
        kind: "youtube_video",
        data: {
          videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title,
          ...(description ? { description } : {}),
          ...(thumbnailUrl ? { thumbnailUrl } : {}),
          ...(typeof duration === "number" ? { duration } : {}),
          ...(typeof views === "number" ? { views } : {}),
          ...(publishedAt ? { publishedAt } : {}),
          ...(authorName ? { channelName: authorName } : {}),
          ...(channelId ? { channelId } : {}),
          ...(channelUrl ? { channelUrl } : {}),
          ...(page?.channel?.avatarUrl ? { channelAvatarUrl: page.channel.avatarUrl } : {}),
          ...(subscribersText ? { subscribersText } : {}),
          ...(isLive ? { isLive } : {}),
          ...(firstString(microformat.category) ? { category: firstString(microformat.category) } : {}),
        },
      },
      extra: {
        youtube: {
          api: OEMBED_ENDPOINT,
          ...(videoId ? { videoId } : {}),
          ...(channelId ? { channelId } : {}),
          ...(authorName ? { channelName: authorName } : {}),
          ...(typeof duration === "number" ? { duration } : {}),
          ...(typeof views === "number" ? { views } : {}),
          ...(isLive ? { isLive } : {}),
        },
      },
    },
  }
}

type YoutubeChannelInfo = {
  avatarUrl?: string
  subscribersText?: string
}

function extractChannelInfo(initialData: Record<string, unknown> | undefined): YoutubeChannelInfo {
  if (!initialData) return {}

  const dataHtml = JSON.stringify(initialData)
  const avatarRenderer = findFirstValueObject(dataHtml, "channelThumbnailWithLinkRenderer")
  const avatarUrl = avatarRenderer
    ? getLargestThumbnailUrl(recordValue(avatarRenderer.thumbnail)?.thumbnails)
    : undefined
  const subscribersMatch = dataHtml.match(/"subscriberCountText":\{"simpleText":"([^"]+)"/)

  return {
    ...(avatarUrl ? { avatarUrl } : {}),
    ...(subscribersMatch?.[1] ? { subscribersText: subscribersMatch[1] } : {}),
  }
}

function getThumbnailUrl(
  videoId: string,
  videoDetails: Record<string, unknown>,
  microformat: Record<string, unknown>,
  oembed: Record<string, unknown> | undefined,
) {
  const playerThumbnails = getLargestThumbnailUrl(
    recordValue(videoDetails.thumbnail)?.thumbnails,
  )
  const microThumbnails = getLargestThumbnailUrl(
    recordValue(microformat.thumbnail)?.thumbnails,
  )
  return (
    playerThumbnails ||
    microThumbnails ||
    firstString(oembed?.thumbnail_url) ||
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  )
}

function getLargestThumbnailUrl(value: unknown) {
  const thumbnails = Array.isArray(value) ? value : []
  let best: { height?: number; url?: string } | undefined
  for (const item of thumbnails) {
    const record = recordValue(item)
    const url = firstString(record?.url)
    if (!url) continue
    const height = numberValue(record?.height) ?? 0
    if (!best || height >= (best.height ?? 0)) best = { height, url }
  }
  return best?.url
}

/**
 * YouTube embeds page data as `var ytInitialPlayerResponse = {...};`. Extract the
 * first balanced JSON object after each assignment until one parses successfully.
 */
function extractAssignedJson(
  html: string,
  variableName: string,
): Record<string, unknown> | undefined {
  const pattern = new RegExp(`${variableName}\\s*=`, "g")
  for (const match of html.matchAll(pattern)) {
    const json = extractBalancedJson(html, match.index + match[0].length)
    if (!json) continue
    try {
      const parsed: unknown = JSON.parse(json)
      if (isRecord(parsed)) return parsed
    } catch {
      // Try the next assignment occurrence.
    }
  }
  return undefined
}

function extractBalancedJson(html: string, fromIndex: number) {
  const start = html.indexOf("{", fromIndex)
  if (start === -1) return undefined

  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < html.length; index++) {
    const char = html[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === "{") depth++
    else if (char === "}") {
      depth--
      if (depth === 0) return html.slice(start, index + 1)
    }
  }
  return undefined
}

function findFirstValueObject(html: string, key: string) {
  const keyIndex = html.indexOf(`"${key}":`)
  if (keyIndex === -1) return undefined
  const json = extractBalancedJson(html, keyIndex + key.length + 1)
  try {
    return json ? (JSON.parse(json) as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

function toIso(value?: string) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/** Keep the author's line breaks; only trim each line and squeeze blank runs. */
function normalizeMultilineText(value?: string) {
  if (!value) return undefined
  const normalized = value
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return normalized.slice(0, 5_000) || undefined
}

function normalizeTitle(value?: string) {
  return value?.replace(/\s+/g, " ").trim().slice(0, 200) || undefined
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return undefined
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function recordValue(value: unknown) {
  return isRecord(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isTransientHttpResponse(response: Response) {
  return (
    response.status === 408 ||
    response.status === 425 ||
    response.status === 429 ||
    response.status >= 500
  )
}

function isTransientNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    error instanceof TypeError ||
    /\b(timeout|timed out|network|fetch|econn|enotfound|eai_again)\b/.test(message)
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Network request failed."
}

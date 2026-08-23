import {
  createBaseResourceMetadata,
  type ResourceMediaMetadata,
} from "@/domain/resources/metadata"
import { parseDouyinLink, type ParsedDouyinLink } from "@/domain/resources/input"

import type {
  MetadataProvider,
  MetadataProviderResource,
  MetadataResult,
} from "../metadata-provider"

const SNAPDOUYIN_BASE_URL = "https://snapdouyin.app/"
const SNAPDOUYIN_API_URL = "https://snapdouyin.app/wp-json/mx-downloader/video-data/"
const SNAPDOUYIN_HASH_SALT = "aio-dl"
const SNAPDOUYIN_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"

type SnapDouyinResponse = {
  duration?: unknown
  medias?: unknown
  source?: unknown
  thumbnail?: unknown
  title?: unknown
  url?: unknown
}

export const snapdouyinMetadataProvider: MetadataProvider = {
  name: "snapdouyin",
  supports: (resource) =>
    resource.type === "douyin" || parseDouyinLink(resource.url) !== null,
  async resolve(resource) {
    const parsed = parseDouyinLink(resource.url)
    if (!parsed) {
      return {
        provider: "snapdouyin",
        status: "failed",
        data: createBaseResourceMetadata({
          type: "douyin",
          title: resource.title,
        }),
        errorMessage: "Invalid Douyin URL.",
      }
    }

    return resolveSnapDouyinMetadata(resource, parsed)
  },
}

export async function resolveSnapDouyinMetadata(
  resource: MetadataProviderResource,
  parsed: ParsedDouyinLink,
): Promise<MetadataResult> {
  const token = await fetchSnapDouyinToken()
  const payload = await fetchSnapDouyinVideoData(resource.url, token)
  const title = normalizeText(getString(payload.title)) || resource.title || "抖音视频"
  const description = normalizeText(getString(payload.title))
  const thumbnailUrl = normalizeUrl(getString(payload.thumbnail))
  const medias = getSnapDouyinMedia(payload, {
    parsed,
    sourceUrl: getString(payload.url) || resource.url,
    thumbnailUrl,
  })
  const fetchedAt = new Date().toISOString()

  return {
    provider: "snapdouyin",
    status: "completed",
    data: {
      ...createBaseResourceMetadata({
        type: "douyin",
        title,
        fetchedAt,
      }),
      title,
      ...(description ? { description } : {}),
      ...(medias.length > 0 ? { media: medias } : {}),
      identifiers: {
        ...(parsed.videoId ? { videoId: parsed.videoId } : {}),
        ...(parsed.shareCode ? { shareCode: parsed.shareCode } : {}),
      },
      source: {
        name: "snapdouyin",
        url: getString(payload.url) || resource.url,
        attribution: {
          label: "SnapDouyin",
          url: SNAPDOUYIN_BASE_URL,
        },
      },
      extra: {
        douyin: {
          duration: getString(payload.duration),
          host: parsed.host,
          metadataSource: "snapdouyin",
          source: getString(payload.source),
        },
      },
    },
  }
}

async function fetchSnapDouyinToken() {
  const response = await fetch(SNAPDOUYIN_BASE_URL, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
      "user-agent": SNAPDOUYIN_USER_AGENT,
    },
    signal: AbortSignal.timeout(12_000),
  })

  if (!response.ok) {
    throw new Error(`SnapDouyin token request failed with HTTP ${response.status}.`)
  }

  const html = await response.text()
  const token = extractSnapDouyinToken(html)
  if (!token) {
    throw new Error("SnapDouyin token was not found.")
  }

  return token
}

async function fetchSnapDouyinVideoData(url: string, token: string): Promise<SnapDouyinResponse> {
  const body = new URLSearchParams()
  body.set("url", url)
  body.set("token", token)
  body.set("hash", calculateHash(url, SNAPDOUYIN_HASH_SALT))

  const response = await fetch(SNAPDOUYIN_API_URL, {
    method: "POST",
    headers: {
      accept: "*/*",
      "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
      "content-type": "application/x-www-form-urlencoded",
      origin: SNAPDOUYIN_BASE_URL.replace(/\/$/, ""),
      referer: SNAPDOUYIN_BASE_URL,
      "user-agent": SNAPDOUYIN_USER_AGENT,
    },
    body,
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    throw new Error(`SnapDouyin video-data request failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as unknown
  if (!isRecord(payload)) {
    throw new Error("SnapDouyin returned an invalid response.")
  }

  return payload
}

function getSnapDouyinMedia(
  payload: SnapDouyinResponse,
  input: {
    parsed: ParsedDouyinLink
    sourceUrl: string
    thumbnailUrl?: string
  },
) {
  if (!Array.isArray(payload.medias)) return []

  const media: ResourceMediaMetadata[] = []
  for (const [index, value] of payload.medias.entries()) {
    if (!isRecord(value)) continue

    const url = normalizeUrl(getString(value.url))
    if (!url) continue

    const extension = getString(value.extension)?.toLowerCase()
    const videoAvailable = value.videoAvailable === true
    const audioAvailable = value.audioAvailable === true
    const kind = getMediaKind(extension, videoAvailable, audioAvailable)
    const quality = getString(value.quality)

    media.push({
      kind,
      provider: "snapdouyin",
      sourceId: `${kind}:${index}`,
      sourceUrl: input.sourceUrl,
      url,
      ...(kind === "video" && input.thumbnailUrl
        ? { thumbnailUrl: input.thumbnailUrl }
        : {}),
      ...(extension ? { mimeType: getMimeType(extension, kind) } : {}),
      ...(typeof value.size === "number" ? { size: value.size } : {}),
      metadata: {
        ...(quality ? { quality } : {}),
        ...(typeof value.formattedSize === "string"
          ? { formattedSize: value.formattedSize }
          : {}),
        ...(typeof value.chunked === "boolean" ? { chunked: value.chunked } : {}),
        ...(typeof value.cached === "boolean" ? { cached: value.cached } : {}),
        ...(typeof value.requiresRendering === "boolean"
          ? { requiresRendering: value.requiresRendering }
          : {}),
        ...(input.parsed.videoId ? { videoId: input.parsed.videoId } : {}),
        ...(input.parsed.shareCode ? { shareCode: input.parsed.shareCode } : {}),
      },
    })
  }

  return media
}

function extractSnapDouyinToken(html: string) {
  const inputTags = html.match(/<input\b[^>]*>/gi) ?? []
  for (const tag of inputTags) {
    const attrs = parseTagAttributes(tag)
    if (attrs.id === "token" && attrs.name === "token" && attrs.value) {
      return attrs.value.trim()
    }
  }

  return undefined
}

function calculateHash(url: string, salt: string) {
  return `${base64Encode(url)}${url.length + 1_000}${base64Encode(salt)}`
}

function base64Encode(value: string) {
  if (typeof btoa === "function") return btoa(value)
  return Buffer.from(value, "utf8").toString("base64")
}

function parseTagAttributes(tag: string) {
  const attrs: Record<string, string> = {}
  const matches = tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)
  for (const match of matches) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? ""
  }
  return attrs
}

function getMediaKind(
  extension: string | undefined,
  videoAvailable: boolean,
  audioAvailable: boolean,
): ResourceMediaMetadata["kind"] {
  if (videoAvailable || extension === "mp4" || extension === "webm" || extension === "mov") return "video"
  if (audioAvailable || extension === "mp3" || extension === "m4a" || extension === "aac") return "audio"
  return "unknown"
}

function getMimeType(extension: string, kind: ResourceMediaMetadata["kind"]) {
  if (extension === "mp4") return "video/mp4"
  if (extension === "webm") return "video/webm"
  if (extension === "mov") return "video/quicktime"
  if (extension === "mp3") return "audio/mpeg"
  if (extension === "m4a") return "audio/mp4"
  if (extension === "aac") return "audio/aac"
  if (kind === "video") return "video/mp4"
  if (kind === "audio") return "audio/mpeg"
  return "application/octet-stream"
}

function normalizeUrl(value?: string) {
  if (!value) return undefined
  try {
    return new URL(value.replace(/\\\//g, "/")).toString()
  } catch {
    return undefined
  }
}

function normalizeText(value?: string) {
  const normalized = value?.replace(/\s+/g, " ").trim()
  return normalized || undefined
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

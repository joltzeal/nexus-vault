import {
  createBaseResourceMetadata,
  type ResourceFileType,
  type ResourceFileTreeNode,
  type ResourceMediaMetadata,
} from "../../domain/resources/metadata"
import {
  createCanonicalMagnetUrl,
  normalizeInfoHash,
  parseMagnetLink,
} from "../../domain/resources/input"

import { RetryableMetadataError, type MetadataProvider } from "../metadata-provider"

const WHATSLINK_API_URL = "https://whatslink.info/api/v1/link"
const MAGNET_METADATA_API_URL =
  "https://magnet-metadata-api.darklyn.org/api/v1/metadata"
const MAGNET_METADATA_TIMEOUT_MS = 165_000
const MAGNET_METADATA_RESPONSE_MAX_BYTES = 8 * 1024 * 1024
const WHATSLINK_RESPONSE_MAX_BYTES = 512 * 1024
const MAGNET_METADATA_TREE_MAX_NODES = 20_000
const MAGNET_METADATA_TREE_MAX_DEPTH = 32
const MAGNET_CACHE_VERSION = 1
const MAGNET_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60
const WHATSLINK_MAX_ATTEMPTS = 3
const WHATSLINK_RETRY_DELAYS_MS = [500, 1500]
const WHATSLINK_ATTRIBUTION = {
  label: "whatslink.info",
  url: "https://whatslink.info",
}

export const magnetMetadataProvider: MetadataProvider = {
  name: "magnet",
  supports: (resource) => resource.type === "magnet",
  async resolve(resource, options) {
    const parsed = parseMagnetLink(resource.url)
    const fallbackTitle = parsed?.displayName || resource.title || "名称未知"

    if (!parsed) {
      return {
        provider: "magnet",
        status: "failed",
        data: createBaseResourceMetadata({
          type: "magnet",
          title: resource.title || "名称未知",
        }),
        errorMessage: "Invalid magnet link.",
      }
    }

    const baseMetadata = createBaseResourceMetadata({
      type: "magnet",
      title: fallbackTitle,
    })
    const cached = await readMagnetCache(options?.magnetCache, parsed.infoHash)
    let whatslink: WhatsLinkFetchResult | undefined
    let torrent: TorrentFetchResult | undefined
    let whatslinkError: unknown
    let torrentError: unknown

    if (cached) {
      whatslink = {
        raw: cached.whatslink.raw,
        value: normalizeWhatsLinkResponse(cached.whatslink.raw),
      }
      if (cached.darklyn.status === "available") {
        torrent = {
          raw: cached.darklyn.raw,
          value: normalizeTorrentMetadata(cached.darklyn.raw, parsed.infoHash),
        }
      } else if (cached.darklyn.error) {
        torrentError = new Error(cached.darklyn.error)
      }
    } else {
      try {
        whatslink = await fetchWhatsLinkMetadata(parsed.infoHash)
      } catch (error) {
        whatslinkError = error
      }

      if (!whatslink) {
        if (whatslinkError instanceof RetryableMetadataError && options?.retryTransient) {
          throw whatslinkError
        }

        return {
          provider: "magnet",
          status: "failed",
          data: {
            ...baseMetadata,
            identifiers: { infoHash: parsed.infoHash },
            extra: {
              magnet: {
                infoHash: parsed.infoHash,
                sources: {
                  whatslink: { status: "unavailable" },
                },
              },
            },
          },
          errorMessage: getErrorMessage(
            whatslinkError,
            "Whatslink metadata request failed.",
          ),
        }
      }

      try {
        torrent = await fetchTorrentMetadata(resource.url, parsed.infoHash)
      } catch (error) {
        torrentError = error
      }

      await writeMagnetCache(options?.magnetCache, parsed.infoHash, {
        version: MAGNET_CACHE_VERSION,
        infoHash: parsed.infoHash,
        whatslink: {
          status: "available",
          raw: whatslink.raw,
        },
        darklyn: torrent
          ? { status: "available", raw: torrent.raw }
          : {
              status: "unavailable",
              error: getErrorMessage(torrentError, "Magnet file tree is unavailable."),
            },
      })
    }

    const media = await getWhatsLinkMedia(
      whatslink.value.screenshots,
      options?.persistMagnetScreenshot,
    )
    const metadataError = torrentError
      ? getErrorMessage(torrentError, "Magnet file tree is unavailable.")
      : undefined

    return {
      provider: "magnet",
      status: "completed",
      data: {
        ...baseMetadata,
        title: whatslink.value.name || fallbackTitle,
        size: whatslink.value.size,
        fileCount: whatslink.value.count,
        fileType: whatslink.value.fileType,
        tree: torrent?.value.tree ?? [],
        ...(media ? { media } : {}),
        identifiers: {
          infoHash: parsed.infoHash,
        },
        source: {
          name: "whatslink.info",
          url: WHATSLINK_API_URL,
          attribution: WHATSLINK_ATTRIBUTION,
        },
        extra: {
          magnet: {
            infoHash: parsed.infoHash,
            sources: {
              whatslink: { status: "available" },
              darklyn: {
                status: torrent ? "available" : "unavailable",
                ...(metadataError ? { error: metadataError } : {}),
              },
            },
          },
          whatslink: {
            type: whatslink.value.type,
            fileType: whatslink.value.fileType,
          },
        },
      },
    }
  },
}

type WhatsLinkMetadata = {
  type?: string
  fileType?: ResourceFileType
  name?: string
  size?: number
  count?: number
  screenshots?: string[]
}

type WhatsLinkFetchResult = {
  raw: unknown
  value: WhatsLinkMetadata
}

type TorrentMetadata = {
  infoHash?: string
  name?: string
  size?: number
  fileCount: number
  createdAt?: string
  tree: ResourceFileTreeNode[]
}

type TorrentFetchResult = {
  raw: unknown
  value: TorrentMetadata
}

type MagnetCacheEntry = {
  version: 1
  infoHash: string
  whatslink: {
    status: "available"
    raw: unknown
  }
  darklyn:
    | { status: "available"; raw: unknown }
    | { status: "unavailable"; error?: string }
}

type MutableTreeEntry = {
  name: string
  type: ResourceFileType
  size?: number
  children?: Map<string, MutableTreeEntry>
}

async function fetchWhatsLinkMetadata(infoHash: string): Promise<WhatsLinkFetchResult> {
  let lastError: unknown
  for (let attempt = 0; attempt < WHATSLINK_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetchWhatsLinkMetadataAttempt(infoHash)
    } catch (error) {
      if (!(error instanceof RetryableMetadataError)) throw error
      lastError = error
      const delay = WHATSLINK_RETRY_DELAYS_MS[attempt]
      if (delay !== undefined) await wait(delay)
    }
  }
  throw lastError ?? new RetryableMetadataError("Whatslink metadata request failed.")
}

async function fetchWhatsLinkMetadataAttempt(infoHash: string): Promise<WhatsLinkFetchResult> {
  const endpoint = new URL(WHATSLINK_API_URL)
  endpoint.searchParams.set("url", createCanonicalMagnetUrl(infoHash))

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    })

    if (!response.ok) {
      const message = `Whatslink request failed with HTTP ${response.status}.`
      if (isTransientStatus(response.status)) throw new RetryableMetadataError(message)
      throw new Error(message)
    }

    let payload: unknown
    try {
      payload = JSON.parse(await readBoundedResponseBody(response, WHATSLINK_RESPONSE_MAX_BYTES))
    } catch {
      throw new RetryableMetadataError("Whatslink response is not valid JSON.")
    }
    return { raw: payload, value: normalizeWhatsLinkResponse(payload) }
  } catch (error) {
    if (error instanceof RetryableMetadataError) throw error
    if (isTransientNetworkError(error)) {
      throw new RetryableMetadataError(
        `Whatslink request failed temporarily: ${getErrorMessage(error, "Network error.")}`,
      )
    }
    throw error
  }
}

async function fetchTorrentMetadata(
  magnet: string,
  expectedInfoHash: string,
): Promise<TorrentFetchResult> {
  try {
    const response = await fetch(MAGNET_METADATA_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ magnet_uri: magnet }),
      signal: AbortSignal.timeout(MAGNET_METADATA_TIMEOUT_MS),
    })

    const body = await readBoundedResponseBody(response, MAGNET_METADATA_RESPONSE_MAX_BYTES)
    if (!response.ok) {
      const upstreamMessage = getUpstreamErrorMessage(body)
      const message = `Magnet metadata request failed with HTTP ${response.status}${
        upstreamMessage ? `: ${upstreamMessage}` : "."
      }`
      if (isRetryableMagnetStatus(response.status, upstreamMessage)) {
        throw new RetryableMetadataError(message)
      }
      throw new Error(message)
    }

    let payload: unknown
    try {
      payload = JSON.parse(body)
    } catch {
      throw new RetryableMetadataError("Magnet metadata response is not valid JSON.")
    }
    return {
      raw: payload,
      value: normalizeTorrentMetadata(payload, expectedInfoHash),
    }
  } catch (error) {
    if (error instanceof RetryableMetadataError) throw error
    if (isTransientNetworkError(error)) {
      throw new RetryableMetadataError(
        `Magnet metadata request failed temporarily: ${getErrorMessage(error, "Network error.")}`,
      )
    }
    throw error
  }
}

async function readBoundedResponseBody(response: Response, maxBytes: number) {
  const contentLength = numberStringValue(response.headers.get("content-length"))
  if (contentLength && contentLength > maxBytes) {
    throw new Error("Magnet metadata response is too large.")
  }
  const body = await response.text()
  if (new TextEncoder().encode(body).byteLength > maxBytes) {
    throw new Error("Magnet metadata response is too large.")
  }
  return body
}

function normalizeTorrentMetadata(
  payload: unknown,
  expectedInfoHash: string,
): TorrentMetadata {
  const record = isRecord(payload) ? payload : null
  if (!record) throw new Error("Magnet metadata response is invalid.")

  const responseInfoHash = stringValue(record.info_hash) ?? stringValue(record.infoHash)
  const normalizedResponseHash = responseInfoHash
    ? normalizeInfoHash(responseInfoHash)
    : undefined
  if (responseInfoHash && !normalizedResponseHash) {
    throw new Error("Magnet metadata response contains an invalid info hash.")
  }
  if (normalizedResponseHash && normalizedResponseHash !== expectedInfoHash) {
    throw new Error("Magnet metadata response does not match the requested info hash.")
  }

  const flatFiles = flatTorrentFilesValue(record.files)
  if (!flatFiles) {
    throw new Error("Magnet metadata response contains an invalid file tree.")
  }
  const tree = buildFileTree(flatFiles)

  return {
    infoHash: normalizedResponseHash ?? undefined,
    name: stringValue(record.name),
    size: nonNegativeNumberValue(record.size) ?? sumFlatFileSizes(flatFiles),
    fileCount: flatFiles.length,
    createdAt: dateTimeValue(record.created_at),
    tree,
  }
}

function flatTorrentFilesValue(value: unknown) {
  if (!Array.isArray(value)) return undefined
  if (value.length > MAGNET_METADATA_TREE_MAX_NODES) {
    throw new Error("Magnet metadata response contains too many files.")
  }

  return value.map((item) => {
    if (!isRecord(item)) throw new Error("Magnet metadata file entry is invalid.")
    const path = stringValue(item.path)
    const size = nonNegativeNumberValue(item.size)
    if (!path || path.length > 4096 || size === undefined) {
      throw new Error("Magnet metadata file entry is invalid.")
    }
    return { path, size }
  })
}

function buildFileTree(files: Array<{ path: string; size: number }>) {
  const root = new Map<string, MutableTreeEntry>()

  for (const file of files) {
    const segments = file.path
      .replace(/\\/g, "/")
      .split("/")
      .filter(Boolean)
    if (
      segments.length === 0 ||
      segments.length > MAGNET_METADATA_TREE_MAX_DEPTH ||
      segments.some((segment) => segment === "." || segment === ".." || segment.length > 512)
    ) {
      throw new Error("Magnet metadata contains an invalid file path.")
    }

    let entries = root
    for (const [index, segment] of segments.entries()) {
      const isFile = index === segments.length - 1
      const current = entries.get(segment)

      if (isFile) {
        if (current) throw new Error("Magnet metadata contains duplicate file paths.")
        entries.set(segment, {
          name: segment,
          size: file.size,
          type: inferResourceFileType(segment),
        })
        continue
      }

      if (current && current.type !== "folder") {
        throw new Error("Magnet metadata contains conflicting file paths.")
      }
      const directory = current ?? {
        name: segment,
        type: "folder" as const,
        children: new Map<string, MutableTreeEntry>(),
      }
      entries.set(segment, directory)
      entries = directory.children ?? new Map<string, MutableTreeEntry>()
    }
  }

  return [...root.values()].map(toResourceFileTreeNode)
}

function toResourceFileTreeNode(entry: MutableTreeEntry): ResourceFileTreeNode {
  const children = entry.children
    ? [...entry.children.values()].map(toResourceFileTreeNode)
    : undefined
  const size =
    entry.type === "folder"
      ? children?.reduce((total, child) => total + (child.size ?? 0), 0)
      : entry.size

  return {
    name: entry.name,
    type: entry.type,
    ...(size !== undefined ? { size } : {}),
    ...(children ? { children } : {}),
  }
}

function inferResourceFileType(fileName: string): ResourceFileType {
  const extension = fileName.split(".").pop()?.toLowerCase()
  if (!extension || extension === fileName.toLowerCase()) return "unknown"
  if (["mp4", "mkv", "webm", "mov", "m4v", "avi", "wmv", "flv", "ts"].includes(extension)) {
    return "video"
  }
  if (["mp3", "flac", "wav", "aac", "ogg", "m4a", "opus"].includes(extension)) {
    return "audio"
  }
  if (["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg"].includes(extension)) {
    return "image"
  }
  if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso"].includes(extension)) {
    return "archive"
  }
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "epub"].includes(extension)) {
    return "document"
  }
  if (["txt", "md", "json", "xml", "csv", "log", "srt", "ass", "html"].includes(extension)) {
    return "text"
  }
  if (["ttf", "otf", "woff", "woff2"].includes(extension)) return "font"
  return "unknown"
}

function sumFlatFileSizes(files?: Array<{ path: string; size: number }>) {
  if (!files) return undefined
  return files.reduce((total, file) => total + file.size, 0)
}

async function getWhatsLinkMedia(
  screenshots?: string[],
  persist?: (input: { url: string; sourceId: string }) => Promise<string | undefined>,
): Promise<ResourceMediaMetadata[] | undefined> {
  if (!screenshots?.length) return undefined
  const media = await Promise.all(screenshots.map(async (url, index) => {
    const sourceId = getWhatslinkScreenshotId(url) ?? `screenshot-${index}`
    const persistedUrl = persist ? await persist({ url, sourceId }).catch(() => undefined) : undefined
    return {
      kind: "image" as const,
      provider: "whatslink",
      sourceId,
      sourceUrl: url,
      url: persistedUrl ?? url,
      thumbnailUrl: persistedUrl ?? url,
    }
  }))
  return media
}

function getWhatslinkScreenshotId(url: string) {
  try {
    const parsed = new URL(url)
    const match = /^\/image\/([a-z0-9]+)$/i.exec(parsed.pathname)
    return match?.[1]
  } catch {
    return undefined
  }
}

function normalizeWhatsLinkResponse(payload: unknown): WhatsLinkMetadata {
  const record = isRecord(payload) ? payload : null
  if (!record) throw new Error("Whatslink metadata response is invalid.")
  const normalized = {
    type: stringValue(record.type),
    fileType: resourceFileTypeValue(record.file_type),
    name: stringValue(record.name),
    size: numberValue(record.size),
    count: numberValue(record.count),
    screenshots: screenshotArrayValue(record.screenshots),
  }
  if (!Object.values(normalized).some((value) => value !== undefined)) {
    throw new Error("Whatslink metadata response contains no metadata.")
  }
  return normalized
}

async function readMagnetCache(cache: KVNamespace | undefined, infoHash: string) {
  if (!cache) return null
  try {
    const value = await cache.get(`magnet:v${MAGNET_CACHE_VERSION}:${infoHash}`, "json")
    if (!isRecord(value) || value.version !== MAGNET_CACHE_VERSION || value.infoHash !== infoHash) {
      return null
    }
    const whatslink = isRecord(value.whatslink) ? value.whatslink : null
    const darklyn = isRecord(value.darklyn) ? value.darklyn : null
    if (
      whatslink?.status !== "available" ||
      !Object.prototype.hasOwnProperty.call(whatslink, "raw") ||
      darklyn?.status !== "available" && darklyn?.status !== "unavailable"
    ) {
      return null
    }
    normalizeWhatsLinkResponse(whatslink.raw)
    if (darklyn.status === "available") {
      normalizeTorrentMetadata(darklyn.raw, infoHash)
      return {
        version: 1 as const,
        infoHash,
        whatslink: { status: "available" as const, raw: whatslink.raw },
        darklyn: { status: "available" as const, raw: darklyn.raw },
      }
    }
    return {
      version: 1 as const,
      infoHash,
      whatslink: { status: "available" as const, raw: whatslink.raw },
      darklyn: {
        status: "unavailable" as const,
        ...(stringValue(darklyn.error) ? { error: stringValue(darklyn.error) } : {}),
      },
    }
  } catch (error) {
    console.warn("Magnet metadata cache read failed", { infoHash, error })
    return null
  }
}

async function writeMagnetCache(
  cache: KVNamespace | undefined,
  infoHash: string,
  value: MagnetCacheEntry,
) {
  if (!cache) return
  try {
    await cache.put(`magnet:v${MAGNET_CACHE_VERSION}:${infoHash}`, JSON.stringify(value), {
      expirationTtl: MAGNET_CACHE_TTL_SECONDS,
    })
  } catch (error) {
    console.warn("Magnet metadata cache write failed", { infoHash, error })
  }
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function isRetryableMagnetStatus(status: number, message?: string) {
  if (isTransientStatus(status)) return true
  if ([400, 401, 403, 413].includes(status)) return false
  if (status === 422 && /too many|invalid|must be/i.test(message ?? "")) return false
  return status === 404 || status === 409 || status === 422
}

function isTransientStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500
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

function getUpstreamErrorMessage(body: string) {
  try {
    const payload: unknown = JSON.parse(body)
    return isRecord(payload) ? stringValue(payload.error) ?? stringValue(payload.message) : undefined
  } catch {
    return undefined
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function dateTimeValue(value: unknown) {
  const dateTime = stringValue(value)
  if (!dateTime) return undefined
  return Number.isNaN(new Date(dateTime).getTime()) ? undefined : dateTime
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function nonNegativeNumberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined
}

function numberStringValue(value: string | null) {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function screenshotArrayValue(value: unknown) {
  if (!Array.isArray(value)) return undefined
  const items = value
    .map((item) => {
      if (typeof item === "string") return item.trim()
      if (isRecord(item)) return stringValue(item.screenshot)
      return undefined
    })
    .filter((item): item is string => Boolean(item))
  return items.length > 0 ? items : undefined
}

function resourceFileTypeValue(value: unknown): ResourceFileType | undefined {
  const allowed = new Set<ResourceFileType>([
    "unknown",
    "multimedia",
    "folder",
    "video",
    "text",
    "image",
    "audio",
    "archive",
    "font",
    "document",
  ])
  return typeof value === "string" && allowed.has(value as ResourceFileType)
    ? (value as ResourceFileType)
    : undefined
}

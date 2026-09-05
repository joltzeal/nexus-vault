import {
  createBaseResourceMetadata,
  type ResourceFileTreeNode,
  type ResourceFileType,
  type ResourceMediaMetadata,
} from "../../domain/resources/metadata"
import { parseGofileLink } from "../../domain/resources/input"
import { createResourceMediaStreamUrl } from "../../domain/media-storage"

import {
  RetryableMetadataError,
  type MetadataProvider,
  type MetadataResolveOptions,
} from "../metadata-provider"

const GOFILE_API_URL = "https://api.gofile.io"
const GOFILE_USER_AGENT = "Mozilla/5.0 (compatible; NexusVaultMetadata/1.0)"
const GOFILE_MAX_FILES = 1_000
const GOFILE_MAX_DEPTH = 32
export const GOFILE_ACCOUNT_TOKEN_CACHE_KEY = "gofile:account-token:v1"
const GOFILE_ACCOUNT_TOKEN_CACHE_TTL_SECONDS = 24 * 60 * 60

type GofileContent = {
  canAccess?: unknown
  children?: unknown
  code?: unknown
  createTime?: unknown
  downloadCount?: unknown
  id?: unknown
  md5?: unknown
  mimetype?: unknown
  modTime?: unknown
  name?: unknown
  size?: unknown
  thumbnail?: unknown
  type?: unknown
  link?: unknown
  servers?: unknown
  serverSelected?: unknown
}

type GofileResponse = {
  status?: unknown
  data?: unknown
}

type GofileFile = {
  content: GofileContent
  name: string
  path: string
}

type GofileAvailabilityStatus = "available" | "unavailable" | "rate_limited" | "unknown"

type GofileAvailability = {
  status: GofileAvailabilityStatus
  reason: string
  checkedAt: string
}

export const gofileMetadataProvider: MetadataProvider = {
  name: "gofile",
  supports: (resource) => resource.type === "gofile" || parseGofileLink(resource.url) !== null,
  async resolve(resource, options) {
    const parsed = parseGofileLink(resource.url)
    const base = createBaseResourceMetadata({ type: resource.type, title: resource.title })

    if (!parsed) {
      return {
        provider: "gofile",
        status: "failed",
        data: base,
        errorMessage: "Invalid GoFile URL.",
      }
    }

    try {
      const accountToken = await getGofileAccountToken(options)
      const root = await fetchGofileContent(parsed.contentId, accountToken, options)
      const files: GofileFile[] = []
      const tree = root.canAccess === false
        ? []
        : await collectGofileContent(root, "", files, accountToken, options, new Set(), 0)
      sortGofileFiles(files)
      const media: ResourceMediaMetadata[] = []
      for (const file of files) {
        media.push(...toMedia(file, parsed.url, resource.id, media.length))
      }
      const rootName = getString(root.name)
      const title = root.type === "file"
        ? files[0]?.name ?? rootName ?? resource.title
        : rootName ?? resource.title
      const availability = root.canAccess === false
        ? createGofileAvailability("unavailable", "GoFile content cannot be accessed.")
        : files.length > 0
          ? createGofileAvailability("available", "GoFile content contains files.")
          : createGofileAvailability("unavailable", "GoFile content contains no files.")

      return {
        provider: "gofile",
        status: "completed",
        data: {
          ...createBaseResourceMetadata({ type: resource.type, title }),
          title,
          size: getTotalSize(files),
          fileCount: files.length,
          fileType: getResourceFileType(files, root.type === "folder"),
          media,
          tree,
          identifiers: {
            contentId: parsed.contentId,
            code: getString(root.code) ?? parsed.contentId,
          },
          source: {
            name: "gofile",
            url: parsed.url,
            attribution: { label: "GoFile", url: "https://gofile.io/" },
          },
          extra: {
            cloudDrive: {
              provider: "gofile",
              availability,
            },
            gofile: {
              canAccess: root.canAccess,
              contentType: root.type,
              rootName,
            },
          },
        },
      }
    } catch (error) {
      if (options?.retryTransient && error instanceof RetryableMetadataError) throw error

      const availability = getGofileErrorAvailability(error)
      return {
        provider: "gofile",
        status: "failed",
        data: {
          ...base,
          identifiers: { contentId: parsed.contentId },
          source: { name: "gofile", url: parsed.url },
          extra: {
            cloudDrive: {
              provider: "gofile",
              availability,
            },
          },
        },
        errorMessage: error instanceof Error ? error.message : "GoFile request failed.",
      }
    }
  },
}

async function collectGofileContent(
  content: GofileContent,
  parentPath: string,
  files: GofileFile[],
  accountToken: string,
  options: MetadataResolveOptions | undefined,
  visited: Set<string>,
  depth: number,
): Promise<ResourceFileTreeNode[]> {
  const contentType = getString(content.type)
  const name = getString(content.name) ?? "Unnamed GoFile content"

  if (contentType === "file") {
    files.push({ content, name, path: parentPath ? `${parentPath}/${name}` : name })
    return [{ name, type: getResourceFileTypeForContent(content), size: getNumber(content.size) }]
  }
  if (contentType !== "folder") throw new Error("GoFile API returned an unsupported content type.")

  const currentPath = parentPath || name
  const tree: ResourceFileTreeNode[] = []
  for (const child of getChildren(content.children)) {
    if (files.length >= GOFILE_MAX_FILES) {
      throw new Error(`GoFile folder contains more than ${GOFILE_MAX_FILES} files.`)
    }

    const childType = getString(child.type)
    const childName = getString(child.name) ?? "Unnamed GoFile content"
    if (childType === "file") {
      files.push({ content: child, name: childName, path: `${currentPath}/${childName}` })
      tree.push({ name: childName, type: getResourceFileTypeForContent(child), size: getNumber(child.size) })
      continue
    }

    const childId = getString(child.id)
    if (childType !== "folder" || !childId) continue
    if (depth >= GOFILE_MAX_DEPTH) throw new Error(`GoFile folder nesting exceeds ${GOFILE_MAX_DEPTH} levels.`)
    if (visited.has(childId)) continue
    visited.add(childId)

    const childContent = await fetchGofileContent(childId, accountToken, options)
    const nestedTree = await collectGofileContent(
      childContent,
      `${currentPath}/${childName}`,
      files,
      accountToken,
      options,
      visited,
      depth + 1,
    )
    const children = nestedTree[0]?.type === "folder"
      ? nestedTree[0].children ?? []
      : nestedTree
    tree.push({ name: childName, type: "folder", children })
  }

  return [{ name, type: "folder", children: tree }]
}

/**
 * GoFile CDN links require server-side tokens and cannot be hotlinked, so the
 * metadata stores our own root-relative stream URLs; clients load them through
 * the API proxy (with the user's session for private content).
 */
function toMedia(
  file: GofileFile,
  sourceUrl: string,
  resourceId: string,
  mediaIndex: number,
): ResourceMediaMetadata[] {
  const url = getHttpUrl(file.content.link)
  if (!url) return []

  const kind = getMediaKind(getString(file.content.mimetype), file.name)
  const streamUrl = createResourceMediaStreamUrl(resourceId, mediaIndex)
  const thumbnailUrl =
    kind === "video" && getHttpUrl(file.content.thumbnail)
      ? createResourceMediaStreamUrl(resourceId, mediaIndex, "thumbnail")
      : kind === "image"
        ? streamUrl
        : undefined
  const mimeType = getString(file.content.mimetype)
  const size = getNumber(file.content.size)
  const metadata: Record<string, unknown> = { path: file.path }
  for (const [key, value] of [
    ["code", file.content.code],
    ["md5", file.content.md5],
    ["serverSelected", file.content.serverSelected],
    ["servers", file.content.servers],
    ["createTime", file.content.createTime],
    ["modTime", file.content.modTime],
    ["downloadCount", file.content.downloadCount],
  ] as const) {
    if (value !== undefined) metadata[key] = value
  }

  return [{
    kind,
    provider: "gofile",
    sourceId: getString(file.content.id),
    sourceUrl,
    url: streamUrl,
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(mimeType ? { mimeType } : {}),
    fileName: file.name,
    ...(size !== undefined ? { size } : {}),
    metadata,
  }]
}

async function fetchGofileContent(
  contentId: string,
  accountToken: string,
  options: MetadataResolveOptions | undefined,
): Promise<GofileContent> {
  const url = `${GOFILE_API_URL}/contents/${encodeURIComponent(contentId)}?cache=true&sortField=createTime&sortDirection=1`
  const response = await fetch(url, {
    headers: await getGofileHeaders(accountToken),
    signal: AbortSignal.timeout(15_000),
  })
  const payload = await parseGofileResponse(response, options)
  if (payload.status !== "ok" || !isRecord(payload.data)) {
    throw new Error(getGofileErrorMessage(payload.data))
  }

  const data = payload.data as GofileContent
  return data
}

async function getGofileAccountToken(options?: MetadataResolveOptions) {
  const configuredToken = options?.gofileApiToken?.trim()
  if (configuredToken) return configuredToken

  const cachedToken = options?.gofileCache
    ? await options.gofileCache.get(GOFILE_ACCOUNT_TOKEN_CACHE_KEY)
    : null
  if (cachedToken?.trim()) return cachedToken.trim()

  const token = await createGofileAccount(options)
  await options?.gofileCache?.put(GOFILE_ACCOUNT_TOKEN_CACHE_KEY, token, {
    expirationTtl: GOFILE_ACCOUNT_TOKEN_CACHE_TTL_SECONDS,
  })
  return token
}

async function createGofileAccount(options?: MetadataResolveOptions) {
  const response = await fetch(`${GOFILE_API_URL}/accounts`, {
    method: "POST",
    headers: await getGofileHeaders(""),
    signal: AbortSignal.timeout(15_000),
  })
  const payload = await parseGofileResponse(response, options)
  if (payload.status !== "ok" || !isRecord(payload.data)) {
    throw new Error(getGofileErrorMessage(payload.data, "GoFile account creation failed."))
  }

  const token = getString(payload.data.token)
  if (!token) throw new Error("GoFile account response did not contain an access token.")
  return token
}

async function parseGofileResponse(response: Response, options?: MetadataResolveOptions): Promise<GofileResponse> {
  if (!response.ok) {
    if (response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500) {
      const error = new RetryableMetadataError(`GoFile API returned HTTP ${response.status}.`)
      if (options?.retryTransient) throw error
    }
    throw new Error(`GoFile API returned HTTP ${response.status}.`)
  }

  const payload = await response.json() as unknown
  if (!isRecord(payload)) throw new Error("GoFile API returned invalid JSON.")
  return payload as GofileResponse
}

async function getGofileHeaders(accountToken: string) {
  return {
    accept: "application/json",
    "user-agent": GOFILE_USER_AGENT,
    "x-bl": "en-US",
    "x-website-token": await generateWebsiteToken(GOFILE_USER_AGENT, accountToken),
    ...(accountToken ? { authorization: `Bearer ${accountToken}` } : {}),
  }
}

async function generateWebsiteToken(userAgent: string, accountToken: string) {
  const timeSlot = Math.floor(Date.now() / 1000 / 14_400)
  const raw = `${userAgent}::en-US::${accountToken}::${timeSlot}::12af056dacea0b`
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("")
}

function getChildren(value: unknown): GofileContent[] {
  const children = Array.isArray(value)
    ? value.filter(isRecord) as GofileContent[]
    : isRecord(value)
      ? Object.values(value).filter(isRecord) as GofileContent[]
      : []

  return children
    .map((child, index) => ({ child, index, modTime: getTimestamp(child.modTime) }))
    .sort((left, right) => {
      if (left.modTime === undefined && right.modTime === undefined) return left.index - right.index
      if (left.modTime === undefined) return 1
      if (right.modTime === undefined) return -1
      return left.modTime - right.modTime || left.index - right.index
    })
    .map(({ child }) => child)
}

function sortGofileFiles(files: GofileFile[]) {
  files
    .map((file, index) => ({ file, index, modTime: getTimestamp(file.content.modTime) }))
    .sort((left, right) => {
      if (left.modTime === undefined && right.modTime === undefined) return left.index - right.index
      if (left.modTime === undefined) return 1
      if (right.modTime === undefined) return -1
      return left.modTime - right.modTime || left.index - right.index
    })
    .forEach((item, index) => {
      files[index] = item.file
    })
}

function getResourceFileType(files: GofileFile[], isFolder: boolean): ResourceFileType | undefined {
  if (isFolder) return "folder"
  return files[0] ? getResourceFileTypeForContent(files[0].content) : undefined
}

function getResourceFileTypeForContent(content: GofileContent): ResourceFileType {
  const kind = getMediaKind(content.mimetype, getString(content.name))
  if (kind === "image") return "image"
  if (kind === "video") return "video"
  if (kind === "audio") return "audio"
  if (kind === "document") return "document"
  return "unknown"
}

function getMediaKind(mimeType: unknown, fileName: string | undefined): ResourceMediaMetadata["kind"] {
  const mime = getString(mimeType)?.toLowerCase() ?? ""
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  if (mime.startsWith("text/") || mime === "application/pdf" || mime.includes("document")) return "document"

  const extension = fileName?.match(/\.([a-z0-9]{1,12})$/i)?.[1]?.toLowerCase()
  if (["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg"].includes(extension ?? "")) return "image"
  if (["mp4", "mkv", "webm", "mov", "m4v", "avi", "wmv", "flv"].includes(extension ?? "")) return "video"
  if (["mp3", "flac", "wav", "aac", "ogg", "m4a", "opus"].includes(extension ?? "")) return "audio"
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "epub"].includes(extension ?? "")) return "document"
  return "unknown"
}

function getTotalSize(files: GofileFile[]) {
  const sizes = files.map((file) => getNumber(file.content.size)).filter((value): value is number => value !== undefined)
  return sizes.length === files.length ? sizes.reduce((total, value) => total + value, 0) : undefined
}

function getGofileErrorMessage(data: unknown, fallback = "GoFile API returned an error.") {
  if (!isRecord(data)) return fallback
  for (const key of ["message", "error", "details"]) {
    const value = getString(data[key])
    if (value) return `GoFile API error: ${value}`
  }
  return fallback
}

function getGofileErrorAvailability(error: unknown): GofileAvailability {
  const reason = error instanceof Error ? error.message : "GoFile request failed."
  const status = /\b429\b|rate.?limit/i.test(reason) ? "rate_limited" : "unknown"
  return createGofileAvailability(status, reason)
}

function createGofileAvailability(
  status: GofileAvailabilityStatus,
  reason: string,
): GofileAvailability {
  return {
    status,
    reason,
    checkedAt: new Date().toISOString(),
  }
}

function getHttpUrl(value: unknown) {
  const string = getString(value)
  if (!string) return undefined
  try {
    const url = new URL(string)
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined
  } catch {
    return undefined
  }
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
}

function getTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim())) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

import {
  formatBytes,
  formatResourceType,
} from "@/features/formatters"
import {
  createCanonicalMagnetUrl,
  parseMagnetLink,
} from "@/domain/resources/input"
import type {
  MetadataStatus,
  Resource,
  ResourceSet,
  ResourceType,
  Space,
  Visibility,
} from "@/features/types"

export type MediaItem = {
  fit?: "cover" | "natural"
  kind: "image" | "video"
  playback?: "inline" | "external"
  src: string
  preview?: string
  duration?: string
}

export type ResourcePillItem =
  | {
      key: string
      kind: "text"
      label: string
    }
  | {
      key: string
      kind: "status"
      label: string
      status: "online" | "offline" | "maintenance" | "degraded"
      title?: string
    }
  | {
      key: string
      kind: "copy"
      label: string
      value: string
      ariaLabel: string
    }

type CloudDriveAvailabilityStatus =
  | "available"
  | "unavailable"
  | "password_required"
  | "rate_limited"
  | "unknown"

export function getSortedSpaces(set?: ResourceSet) {
  return [...(set?.spaces ?? [])].sort((a, b) => a.position - b.position)
}

export function groupResourcesBySpace(resources: Resource[], spaces: Space[]) {
  const knownSpaceIds = new Set(spaces.map((space) => space.id))
  const grouped = new Map<string, Resource[]>()

  for (const space of spaces) grouped.set(space.id, [])

  for (const resource of resources) {
    if (!knownSpaceIds.has(resource.spaceId)) continue
    grouped.set(resource.spaceId, [...(grouped.get(resource.spaceId) ?? []), resource])
  }

  for (const [spaceId, items] of grouped) {
    grouped.set(
      spaceId,
      [...items].sort((a, b) => a.position - b.position || b.createdAt.localeCompare(a.createdAt))
    )
  }

  return grouped
}

export function getResourceTitle(resource: Resource) {
  return getDisplayResourceTitle(resource)
}

export function getDisplayResourceTitle(resource: Pick<Resource, "type" | "url" | "title" | "metadata">) {
  const metadataTitle = normalizeDisplayTitle(resource.metadata?.data?.title)
  if (metadataTitle) return metadataTitle

  const resourceTitle = normalizeDisplayTitle(resource.title)
  if (resourceTitle) return resourceTitle

  if (resource.type === "magnet") {
    const hash = getMagnetHash(resource.url)
    return hash ? `Magnet · ${hash.slice(0, 8)}...` : "Magnet"
  }

  return formatResourceType(resource.type)
}

export function getResourceDescription(resource: Resource) {
  return resource.description || resource.metadata?.data?.description || ""
}

export function getResourceSize(resource: Resource) {
  const metadata = resource.metadata?.data
  return formatBytes(metadata?.size)
}

export function getResourceDisplayUrl(resource: Resource) {
  const value = resource.url.trim()
  if (resource.type !== "magnet") return value
  const parsed = parseMagnetLink(value)
  if (parsed) return createCanonicalMagnetUrl(parsed.infoHash)

  return /^[a-zA-Z0-9]{32,64}$/.test(value)
    ? `magnet:?xt=urn:btih:${value.toUpperCase()}`
    : value
}

export function getResourceTags(resource: Resource) {
  const metadata = resource.metadata?.data
  const tags = [
    formatResourceType(resource.type),
    metadata?.fileType,
    metadata?.fileCount ? `${metadata.fileCount} files` : undefined,
  ]

  return tags.filter((tag): tag is string => Boolean(tag)).slice(0, 3)
}

export function getResourcePillItems(resource: Resource): ResourcePillItem[] {
  return resourcePillStrategies.flatMap((strategy) => strategy(resource))
}

export function getResourceMedia(resource: Resource): MediaItem[] {
  const metadata = resource.metadata?.data
  return getNormalizedMedia(metadata?.media, metadata?.source?.url)
}

export function getResourceFaviconUrl(resource: Resource) {
  if (resource.type !== "http") return ""

  const http = getHttpMetadata(resource.metadata?.data?.extra?.http)
  return http?.favicon ?? ""
}

export function getResourceCloudDriveData(resource: Resource) {
  const metadata = resource.metadata?.data
  const cloudDrive = getCloudDriveMetadata(metadata?.extra?.cloudDrive)

  if (!cloudDrive) return null

  return {
    password: cloudDrive.password,
    availability: cloudDrive.availability,
  }
}

export function getMetadataState(status: MetadataStatus) {
  const map = {
    completed: { label: "就绪" },
    pending: { label: "补全中" },
    processing: { label: "解析中" },
    failed: { label: "解析失败" },
  } satisfies Record<MetadataStatus, { label: string }>

  return map[status]
}

export function getTypePill(type: ResourceType) {
  if (type === "magnet") return { className: "tp-magnet", label: "MAG" }
  if (type === "twitter") return { className: "tp-http", label: "X" }
  if (type === "telegram") return { className: "tp-http", label: "TG" }
  if (type === "ftp") return { className: "tp-http", label: "FTP" }
  if (type === "baidu_pan") return { className: "tp-drive", label: "BD" }
  if (type === "pan_115") return { className: "tp-drive", label: "115" }
  if (type === "pan_123") return { className: "tp-drive", label: "123" }
  if (type === "quark_pan") return { className: "tp-drive", label: "QK" }
  if (type === "uc_pan") return { className: "tp-drive", label: "UC" }
  if (type === "xunlei_pan") return { className: "tp-drive", label: "XL" }
  if (type === "pikpak") return { className: "tp-drive", label: "PK" }
  if (type === "youtube") return { className: "tp-youtube", label: "YT" }
  if (type === "onedrive" || type === "google_drive" || type === "dropbox" || type === "alist") {
    return { className: "tp-drive", label: type === "google_drive" ? "GD" : "OD" }
  }
  return { className: "tp-http", label: type === "http" ? "WEB" : "LINK" }
}

export function getVisibilityCopy(visibility: Visibility) {
  const map = {
    public: "公开",
    private: "私有",
    password: "密码保护",
  } satisfies Record<Visibility, string>

  return map[visibility]
}

export function getInitials(value?: string | null) {
  const source = value?.trim() || "NV"
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "NV"
}

export function getVaultStats(set?: ResourceSet, collaboratorsCount = 0) {
  return [
    { label: "resources", value: set?.resources.length ?? 0 },
    { label: "spaces", value: set?.spaces.length ?? 0 },
    { label: "members", value: collaboratorsCount },
    { label: "stars", value: set?.starCount ?? 0 },
    { label: "forks", value: set?.forkCount ?? 0 },
  ]
}

export function getResourceMeta(resource: Resource) {
  const metadata = resource.metadata?.data

  return {
    provider: resource.metadata?.provider ?? resource.type,
    createdAt: formatDateTime(resource.createdAt),
    fileCount: metadata?.fileCount ?? 0,
    treeCount: metadata?.tree?.length ?? 0,
    source: metadata?.source?.attribution,
    errorMessage: resource.metadata?.errorMessage,
  }
}

function normalizeDisplayTitle(value?: string | null) {
  const title = value?.trim()
  if (!title) return ""

  const fallbackTitles = new Set([
    "名称未知",
    "untitled resource",
    "untitled link",
    "untitled tweet",
  ])

  return fallbackTitles.has(title.toLowerCase()) ? "" : title
}

function getMagnetHash(value: string) {
  const normalized = value.trim()
  const direct = normalized.match(/^[a-fA-F0-9]{32,64}$/)?.[0]
  if (direct) return direct.toUpperCase()

  const btih = normalized.match(/urn:btih:([a-zA-Z0-9]{32,64})/i)?.[1]
  return btih?.toUpperCase() ?? ""
}

type ResourcePillStrategy = (resource: Resource) => ResourcePillItem[]

const resourcePillStrategies: ResourcePillStrategy[] = [
  getResourceTagPills,
  getResourceSizePills,
  getCloudDrivePills,
]

function getResourceTagPills(resource: Resource) {
  return getResourceTags(resource).map((label, index) => ({
    key: `tag:${index}:${label}`,
    kind: "text" as const,
    label,
  }))
}

function getResourceSizePills(resource: Resource): ResourcePillItem[] {
  const metadata = resource.metadata?.data
  if (resource.type === "http" || resource.type === "twitter") return []
  if (typeof metadata?.size !== "number") return []

  return [
    {
      key: "size",
      kind: "text",
      label: formatBytes(metadata.size),
    },
  ]
}

function getCloudDrivePills(resource: Resource): ResourcePillItem[] {
  const cloudDrive = getCloudDriveMetadata(resource.metadata?.data?.extra?.cloudDrive)
  if (!cloudDrive) return []

  const pills: ResourcePillItem[] = []

  if (cloudDrive.availability) {
    const availabilityLabels = {
      available: "可用",
      unavailable: "失效",
      password_required: "需密码",
      rate_limited: "受限",
      unknown: "未知",
    } as const
    const availabilityStatuses = {
      available: "online",
      unavailable: "offline",
      password_required: "degraded",
      rate_limited: "maintenance",
      unknown: "maintenance",
    } as const

    pills.push({
      key: "cloud-drive:availability",
      kind: "status",
      label: availabilityLabels[cloudDrive.availability.status],
      status: availabilityStatuses[cloudDrive.availability.status],
      title: cloudDrive.availability.reason,
    })
  }

  if (cloudDrive.password) {
    pills.push({
      key: "cloud-drive:password",
      kind: "copy",
      label: "密码",
      value: cloudDrive.password,
      ariaLabel: "复制网盘密码",
    })
  }

  return pills
}

function getNormalizedMedia(value: unknown, sourceUrl?: string): MediaItem[] {
  if (!Array.isArray(value)) return []

  const media: MediaItem[] = []
  for (const item of value) {
    if (!isRecord(item)) continue

    const kind = typeof item.kind === "string" ? item.kind : ""
    const provider = typeof item.provider === "string" ? item.provider : ""
    const url = typeof item.url === "string" ? item.url.trim() : ""
    const thumbnailUrl =
      typeof item.thumbnailUrl === "string"
        ? item.thumbnailUrl.trim() || undefined
        : undefined

    if (kind === "video" && url) {
      media.push({
        kind: "video",
        playback: getVideoPlayback(provider),
        src: url,
        ...(thumbnailUrl ? { preview: thumbnailUrl } : {}),
      })
      continue
    }

    if (kind === "image") {
      const imageUrl = url || thumbnailUrl
      if (!imageUrl) continue
      media.push({
        fit: isWhatsLinkMetadataSource(sourceUrl) ? "natural" : "cover",
        kind: "image",
        src: imageUrl,
      })
    }
  }

  return media
}

function getVideoPlayback(provider: string): MediaItem["playback"] {
  if (provider === "telegram") return "inline"
  return "external"
}

function isWhatsLinkMetadataSource(value?: string) {
  if (!value) return false
  try {
    return new URL(value).hostname === "whatslink.info"
  } catch {
    return value.startsWith("https://whatslink.info/")
  }
}

function getCloudDriveMetadata(value: unknown) {
  if (!isRecord(value)) return null

  const availabilityStatus = getCloudDriveAvailabilityStatus(
    isRecord(value.availability) ? value.availability.status : undefined
  )
  const availability = isRecord(value.availability)
    ? {
        status: availabilityStatus,
        httpStatus:
          typeof value.availability.httpStatus === "number"
            ? value.availability.httpStatus
            : undefined,
        reason:
          typeof value.availability.reason === "string"
            ? value.availability.reason
            : undefined,
      }
    : undefined

  return {
    password: typeof value.password === "string" ? value.password : undefined,
    availability,
  }
}

function getHttpMetadata(value: unknown) {
  if (!isRecord(value)) return null

  return {
    favicon: typeof value.favicon === "string" ? value.favicon : undefined,
  }
}

function getCloudDriveAvailabilityStatus(value: unknown): CloudDriveAvailabilityStatus {
  return value === "available" ||
    value === "unavailable" ||
    value === "password_required" ||
    value === "rate_limited" ||
    value === "unknown"
    ? value
    : "unknown"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

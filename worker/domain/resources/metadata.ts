import type { ResourceType } from "./types"

export type ResourceFileType =
  | "unknown"
  | "multimedia"
  | "folder"
  | "video"
  | "text"
  | "image"
  | "audio"
  | "archive"
  | "font"
  | "document"

export type ResourceFileTreeNode = {
  name: string
  type?: ResourceFileType
  size?: number
  children?: ResourceFileTreeNode[]
}

export type ResourceMetadataSource = {
  name: string
  url?: string
  attribution?: {
    label: string
    url: string
  }
}

export type ResourceMediaMetadata = {
  kind: "image" | "video" | "audio" | "document" | "unknown"
  duration?: number
  provider?: string
  sourceId?: string
  sourceUrl?: string
  url?: string
  thumbnailUrl?: string
  mimeType?: string
  fileName?: string
  height?: number
  size?: number
  width?: number
  metadata?: Record<string, unknown>
}

export type ResourcePreviewKind =
  | "x_profile"
  | "x_post"
  | "github_user"
  | "github_repository"
  | "github_release"
  | "telegram_message"
  | "wechat_mp_article"
  | "social_video"

/**
 * Provider-owned, persisted card data. The UI validates this shape again before
 * rendering so older or partially populated metadata remains safe to display.
 */
export type ResourcePreviewMetadata = {
  kind: ResourcePreviewKind
  data: Record<string, unknown>
}

export type NormalizedResourceMetadata = {
  schemaVersion: 1
  type: ResourceType
  title?: string
  description?: string
  size?: number
  fileCount?: number
  fileType?: ResourceFileType
  media?: ResourceMediaMetadata[]
  tree: ResourceFileTreeNode[]
  identifiers?: Record<string, string>
  source?: ResourceMetadataSource
  preview?: ResourcePreviewMetadata
  extra?: Record<string, unknown>
  fetchedAt: string
}

export function createBaseResourceMetadata(input: {
  type: ResourceType
  title?: string
  fetchedAt?: string
}): NormalizedResourceMetadata {
  return {
    schemaVersion: 1,
    type: input.type,
    title: input.title,
    tree: [],
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
  }
}

export function normalizeResourceMetadata(
  value: unknown,
): NormalizedResourceMetadata | null {
  if (!value || typeof value !== "object") return null

  const parsed = value as Partial<NormalizedResourceMetadata>
  if (parsed.schemaVersion !== 1 || !parsed.type) return null
  const normalizedPreview = normalizePreviewMetadata(parsed.preview)

  return {
    ...parsed,
    tree: Array.isArray(parsed.tree) ? parsed.tree : [],
    preview: normalizedPreview ?? undefined,
    fetchedAt: parsed.fetchedAt ?? new Date().toISOString(),
  } as NormalizedResourceMetadata
}

function normalizePreviewMetadata(value: unknown): ResourcePreviewMetadata | null {
  if (!value || typeof value !== "object") return null
  const preview = value as Partial<ResourcePreviewMetadata>
  if (!isPreviewKind(preview.kind) || !preview.data || typeof preview.data !== "object") {
    return null
  }
  return {
    kind: preview.kind,
    data: preview.data as Record<string, unknown>,
  }
}

function isPreviewKind(value: unknown): value is ResourcePreviewKind {
  return value === "x_profile" ||
    value === "x_post" ||
    value === "github_user" ||
    value === "github_repository" ||
    value === "github_release" ||
    value === "telegram_message" ||
    value === "wechat_mp_article" ||
    value === "social_video"
}

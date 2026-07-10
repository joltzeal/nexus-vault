import type { ResourceType } from "./resource-input"

export type ResourceFileType =
  | "unknown"
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

export type NormalizedResourceMetadata = {
  schemaVersion: 1
  type: ResourceType
  title?: string
  description?: string
  cover?: string
  size?: number
  fileCount?: number
  fileType?: ResourceFileType
  screenshots?: string[]
  tree: ResourceFileTreeNode[]
  identifiers?: Record<string, string>
  source?: ResourceMetadataSource
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

export function parseResourceMetadataJson(
  value: string | null | undefined
): NormalizedResourceMetadata | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<NormalizedResourceMetadata>
    if (parsed.schemaVersion !== 1 || !parsed.type) return null

    return {
      ...parsed,
      tree: Array.isArray(parsed.tree) ? parsed.tree : [],
      fetchedAt: parsed.fetchedAt ?? new Date().toISOString(),
    } as NormalizedResourceMetadata
  } catch {
    return null
  }
}

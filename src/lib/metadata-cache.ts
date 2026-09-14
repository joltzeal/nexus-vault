import type { Resource } from "@/features/resource/types"

const PREFIX = "nexus-vault:metadata:"

export function readCachedMetadata(resourceId: string): Resource["metadata"] {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(PREFIX + resourceId)
    return raw ? (JSON.parse(raw) as Resource["metadata"]) : null
  } catch { return null }
}

export function mergeCachedMetadata(resource: Resource): Resource {
  const cached = readCachedMetadata(resource.id)
  if (!cached || resource.metadataStatus === "completed") return resource
  return { ...resource, metadata: resource.metadata ?? cached }
}

export function writeCachedMetadata(resource: Pick<Resource, "id" | "metadata" | "metadataStatus">) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(PREFIX + resource.id, JSON.stringify({
      ...(resource.metadata ?? {}),
      status: resource.metadataStatus,
    }))
  } catch { /* Storage may be disabled in private browsing. */ }
}

export function clearCachedMetadata(resourceId: string) {
  try { window.localStorage.removeItem(PREFIX + resourceId) } catch { /* ignore unavailable storage */ }
}

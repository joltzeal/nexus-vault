import type { MetadataStatus, ResourceType, Visibility } from "@/features/vault-workspace/types"
import { resourceTypes, visibilityOptions } from "@/features/vault-workspace/types"
import type { NormalizedResourceMetadata } from "@nexus-vault/shared/resource-metadata"

export function formatResourceType(type: ResourceType) {
  return resourceTypes.find((item) => item.value === type)?.label ?? type
}

export function formatVisibility(visibility: Visibility) {
  return visibilityOptions.find((item) => item.value === visibility)?.label ?? visibility
}

export function metadataVariant(status: MetadataStatus) {
  if (status === "completed") return "success-light"
  if (status === "failed") return "destructive-light"
  if (status === "processing") return "warning-light"
  return "secondary"
}

export function visibilityVariant(visibility: Visibility) {
  if (visibility === "public") return "success-light"
  if (visibility === "password") return "warning-light"
  return "secondary"
}

export function formatBytes(value?: number) {
  if (!value || value < 0) return "unknown"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let size = value
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`
}

export function getInfoHash(metadata?: NormalizedResourceMetadata | null) {
  return metadata?.identifiers?.infoHash ?? "unknown"
}

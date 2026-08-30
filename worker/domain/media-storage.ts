export const LOCAL_MEDIA_PROVIDER = "local-media"
export const LOCAL_MEDIA_OBJECT_PREFIX = "uploads/"

export function createMediaProxyUrl(objectKey: string) {
  const encodedKey = objectKey
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  return `/api/v1/media/${encodedKey}`
}

export function isPublicMediaObjectKey(objectKey: string) {
  return (
    objectKey.startsWith("screenshots/") ||
    objectKey.startsWith("whatslink/") ||
    objectKey.startsWith("telegram/") ||
    objectKey.startsWith(LOCAL_MEDIA_OBJECT_PREFIX)
  )
}

export function getLocalMediaObjectKeys(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return []

  const media = (metadata as { media?: unknown }).media
  if (!Array.isArray(media)) return []

  return media.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const itemMetadata = (item as { metadata?: unknown }).metadata
    if (!itemMetadata || typeof itemMetadata !== "object") return []
    const { objectKey, thumbnailObjectKey } = itemMetadata as {
      objectKey?: unknown
      thumbnailObjectKey?: unknown
    }
    return [objectKey, thumbnailObjectKey].filter(
      (key): key is string =>
        typeof key === "string" && key.startsWith(LOCAL_MEDIA_OBJECT_PREFIX)
    )
  })
}

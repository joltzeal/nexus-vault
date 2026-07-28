import { parseCloudDriveLink, parseMagnetLink, parseTwitterLink, isCloudDriveResourceType, type ResourceType } from "@/domain/resources/input"

export type MetadataQueueMessage = {
  kind: "metadata.resolve"
  resourceId: string
  vaultId: string
  type: ResourceType
  dedupeKey?: string
  requestedAt: string
}

export function createMetadataQueueMessage(
  vaultId: string,
  resourceId: string,
  type: ResourceType,
  url: string
): MetadataQueueMessage {
  const parsedMagnet = type === "magnet" ? parseMagnetLink(url) : null
  const parsedTwitter = type === "twitter" ? parseTwitterLink(url) : null
  const parsedCloudDrive = isCloudDriveResourceType(type) ? parseCloudDriveLink(url) : null

  return {
    kind: "metadata.resolve",
    vaultId,
    resourceId,
    type,
    dedupeKey: parsedMagnet
      ? `magnet:${parsedMagnet.infoHash}`
      : parsedTwitter
        ? `twitter:${parsedTwitter.tweetId}`
        : parsedCloudDrive
          ? `${parsedCloudDrive.provider}:${parsedCloudDrive.url}`
          : undefined,
    requestedAt: new Date().toISOString(),
  }
}

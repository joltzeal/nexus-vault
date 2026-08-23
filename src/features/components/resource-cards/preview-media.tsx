import { ResourceMediaGallery } from "@/features/components/resource-media-gallery"
import { createSocialVideoMediaProxyUrl } from "@/domain/social-video-media"

import type {
  ResourceCardViewMode,
  ResourcePreviewMedia,
} from "./types"

export function PreviewMedia({
  items,
  proxyVideoPlayback = false,
  title,
  videoPlayback = "inline",
  viewMode,
}: {
  items?: ResourcePreviewMedia[]
  proxyVideoPlayback?: boolean
  title: string
  videoPlayback?: "external" | "inline"
  viewMode: ResourceCardViewMode
}) {
  const visibleItems = items?.filter((item) => item.url) ?? []
  if (visibleItems.length === 0) return null

  return (
    <ResourceMediaGallery
      media={visibleItems.map((item) => ({
        aspectRatio: item.width && item.height ? item.width / item.height : undefined,
        duration: item.duration,
        height: item.height,
        kind: item.kind,
        livePhoto: item.livePhoto
          ? {
              ...item.livePhoto,
              videoSrc: proxyVideoPlayback
                ? createSocialVideoMediaProxyUrl(item.livePhoto.videoUrl)
                : item.livePhoto.videoUrl,
            }
          : undefined,
        playback: item.kind === "video" ? videoPlayback : undefined,
        preview: item.previewUrl,
        src:
          item.kind === "video" && proxyVideoPlayback
            ? createSocialVideoMediaProxyUrl(item.url)
            : item.url,
        width: item.width,
      }))}
      title={title}
      variant={viewMode === "list" ? "scroll" : "carousel"}
    />
  )
}

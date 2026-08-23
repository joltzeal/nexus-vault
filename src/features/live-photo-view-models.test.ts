import assert from "node:assert/strict"
import test from "node:test"

import { createBaseResourceMetadata } from "@/domain/resources/metadata"
import { toResourceCardPreview } from "@/features/components/resource-cards/view-models"
import type { Resource } from "@/features/types"

import { getResourceMedia } from "./components/view-models"

const livePhotoVideoUrl =
  "https://www.douyin.com/aweme/v1/play/?video_id=live-photo-test"

const resource: Resource = {
  id: "live-photo-resource",
  spaceId: "space",
  title: "抖音实况照片",
  type: "douyin",
  url: "https://v.douyin.com/live-photo/",
  description: "",
  metadataStatus: "completed",
  metadata: {
    provider: "douyin-tiktok-download-api",
    data: {
      ...createBaseResourceMetadata({ type: "douyin" }),
      media: [{
        kind: "image",
        provider: "douyin-tiktok-download-api",
        url: "https://p3-pc-sign.douyinpic.com/live-photo.webp",
        width: 1008,
        height: 1506,
        metadata: {
          mediaType: "live_photo",
          livePhoto: {
            duration: 2.267,
            height: 1076,
            url: livePhotoVideoUrl,
            width: 720,
          },
        },
      }],
      preview: {
        kind: "social_video",
        data: {
          media: [{
            alt: "图片 1",
            height: 1506,
            kind: "image",
            livePhoto: {
              duration: 2.267,
              height: 1076,
              videoUrl: livePhotoVideoUrl,
              width: 720,
            },
            url: "https://p3-pc-sign.douyinpic.com/live-photo.webp",
            width: 1008,
          }],
          platform: "douyin",
          url: "https://v.douyin.com/live-photo/",
        },
      },
    },
  },
  position: 0,
  createdAt: "2026-08-12T00:00:00.000Z",
}

test("Live Photo media remains one image item with proxied video playback", () => {
  const media = getResourceMedia(resource)
  assert.equal(media.length, 1)
  assert.equal(media[0]?.kind, "image")
  assert.equal(media[0]?.livePhoto?.duration, "0:02")
  assert.equal(
    media[0]?.livePhoto?.videoSrc,
    `/api/v1/social-video/media?url=${encodeURIComponent(livePhotoVideoUrl)}`,
  )

  const preview = toResourceCardPreview(resource)
  assert.equal(preview?.kind, "social_video")
  if (preview?.kind !== "social_video") return
  assert.equal(preview.data.media?.length, 1)
  assert.equal(preview.data.media?.[0]?.kind, "image")
  assert.equal(preview.data.media?.[0]?.livePhoto?.duration, "0:02")
  assert.equal(preview.data.media?.[0]?.livePhoto?.videoUrl, livePhotoVideoUrl)
})

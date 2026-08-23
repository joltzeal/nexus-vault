import {
  createBaseResourceMetadata,
  type ResourceMediaMetadata,
} from "@/domain/resources/metadata"

import {
  RetryableMetadataError,
  type MetadataProvider,
  type MetadataProviderResource,
  type MetadataResult,
} from "../metadata-provider"

export const DOUYIN_TIKTOK_DOWNLOAD_API_PROVIDER = "douyin-tiktok-download-api"
const VIDEO_DATA_ENDPOINT = "https://api.tikhub.io/api/v1/hybrid/video_data"

type SocialVideoPlatform = "douyin" | "tiktok" | "bilibili" | "unknown"

type PostImage = {
  url: string
  width?: number
  height?: number
  livePhoto?: {
    duration?: number
    height?: number
    url: string
    width?: number
  }
}

type PostMediaClassification = {
  awemeType?: number
  contentType: "image" | "video"
  images: PostImage[]
}

export const douyinTiktokDownloadApiMetadataProvider: MetadataProvider = {
  name: DOUYIN_TIKTOK_DOWNLOAD_API_PROVIDER,
  supports(resource) {
    return resource.type === "douyin" || getSocialVideoPlatform(resource.url) !== "unknown"
  },
  async resolve(resource, options) {
    const sourceUrl = extractHttpUrl(resource.url)
    const platform = sourceUrl ? getSocialVideoPlatform(sourceUrl) : "unknown"
    const type = resource.type === "douyin" || platform === "douyin" ? "douyin" : resource.type
    const baseMetadata = createBaseResourceMetadata({ type, title: resource.title })

    if (!sourceUrl || (platform === "unknown" && resource.type !== "douyin")) {
      return {
        provider: DOUYIN_TIKTOK_DOWNLOAD_API_PROVIDER,
        status: "failed",
        data: baseMetadata,
        errorMessage: "Invalid Douyin, TikTok, or Bilibili URL.",
      }
    }

    const apiToken = options?.tikhubApiToken?.trim()
    if (!apiToken) {
      return {
        provider: DOUYIN_TIKTOK_DOWNLOAD_API_PROVIDER,
        status: "failed",
        data: baseMetadata,
        errorMessage: "TIKHUB_API_TOKEN is not configured.",
      }
    }

    const response = await fetchVideoData(sourceUrl, apiToken)
    if (!response.ok) {
      const message = `TikHub video_data request failed with HTTP ${response.status}.`
      if (options?.retryTransient && (response.status === 429 || response.status >= 500)) {
        throw new RetryableMetadataError(message)
      }
      return {
        provider: DOUYIN_TIKTOK_DOWNLOAD_API_PROVIDER,
        status: "failed",
        data: baseMetadata,
        errorMessage: message,
      }
    }

    const payload = await response.json().catch(() => null)
    if (!isRecord(payload) || Number(payload.code) !== 200 || !isRecord(payload.data)) {
      return {
        provider: DOUYIN_TIKTOK_DOWNLOAD_API_PROVIDER,
        status: "failed",
        data: baseMetadata,
        errorMessage: getApiError(payload) ?? "TikHub returned an invalid video_data response.",
      }
    }

    return createMetadataResult(resource, sourceUrl, platform, payload.data)
  },
}

function fetchVideoData(url: string, apiToken: string) {
  const endpoint = new URL(VIDEO_DATA_ENDPOINT)
  endpoint.searchParams.set("url", url)
  endpoint.searchParams.set("minimal", "false")

  return fetch(endpoint.toString(), {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
  })
}

function createMetadataResult(
  resource: MetadataProviderResource,
  sourceUrl: string,
  detectedPlatform: SocialVideoPlatform,
  data: Record<string, unknown>,
): MetadataResult {
  const platform = detectedPlatform === "unknown"
    ? inferPlatformFromPayload(data)
    : detectedPlatform
  const author = recordValue(data.author) ?? recordValue(data.owner) ?? {}
  const video = recordValue(data.video) ?? {}
  const statistics = recordValue(data.statistics) ?? recordValue(data.stats) ?? {}
  const mediaClassification = classifyPostMedia(data)
  const media = extractMedia(data, video, sourceUrl, mediaClassification)
  const previewMedia = media
    .filter((item) => item.kind === "video" || item.kind === "image")
    .map((item, index) => ({
      alt: item.kind === "image" ? `图片 ${index + 1}` : "视频",
      duration: item.duration,
      height: item.height,
      kind: item.kind,
      ...getLivePhotoPreview(item.metadata),
      previewUrl: item.thumbnailUrl,
      url: item.url,
      width: item.width,
    }))
  const videoTags = getVideoTags(data)
  const videoAddress = getVideoAddress(video)
  const durationSeconds = mediaClassification.contentType === "video"
    ? millisecondsToSeconds(numberValue(data.duration) ?? numberValue(video.duration))
    : undefined
  const authorName = firstString(author.nickname, author.name, author.display_name)
  const username = firstString(
    author.unique_id,
    author.username,
    author.short_id,
    author.uid,
  )
  const authorUrl = createAuthorUrl(platform, author, username)
  const avatarUrl = firstMediaUrl(
    author.avatar_thumb,
    author.avatar_medium,
    author.avatar_larger,
    author.avatar_url,
  )
  const explicitTitle = firstString(data.item_title, data.title, data.preview_title)
  const description = firstString(data.desc, data.caption, data.description)
  const title = normalizeTitle(explicitTitle ?? description ?? resource.title) || defaultTitle(platform)
  const createdAt = unixTimeToIso(numberValue(data.create_time) ?? numberValue(data.created_at))
  const videoId = firstString(data.aweme_id, data.id, data.item_id, data.bvid, data.aid)
  const fetchedAt = new Date().toISOString()
  const metrics = {
    collections: numberValue(statistics.collect_count ?? statistics.favorite_count),
    comments: numberValue(statistics.comment_count),
    likes: numberValue(statistics.digg_count ?? statistics.like_count),
    plays: numberValue(statistics.play_count ?? statistics.view_count),
    shares: numberValue(statistics.share_count),
  }
  const hasMetrics = Object.values(metrics).some((value) => typeof value === "number")

  return {
    provider: DOUYIN_TIKTOK_DOWNLOAD_API_PROVIDER,
    status: "completed",
    data: {
      ...createBaseResourceMetadata({
        type: resource.type === "douyin" || platform === "douyin" ? "douyin" : resource.type,
        title,
        fetchedAt,
      }),
      title,
      ...(description ? { description: normalizeText(description) } : {}),
      ...(media.length > 0 ? { media } : {}),
      identifiers: {
        ...(videoId ? { videoId } : {}),
      },
      source: {
        name: DOUYIN_TIKTOK_DOWNLOAD_API_PROVIDER,
        url: sourceUrl,
        attribution: {
          label: "TikHub",
          url: "https://api.tikhub.io/",
        },
      },
      preview: {
        kind: "social_video",
        data: {
          ...(authorName ? { authorName } : {}),
          ...(authorUrl ? { authorUrl } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
          ...(createdAt ? { createdAt } : {}),
          ...(description ? { description: normalizeText(description) } : {}),
          ...(typeof durationSeconds === "number" ? { duration: durationSeconds } : {}),
          ...(mediaClassification.contentType === "video" && videoAddress.height
            ? { height: videoAddress.height }
            : {}),
          media: previewMedia,
          ...(hasMetrics ? { metrics } : {}),
          platform,
          title,
          url: sourceUrl,
          ...(username ? { username } : {}),
          ...(videoId ? { videoId } : {}),
          ...(videoTags.length > 0 ? { videoTags } : {}),
          ...(mediaClassification.contentType === "video" && videoAddress.width
            ? { width: videoAddress.width }
            : {}),
        },
      },
      extra: {
        socialVideo: {
          api: VIDEO_DATA_ENDPOINT,
          platform,
          contentType: mediaClassification.contentType,
          ...(typeof mediaClassification.awemeType === "number"
            ? { awemeType: mediaClassification.awemeType }
            : {}),
          ...(authorName ? { authorName } : {}),
          ...(authorUrl ? { authorUrl } : {}),
          ...(username ? { username } : {}),
          ...(videoTags.length > 0 ? { videoTags } : {}),
        },
      },
    },
  }
}

function extractMedia(
  data: Record<string, unknown>,
  video: Record<string, unknown>,
  sourceUrl: string,
  classification: PostMediaClassification,
) {
  const media: ResourceMediaMetadata[] = []
  const videoAddress = getVideoAddress(video)
  const duration = millisecondsToSeconds(numberValue(data.duration) ?? numberValue(video.duration))
  const covers = uniqueUrls([
    ...mediaUrls(video.cover),
    ...mediaUrls(video.origin_cover),
    ...mediaUrls(video.cover_original_scale),
    ...mediaUrls(video.dynamic_cover),
  ])
  const thumbnailUrl = covers[0]

  if (classification.contentType === "image") {
    for (const [index, image] of classification.images.entries()) {
      media.push({
        kind: "image",
        provider: DOUYIN_TIKTOK_DOWNLOAD_API_PROVIDER,
        sourceId: `image:${index}`,
        sourceUrl,
        url: image.url,
        thumbnailUrl: image.url,
        ...(image.height ? { height: image.height } : {}),
        ...(image.width ? { width: image.width } : {}),
        ...(image.livePhoto
          ? {
              metadata: {
                mediaType: "live_photo",
                livePhoto: image.livePhoto,
              },
            }
          : {}),
      })
    }
  } else if (videoAddress.url) {
    media.push({
      kind: "video",
      provider: DOUYIN_TIKTOK_DOWNLOAD_API_PROVIDER,
      sourceUrl,
      url: videoAddress.url,
      ...(thumbnailUrl ? { thumbnailUrl } : {}),
      mimeType: "video/mp4",
      ...(typeof duration === "number" ? { duration } : {}),
      ...(videoAddress.height ? { height: videoAddress.height } : {}),
      ...(videoAddress.width ? { width: videoAddress.width } : {}),
      ...(videoAddress.size ? { size: videoAddress.size } : {}),
      metadata: {
        ...(videoAddress.quality ? { quality: videoAddress.quality } : {}),
      },
    })
  }

  return media
}

function getVideoAddress(video: Record<string, unknown>) {
  const candidates: unknown[] = [
    video.play_addr_h264,
    video.play_addr,
    video.download_addr,
  ]
  const bitRates = Array.isArray(video.bit_rate) ? video.bit_rate : []
  for (const item of bitRates) {
    if (isRecord(item)) candidates.push(item.play_addr)
  }

  for (const candidate of candidates) {
    const record = recordValue(candidate)
    const urls = mediaUrls(candidate)
    const url = urls.find(isOfficialDouyinPlayUrl) ?? urls[0]
    if (!url) continue
    return {
      url,
      height: numberValue(record?.height),
      width: numberValue(record?.width),
      size: numberValue(record?.data_size),
      quality: firstString(record?.url_key, record?.quality),
    }
  }

  return {
    url: undefined,
    height: numberValue(video.height),
    width: numberValue(video.width),
    size: undefined,
    quality: firstString(video.ratio, video.format),
  }
}

function isOfficialDouyinPlayUrl(value: string) {
  try {
    const url = new URL(value)
    return url.hostname.endsWith("douyin.com") && url.pathname === "/aweme/v1/play/"
  } catch {
    return false
  }
}

function classifyPostMedia(data: Record<string, unknown>): PostMediaClassification {
  const awemeType = numberValue(data.aweme_type)
  const images = dedupePostImages([
    ...extractPostImages(data.images, awemeType === 68),
    ...extractPostImages(data.image_list),
    ...extractPostImages(data.image_infos),
  ])

  return {
    ...(typeof awemeType === "number" ? { awemeType } : {}),
    contentType: awemeType === 2 || awemeType === 68 || images.length > 0
      ? "image"
      : "video",
    images,
  }
}

function extractPostImages(value: unknown, allowLivePhoto = false): PostImage[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const url = firstPreferredImageUrl(
      item.url_list,
      item.display_image,
      item.origin_image,
      item.download_url_list,
    )
    if (!url) return []
    const nestedVideo = allowLivePhoto ? recordValue(item.video) : undefined
    const livePhotoAddress = nestedVideo ? getVideoAddress(nestedVideo) : undefined
    const livePhotoDuration = nestedVideo
      ? strictMillisecondsToSeconds(numberValue(nestedVideo.duration))
      : undefined
    return [{
      url,
      ...(numberValue(item.height) ? { height: numberValue(item.height) } : {}),
      ...(numberValue(item.width) ? { width: numberValue(item.width) } : {}),
      ...(livePhotoAddress?.url
        ? {
            livePhoto: {
              url: livePhotoAddress.url,
              ...(typeof livePhotoDuration === "number"
                ? { duration: livePhotoDuration }
                : {}),
              ...(livePhotoAddress.height ? { height: livePhotoAddress.height } : {}),
              ...(livePhotoAddress.width ? { width: livePhotoAddress.width } : {}),
            },
          }
        : {}),
    }]
  })
}

function getLivePhotoPreview(metadata: ResourceMediaMetadata["metadata"]) {
  if (!isRecord(metadata) || metadata.mediaType !== "live_photo") return {}
  const livePhoto = recordValue(metadata.livePhoto)
  const videoUrl = firstString(livePhoto?.url)
  if (!videoUrl) return {}
  return {
    livePhoto: {
      videoUrl,
      ...(numberValue(livePhoto?.duration) ? { duration: numberValue(livePhoto?.duration) } : {}),
      ...(numberValue(livePhoto?.height) ? { height: numberValue(livePhoto?.height) } : {}),
      ...(numberValue(livePhoto?.width) ? { width: numberValue(livePhoto?.width) } : {}),
    },
  }
}

function dedupePostImages(images: PostImage[]) {
  return [...new Map(images.map((image) => [image.url, image])).values()]
}

function getVideoTags(data: Record<string, unknown>) {
  const tags: string[] = []
  for (const value of [data.video_tag, data.text_extra]) {
    if (!Array.isArray(value)) continue
    for (const item of value) {
      if (!isRecord(item)) continue
      const tag = firstString(item.tag_name, item.hashtag_name, item.name)
      if (tag) tags.push(tag)
    }
  }
  return [...new Set(tags)]
}

export function getSocialVideoPlatform(value: string): SocialVideoPlatform {
  const url = extractHttpUrl(value)
  if (!url) return "unknown"
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "")
    if (host === "douyin.com" || host.endsWith(".douyin.com") || host === "iesdouyin.com" || host.endsWith(".iesdouyin.com")) {
      return "douyin"
    }
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok"
    if (host === "bilibili.com" || host.endsWith(".bilibili.com") || host === "b23.tv") return "bilibili"
  } catch {
    return "unknown"
  }
  return "unknown"
}

function extractHttpUrl(value: string) {
  const match = value.trim().match(/https?:\/\/[^\s<>"'，。！？、]+/i)
  return match?.[0]?.replace(/[),.;!?，。！？、]+$/g, "")
}

function inferPlatformFromPayload(data: Record<string, unknown>): SocialVideoPlatform {
  if (firstString(data.aweme_id) || recordValue(data.author)?.sec_uid) return "douyin"
  if (firstString(data.bvid, data.aid)) return "bilibili"
  return "unknown"
}

function getApiError(value: unknown) {
  if (!isRecord(value)) return undefined
  return firstString(value.message, value.msg, value.detail)
}

function mediaUrls(value: unknown): string[] {
  if (typeof value === "string") {
    const normalized = normalizeUrl(value)
    return normalized ? [normalized] : []
  }
  if (Array.isArray(value)) return value.flatMap(mediaUrls)
  if (!isRecord(value)) return []
  return mediaUrls(value.url_list ?? value.urlList ?? value.urls ?? value.url ?? value.src)
}

function firstMediaUrl(...values: unknown[]) {
  for (const value of values) {
    const url = mediaUrls(value)[0]
    if (url) return url
  }
  return undefined
}

function firstPreferredImageUrl(...values: unknown[]) {
  const urls = uniqueUrls(values.flatMap(mediaUrls))
  if (urls.length === 0) return undefined
  return [...urls]
    .sort((left, right) => scoreBrowserFriendlyImageUrl(right) - scoreBrowserFriendlyImageUrl(left))[0]
}

function normalizeUrl(value: string) {
  try {
    return new URL(value.replace(/\\\//g, "/")).toString()
  } catch {
    return undefined
  }
}

function uniqueUrls(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function isHeicUrl(value: string) {
  const pathname = new URL(value).pathname.toLowerCase()
  return pathname.endsWith(".heic") || pathname.endsWith(".heif")
}

function scoreBrowserFriendlyImageUrl(value: string) {
  const pathname = new URL(value).pathname.toLowerCase()
  if (pathname.endsWith(".jpeg") || pathname.endsWith(".jpg")) return 100
  if (pathname.endsWith(".webp")) return 90
  if (pathname.endsWith(".png")) return 80
  if (pathname.endsWith(".avif")) return 70
  if (pathname.endsWith(".gif")) return 60
  if (pathname.endsWith(".bmp")) return 50
  if (pathname.endsWith(".tif") || pathname.endsWith(".tiff")) return 40
  if (pathname.endsWith(".image")) return 10
  if (isHeicUrl(value)) return 0
  return 20
}

function millisecondsToSeconds(value?: number) {
  if (typeof value !== "number" || value < 0) return undefined
  return value > 3_600 ? value / 1_000 : value
}

function strictMillisecondsToSeconds(value?: number) {
  if (typeof value !== "number" || value < 0) return undefined
  return value / 1_000
}

function unixTimeToIso(value?: number) {
  if (typeof value !== "number" || value <= 0) return undefined
  const milliseconds = value > 10_000_000_000 ? value : value * 1_000
  const date = new Date(milliseconds)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function defaultTitle(platform: SocialVideoPlatform) {
  if (platform === "tiktok") return "TikTok video"
  if (platform === "bilibili") return "Bilibili video"
  return "抖音视频"
}

function createAuthorUrl(
  platform: SocialVideoPlatform,
  author: Record<string, unknown>,
  username?: string,
) {
  if (platform === "douyin") {
    const secUid = firstString(author.sec_uid)
    return secUid ? `https://www.douyin.com/user/${encodeURIComponent(secUid)}` : undefined
  }
  if (platform === "tiktok" && username) {
    return `https://www.tiktok.com/@${encodeURIComponent(username.replace(/^@/, ""))}`
  }
  if (platform === "bilibili") {
    const mid = firstString(author.mid, author.uid, author.id)
    return mid ? `https://space.bilibili.com/${encodeURIComponent(mid)}` : undefined
  }
  return undefined
}

function normalizeText(value?: string) {
  return value?.replace(/\s+/g, " ").trim().slice(0, 5_000) || undefined
}

function normalizeTitle(value?: string) {
  return value?.replace(/\s+/g, " ").trim().slice(0, 200) || undefined
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return undefined
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function recordValue(value: unknown) {
  return isRecord(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

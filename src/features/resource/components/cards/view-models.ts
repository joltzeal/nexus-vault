import {
  parseGitHubLink,
  parseRedditPostLink,
  parseRedditSubredditLink,
  parseTelegramMessageLink,
  parseTwitterLink,
  parseTwitterProfileLink,
  parseWechatMpArticleLink,
  parseYoutubeVideoLink,
} from "@/features/resource/parsers/resource-link-parser"
import {
  isCloudDriveResourceType,
  parseCloudDriveLink,
} from "@/features/resource/input"
import type { MediaItem, Resource } from "@/features/resource/types"
import type { Tweet } from "react-tweet/api"

import type {
  GitHubReleaseCardData,
  GitHubRepositoryCardData,
  GitHubUserCardData,
  RedditPostCardData,
  RedditSubredditCardData,
  ResourceCardPreview,
  ResourcePreviewMedia,
  SocialVideoCardData,
  TelegramMessageCardData,
  WechatMpArticleCardData,
  XPostCardData,
  XProfileCardData,
  YoutubeVideoCardData,
} from "./types"

export type ResourcePillItem =
  | { key: string; kind: "status"; label: string; status: "online" | "warning" | "degraded" | "offline" | "unknown"; title?: string }
  | { key: string; kind: "copy"; label: string; value: string; ariaLabel: string }
  | { key: string; kind: "label"; label: string }

export function getResourceTitle(resource: Resource) {
  return resource.title?.trim() || resource.url || "Untitled resource"
}

export function getResourceDescription(resource: Resource) {
  return resource.description?.trim() || resource.metadata?.data?.description?.trim() || ""
}

export function getResourceDisplayUrl(resource: Resource) {
  return resource.url?.trim() || "No URL"
}

export function getResourceFaviconUrl(resource: Resource) {
  const source = resource.url
  if (!source || !/^https?:\/\//i.test(source)) return undefined
  try { return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(source).hostname)}&sz=32` } catch { return undefined }
}

export function getResourceMedia(resource: Resource): MediaItem[] {
  const media = resource.metadata?.data?.media
  if (!Array.isArray(media)) return []
  return media.flatMap((item, index) => {
    if (!item || typeof item !== "object") return []
    const value = item as Record<string, unknown>
    const url = typeof value.url === "string" ? value.url : typeof value.thumbnailUrl === "string" ? value.thumbnailUrl : ""
    if (!url) return []
    const kind = value.kind === "video" ? "video" : value.kind === "image" ? "image" : null
    if (!kind) return []
    const thumbnailUrl = typeof value.thumbnailUrl === "string" ? value.thumbnailUrl : undefined
    const isGofileMedia = value.provider === "gofile"
    const gofileProxyUrl = isGofileMedia
      ? `/api/v1/resources/${encodeURIComponent(resource.id)}/media/${index}/stream`
      : undefined
    const gofileThumbnailProxyUrl = isGofileMedia && thumbnailUrl && kind === "video"
      ? `${gofileProxyUrl}?variant=thumbnail`
      : undefined
    return [{
      kind,
      playback: (resource.type === "local_media" || isGofileMedia) && kind === "video" ? "inline" : "external",
      src: gofileProxyUrl ?? url,
      preview: thumbnailUrl,
      thumbnailUrl: gofileThumbnailProxyUrl ?? thumbnailUrl,
      alt: typeof value.fileName === "string" ? value.fileName : "",
      width: typeof value.width === "number" ? value.width : undefined,
      height: typeof value.height === "number" ? value.height : undefined,
    }]
  })
}

export function getResourcePillItems(resource: Resource): ResourcePillItem[] {
  const metadata = resource.metadata?.data
  const items: ResourcePillItem[] = []
  const fileType = metadata?.fileType ??
    (resource.type === "magnet" && metadata?.tree?.length ? "folder" : undefined)
  if (fileType) {
    items.push({ key: "file-type", kind: "label", label: fileType })
  }

  const fileCount = metadata?.fileCount ?? metadata?.media?.length
  if (typeof fileCount === "number" && fileCount > 0) {
    items.push({ key: "file-count", kind: "label", label: `${fileCount} files` })
  }

  if (typeof metadata?.size === "number" && metadata.size >= 0) {
    items.push({ key: "size", kind: "label", label: formatResourceBytes(metadata.size) })
  }

  items.push(...getCloudDrivePillItems(resource))

  return items
}

type CloudDriveAvailabilityStatus =
  | "available"
  | "unavailable"
  | "password_required"
  | "rate_limited"
  | "unknown"

function getCloudDrivePillItems(resource: Resource): ResourcePillItem[] {
  const metadata = resource.metadata?.data
  const extra = isRecord(metadata?.extra) ? metadata.extra : undefined
  const cloudDrive = extra && isRecord(extra.cloudDrive) ? extra.cloudDrive : {}
  const provider = typeof cloudDrive.provider === "string" ? cloudDrive.provider : ""
  const metadataType = typeof metadata?.type === "string" ? metadata.type : ""
  if (resource.type !== "gofile" &&
    metadataType !== "gofile" &&
    provider !== "gofile" &&
    !isCloudDriveResourceType(resource.type) &&
    !isCloudDriveResourceType(metadataType) &&
    !isCloudDriveResourceType(provider)) return []

  const availability = isRecord(cloudDrive.availability) ? cloudDrive.availability : {}
  const rawStatus = availability.status
  const status: CloudDriveAvailabilityStatus =
    rawStatus === "available" ||
    rawStatus === "unavailable" ||
    rawStatus === "password_required" ||
    rawStatus === "rate_limited" ||
    rawStatus === "unknown"
      ? rawStatus
      : "unknown"
  const statusPill = toAvailabilityPillStatus(status)
  const reason = typeof availability.reason === "string"
    ? availability.reason
    : "Cloud drive availability has not been checked."
  const metadataPassword = typeof cloudDrive.password === "string"
    ? cloudDrive.password.trim()
    : ""
  const password = metadataPassword || parseCloudDriveLink(resource.url ?? "")?.password

  return [
    {
      key: "cloud-drive-availability",
      kind: "status",
      label: statusPill.label,
      status: statusPill.status,
      title: reason,
    },
    ...(password
      ? [{
          key: "cloud-drive-extraction-code",
          kind: "copy" as const,
          label: "提取码",
          value: password,
          ariaLabel: "Copy cloud drive extraction code",
        }]
      : []),
  ]
}

function toAvailabilityPillStatus(status: CloudDriveAvailabilityStatus) {
  if (status === "available") {
    return { label: "Available", status: "online" as const }
  }
  if (status === "unavailable") {
    return { label: "Unavailable", status: "offline" as const }
  }
  if (status === "password_required") {
    return { label: "Password required", status: "warning" as const }
  }
  if (status === "rate_limited") {
    return { label: "Rate limited", status: "warning" as const }
  }
  return { label: "Unknown", status: "unknown" as const }
}

function formatResourceBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function getMetadataState(status: Resource["metadataStatus"]) {
  if (status === "pending") return { label: "Pending", status: "unknown" as const }
  if (status === "processing") return { label: "Processing", status: "degraded" as const }
  if (status === "failed") return { label: "Failed", status: "offline" as const }
  return { label: "Ready", status: "online" as const }
}

export function toResourceCardPreview(resource: Resource): ResourceCardPreview | null {
  const metadata = resource.metadata?.data
  const persisted = metadata?.preview
  if (persisted && isPreviewKind(persisted.kind) && isRecord(persisted.data)) {
    return {
      kind: persisted.kind,
      data: toPreviewData(persisted.kind, persisted.data, resource),
    } as ResourceCardPreview
  }

  return deriveLegacyPreview(resource)
}

function toPreviewData(
  kind: ResourceCardPreview["kind"],
  data: Record<string, unknown>,
  resource: Resource,
) {
  const url = stringValue(data.url) ?? resource.url ?? ""
  if (kind === "x_profile") {
    return {
      avatarUrl: stringValue(data.avatarUrl),
      bio: stringValue(data.bio),
      followersCount: numberValue(data.followersCount),
      followingCount: numberValue(data.followingCount),
      handle: stringValue(data.handle) ?? "",
      location: stringValue(data.location),
      name: stringValue(data.name),
      url,
      website: stringValue(data.website),
    } satisfies XProfileCardData
  }
  if (kind === "x_post") {
    return {
      authorName: stringValue(data.authorName),
      avatarUrl: stringValue(data.avatarUrl),
      createdAt: stringValue(data.createdAt),
      handle: stringValue(data.handle),
      media: normalizePreviewMedia(data.media),
      metrics: isRecord(data.metrics)
        ? {
            likes: numberValue(data.metrics.likes),
            replies: numberValue(data.metrics.replies),
            reposts: numberValue(data.metrics.reposts),
            views: numberValue(data.metrics.views),
          }
        : undefined,
      text: stringValue(data.text),
      tweet: tweetValue(data.tweet),
      tweetId: stringValue(data.tweetId) ?? "",
      url,
    } satisfies XPostCardData
  }
  if (kind === "github_user") {
    return {
      avatarUrl: stringValue(data.avatarUrl),
      bio: stringValue(data.bio),
      blog: stringValue(data.blog),
      company: stringValue(data.company),
      followers: numberValue(data.followers),
      following: numberValue(data.following),
      location: stringValue(data.location),
      login: stringValue(data.login) ?? "",
      name: stringValue(data.name),
      publicRepos: numberValue(data.publicRepos),
      totalForks: numberValue(data.totalForks),
      totalStars: numberValue(data.totalStars),
      topLanguages: stringArray(data.topLanguages),
      popularRepositories: normalizePopularRepositories(data.popularRepositories),
      type: data.type === "Organization" ? "Organization" : "User",
      url,
    } satisfies GitHubUserCardData
  }
  if (kind === "github_repository") {
    return {
      archived: data.archived === true,
      avatarUrl: stringValue(data.avatarUrl),
      defaultBranch: stringValue(data.defaultBranch),
      description: stringValue(data.description),
      contributors: normalizeContributors(data.contributors),
      forks: numberValue(data.forks),
      language: stringValue(data.language),
      languages: stringArray(data.languages),
      license: stringValue(data.license),
      name: stringValue(data.name) ?? "",
      openIssues: numberValue(data.openIssues),
      owner: stringValue(data.owner) ?? "",
      stars: numberValue(data.stars),
      topics: stringArray(data.topics),
      url,
      watchers: numberValue(data.watchers),
    } satisfies GitHubRepositoryCardData
  }
  if (kind === "github_release") {
    return {
      assetsCount: numberValue(data.assetsCount),
      authorAvatarUrl: stringValue(data.authorAvatarUrl),
      authorLogin: stringValue(data.authorLogin),
      body: stringValue(data.body),
      draft: data.draft === true,
      name: stringValue(data.name),
      owner: stringValue(data.owner) ?? "",
      prerelease: data.prerelease === true,
      publishedAt: stringValue(data.publishedAt),
      repository: stringValue(data.repository) ?? "",
      tag: stringValue(data.tag) ?? "",
      url,
    } satisfies GitHubReleaseCardData
  }
  if (kind === "social_video") {
    const media = normalizeSocialVideoMedia(normalizePreviewMedia(data.media))
    return {
      authorName: stringValue(data.authorName),
      authorUrl: stringValue(data.authorUrl),
      avatarUrl: stringValue(data.avatarUrl),
      createdAt: stringValue(data.createdAt),
      description: stringValue(data.description),
      duration: durationValue(data.duration),
      height: numberValue(data.height),
      media,
      metrics: isRecord(data.metrics)
        ? {
            collections: numberValue(data.metrics.collections),
            comments: numberValue(data.metrics.comments),
            likes: numberValue(data.metrics.likes),
            plays: numberValue(data.metrics.plays),
            shares: numberValue(data.metrics.shares),
          }
        : undefined,
      platform: socialVideoPlatformValue(data.platform),
      title: stringValue(data.title),
      url,
      username: stringValue(data.username),
      videoId: stringValue(data.videoId),
      videoTags: stringArray(data.videoTags),
      width: numberValue(data.width),
    } satisfies SocialVideoCardData
  }
  if (kind === "reddit_post") {
    return {
      authorAvatarUrl: stringValue(data.authorAvatarUrl),
      authorName: stringValue(data.authorName),
      authorUrl: stringValue(data.authorUrl),
      createdAt: stringValue(data.createdAt),
      domain: stringValue(data.domain),
      flairText: stringValue(data.flairText),
      isNsfw: data.isNsfw === true,
      media: normalizePreviewMedia(data.media),
      metrics: isRecord(data.metrics)
        ? {
            comments: numberValue(data.metrics.comments),
            score: numberValue(data.metrics.score),
            shares: numberValue(data.metrics.shares),
          }
        : undefined,
      postHint: stringValue(data.postHint),
      postId: stringValue(data.postId) ?? "",
      subredditIconUrl: stringValue(data.subredditIconUrl),
      subredditIsNsfw: data.subredditIsNsfw === true,
      subredditName: stringValue(data.subredditName),
      subredditPrefixedName: stringValue(data.subredditPrefixedName),
      subredditSubscribersCount: numberValue(data.subredditSubscribersCount),
      subredditTitle: stringValue(data.subredditTitle),
      subredditUrl: stringValue(data.subredditUrl),
      text: stringValue(data.text),
      title: stringValue(data.title),
      url,
    } satisfies RedditPostCardData
  }
  if (kind === "reddit_subreddit") {
    return {
      activeCount: numberValue(data.activeCount),
      bannerUrl: stringValue(data.bannerUrl),
      createdAt: stringValue(data.createdAt),
      description: stringValue(data.description),
      detectedLanguage: stringValue(data.detectedLanguage),
      iconUrl: stringValue(data.iconUrl),
      isNsfw: data.isNsfw === true,
      name: stringValue(data.name) ?? "",
      prefixedName: stringValue(data.prefixedName) ?? "",
      primaryColor: stringValue(data.primaryColor),
      subscribersCount: numberValue(data.subscribersCount),
      title: stringValue(data.title),
      type: stringValue(data.type),
      url,
      weeklyActiveUsersCount: numberValue(data.weeklyActiveUsersCount),
      weeklyContributionsCount: numberValue(data.weeklyContributionsCount),
    } satisfies RedditSubredditCardData
  }
  if (kind === "youtube_video") {
    return {
      category: stringValue(data.category),
      channelAvatarUrl: stringValue(data.channelAvatarUrl),
      channelId: stringValue(data.channelId),
      channelName: stringValue(data.channelName),
      channelUrl: stringValue(data.channelUrl),
      description: stringValue(data.description),
      duration: numberValue(data.duration),
      isLive: data.isLive === true,
      publishedAt: stringValue(data.publishedAt),
      subscribersText: stringValue(data.subscribersText),
      thumbnailUrl: stringValue(data.thumbnailUrl),
      title: stringValue(data.title),
      url,
      videoId: stringValue(data.videoId) ?? "",
      views: numberValue(data.views),
    } satisfies YoutubeVideoCardData
  }
  if (kind === "wechat_mp_article") {
    const metadata = resource.metadata?.data
    return {
      accountAvatarUrl: stringValue(data.accountAvatarUrl),
      accountName: stringValue(data.accountName),
      accountUsername: stringValue(data.accountUsername),
      albumTitle: stringValue(data.albumTitle),
      authorName: stringValue(data.authorName),
      contentHtml: stringValue(data.contentHtml) ?? metadata?.description ?? resource.description,
      coverUrl: stringValue(data.coverUrl),
      createdAt: stringValue(data.createdAt),
      excerpt: stringValue(data.excerpt),
      ipLocation: stringValue(data.ipLocation),
      messageId: stringValue(data.messageId),
      signature: stringValue(data.signature),
      tags: stringArray(data.tags),
      title: stringValue(data.title) ?? metadata?.title ?? resource.title,
      url,
    } satisfies WechatMpArticleCardData
  }
  return {
    authorAvatarUrl: stringValue(data.authorAvatarUrl),
    authorId: stringValue(data.authorId),
    authorName: stringValue(data.authorName),
    authorUsername: stringValue(data.authorUsername),
    avatarUrl: stringValue(data.avatarUrl),
    chatTitle: stringValue(data.chatTitle),
    chatType: chatTypeValue(data.chatType),
    chatUsername: stringValue(data.chatUsername),
    date: stringValue(data.date),
    editedAt: stringValue(data.editedAt),
    forwards: numberValue(data.forwards),
    media: normalizePreviewMedia(data.media),
    messageId: stringValue(data.messageId) ?? "",
    reactions: normalizeReactions(data.reactions),
    replies: numberValue(data.replies),
    text: stringValue(data.text),
    url,
    views: numberValue(data.views),
  } satisfies TelegramMessageCardData
}

function deriveLegacyPreview(resource: Resource): ResourceCardPreview | null {
  const url = resource.url ?? ""
  const metadata = resource.metadata?.data
  const twitter = isRecord(metadata?.extra?.twitter) ? metadata.extra.twitter : undefined
  const twitterUser = isRecord(twitter?.user) ? twitter.user : undefined
  const persistedTweet = tweetValue(twitter?.tweet)
  const telegram = isRecord(metadata?.extra?.telegram) ? metadata.extra.telegram : undefined
  const wechatMp = isRecord(metadata?.extra?.wechatMp) ? metadata.extra.wechatMp : undefined

  if (resource.type === "douyin") {
    return {
      kind: "social_video",
      data: {
        description: metadata?.description ?? resource.description,
        media: normalizePreviewMedia(metadata?.media),
        platform: "douyin",
        title: metadata?.title ?? resource.title,
        url,
      },
    }
  }

  const youtubeVideo = parseYoutubeVideoLink(url)
  if (youtubeVideo || resource.type === "youtube") {
    const media = normalizePreviewMedia(metadata?.media)
    return {
      kind: "youtube_video",
      data: {
        description: metadata?.description ?? resource.description,
        duration: numberValue(media[0]?.duration),
        thumbnailUrl: media[0]?.previewUrl ?? media[0]?.url,
        title: metadata?.title ?? resource.title,
        url: youtubeVideo?.url ?? url,
        videoId: youtubeVideo?.videoId ?? "resource",
      },
    }
  }

  const profile = parseTwitterProfileLink(url)
  if (profile) {
    return {
      kind: "x_profile",
      data: { handle: `@${profile.username}`, url: profile.url },
    }
  }

  const tweet = parseTwitterLink(url)
  if (tweet || stringValue(twitter?.tweetId) || resource.type === "twitter") {
    return {
      kind: "x_post",
      data: {
        authorName: persistedTweet?.user.name ?? stringValue(twitter?.authorName),
        avatarUrl:
          persistedTweet?.user.profile_image_url_https ??
          stringValue(twitterUser?.profile_image_url_https),
        handle: persistedTweet?.user.screen_name
          ? `@${persistedTweet.user.screen_name}`
          : stringValue(twitter?.username)
            ? `@${stringValue(twitter?.username)}`
            : tweet?.username
              ? `@${tweet.username}`
              : undefined,
        media: normalizePreviewMedia(metadata?.media),
        text: metadata?.description ?? resource.description,
        tweet: persistedTweet,
        tweetId: stringValue(twitter?.tweetId) ?? tweet?.tweetId ?? "resource",
        url: tweet?.url ?? url,
      },
    }
  }

  const redditSubreddit = parseRedditSubredditLink(url)
  const redditPost = parseRedditPostLink(url)
  if (redditSubreddit && !redditPost) {
    return {
      kind: "reddit_subreddit",
      data: {
        description: metadata?.description ?? resource.description,
        name: redditSubreddit.name,
        prefixedName: `r/${redditSubreddit.name}`,
        title: metadata?.title ?? resource.title,
        url: redditSubreddit.url,
      },
    }
  }
  if (redditPost || resource.type === "reddit") {
    return {
      kind: "reddit_post",
      data: {
        media: normalizePreviewMedia(metadata?.media),
        postId: redditPost?.postId ?? "resource",
        text: metadata?.description ?? resource.description,
        title: metadata?.title ?? resource.title,
        url: redditPost?.url ?? url,
      },
    }
  }

  const github = parseGitHubLink(url)
  if (github) {
    if (github.kind === "user") {
      return { kind: "github_user", data: { login: github.login, url: github.url } }
    }
    if (github.kind === "repository") {
      return {
        kind: "github_repository",
        data: { owner: github.owner, name: github.repository, url: github.url },
      }
    }
    return {
      kind: "github_release",
      data: {
        owner: github.owner,
        repository: github.repository,
        tag: github.tag ?? "latest",
        url: github.url,
      },
    }
  }

  const telegramLink = parseTelegramMessageLink(url)
  if (telegramLink || telegram || resource.type === "telegram") {
    return {
      kind: "telegram_message",
      data: {
        authorAvatarUrl: stringValue(telegram?.authorAvatarUrl),
        authorId: stringValue(telegram?.authorId),
        authorName: stringValue(telegram?.authorName),
        authorUsername: stringValue(telegram?.authorUsername),
        avatarUrl: stringValue(telegram?.chatAvatarUrl) ?? stringValue(telegram?.avatarUrl),
        chatTitle: stringValue(telegram?.chatTitle),
        chatType: chatTypeValue(telegram?.chatType),
        chatUsername: stringValue(telegram?.chatUsername) ?? telegramLink?.chatUsername,
        date: stringValue(telegram?.date),
        editedAt: stringValue(telegram?.editedAt),
        forwards: numberValue(telegram?.forwards),
        media: normalizePreviewMedia(metadata?.media ?? telegram?.media),
        messageId: stringValue(telegram?.messageId) ?? telegramLink?.messageId ?? "",
        reactions: normalizeReactions(telegram?.reactions),
        replies: numberValue(telegram?.replies),
        text: metadata?.description ?? resource.description,
        url: telegramLink?.url ?? url,
        views: numberValue(telegram?.views),
      },
    }
  }

  const wechatMpLink = parseWechatMpArticleLink(url)
  if (wechatMpLink || resource.type === "wechat_mp") {
    return {
      kind: "wechat_mp_article",
      data: {
        albumTitle: stringValue(wechatMp?.albumTitle),
        contentHtml: metadata?.description ?? resource.description,
        excerpt: stringValue(wechatMp?.excerpt),
        ipLocation: stringValue(wechatMp?.ipLocation),
        signature: stringValue(wechatMp?.signature),
        tags: stringArray(wechatMp?.tags),
        title: metadata?.title ?? resource.title,
        url: wechatMpLink?.url ?? url,
      },
    }
  }

  return null
}

function normalizeSocialVideoMedia(media: ResourcePreviewMedia[]) {
  const video = media.find((item) => item.kind === "video")
  return video ? [video] : media.filter((item) => item.kind === "image")
}

function normalizePreviewMedia(value: unknown): ResourcePreviewMedia[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!isRecord(item)) return []
    const url = stringValue(item.url)
    const previewUrl = stringValue(item.previewUrl) ?? stringValue(item.thumbnailUrl)
    const kind = item.kind === "video" ? "video" : item.kind === "image" ? "image" : null
    if (!kind || (!url && !previewUrl)) return []
    return [{
      alt: stringValue(item.alt) ?? "",
      duration: durationValue(item.duration),
      height: numberValue(item.height),
      kind,
      livePhoto: normalizeLivePhoto(item.livePhoto),
      previewUrl,
      url: url ?? previewUrl ?? "",
      width: numberValue(item.width),
    }]
  })
}

function normalizeLivePhoto(value: unknown): ResourcePreviewMedia["livePhoto"] {
  if (!isRecord(value)) return undefined
  const videoUrl = stringValue(value.videoUrl)
  if (!videoUrl) return undefined
  return {
    videoUrl,
    duration: durationValue(value.duration),
    height: numberValue(value.height),
    width: numberValue(value.width),
  }
}

function durationValue(value: unknown) {
  const persisted = stringValue(value)
  if (persisted) return persisted
  const seconds = numberValue(value)
  if (typeof seconds !== "number" || seconds < 0) return undefined

  const totalSeconds = Math.round(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}

function chatTypeValue(value: unknown) {
  return value === "channel" || value === "group" || value === "private"
    ? value
    : undefined
}

function socialVideoPlatformValue(value: unknown): SocialVideoCardData["platform"] {
  return value === "douyin" || value === "tiktok" || value === "bilibili"
    ? value
    : "unknown"
}

function normalizeReactions(value: unknown) {
  if (!Array.isArray(value)) return undefined
  const reactions = value.flatMap((item) => {
    if (!isRecord(item)) return []
    const emoji = stringValue(item.emoji)
    const count = numberValue(item.count)
    return emoji && typeof count === "number" ? [{ emoji, count }] : []
  })
  return reactions.length > 0 ? reactions : undefined
}

function tweetValue(value: unknown): Tweet | undefined {
  if (!isRecord(value)) return undefined
  const user = isRecord(value.user) ? value.user : undefined
  const displayTextRange = value.display_text_range
  if (
    !stringValue(value.id_str) ||
    typeof value.text !== "string" ||
    !stringValue(value.created_at) ||
    !Array.isArray(displayTextRange) ||
    displayTextRange.length !== 2 ||
    !user ||
    !stringValue(user.name) ||
    !stringValue(user.screen_name)
  ) {
    return undefined
  }

  return value as unknown as Tweet
}

function isPreviewKind(value: unknown): value is ResourceCardPreview["kind"] {
  return value === "x_profile" || value === "x_post" || value === "github_user" ||
    value === "github_repository" || value === "github_release" || value === "telegram_message" ||
    value === "wechat_mp_article" || value === "social_video" ||
    value === "reddit_subreddit" || value === "reddit_post" || value === "youtube_video"
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined
}

function normalizePopularRepositories(value: unknown) {
  if (!Array.isArray(value)) return undefined
  return value.flatMap((item) => {
    if (!isRecord(item) || !stringValue(item.name)) return []
    return [{
      forks: numberValue(item.forks),
      name: stringValue(item.name) ?? "",
      stars: numberValue(item.stars),
      url: stringValue(item.url),
    }]
  })
}

function normalizeContributors(value: unknown) {
  if (!Array.isArray(value)) return undefined
  return value.flatMap((item) => {
    if (!isRecord(item) || !stringValue(item.login)) return []
    return [{
      avatarUrl: stringValue(item.avatarUrl),
      login: stringValue(item.login) ?? "",
    }]
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object")
}

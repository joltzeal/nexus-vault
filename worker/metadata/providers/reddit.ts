import {
  parseRedditPostLink,
  parseRedditSubredditLink,
} from "../../domain/resources/input"
import {
  createBaseResourceMetadata,
  type ResourceMediaMetadata,
} from "../../domain/resources/metadata"

import {
  RetryableMetadataError,
  type MetadataProvider,
  type MetadataProviderResource,
  type MetadataResult,
} from "../metadata-provider"

export const REDDIT_METADATA_PROVIDER = "reddit-tikhub"
const SUBREDDIT_INFO_ENDPOINT = "https://api.tikhub.io/api/v1/reddit/app/fetch_subreddit_info"
const POST_DETAILS_ENDPOINT = "https://api.tikhub.io/api/v1/reddit/app/fetch_post_details"

export const redditMetadataProvider: MetadataProvider = {
  name: REDDIT_METADATA_PROVIDER,
  supports(resource) {
    return (
      resource.type === "reddit" ||
      parseRedditPostLink(resource.url) !== null ||
      parseRedditSubredditLink(resource.url) !== null
    )
  },
  async resolve(resource, options) {
    const baseMetadata = createBaseResourceMetadata({ type: "reddit", title: resource.title })
    const subreddit = parseRedditSubredditLink(resource.url)
    const post = parseRedditPostLink(resource.url)

    if (!subreddit && !post) {
      return {
        provider: REDDIT_METADATA_PROVIDER,
        status: "failed",
        data: baseMetadata,
        errorMessage: "Invalid Reddit post or subreddit URL.",
      }
    }

    const apiToken = options?.tikhubApiToken?.trim()
    if (!apiToken) {
      return {
        provider: REDDIT_METADATA_PROVIDER,
        status: "failed",
        data: baseMetadata,
        errorMessage: "TIKHUB_API_TOKEN is not configured.",
      }
    }

    const response = subreddit
      ? await fetchRedditApi(SUBREDDIT_INFO_ENDPOINT, {
          need_format: "true",
          subreddit_name: subreddit.name,
        }, apiToken)
      : await fetchRedditApi(POST_DETAILS_ENDPOINT, {
          include_comment_id: "false",
          need_format: "true",
          post_id: withPostPrefix(post?.postId ?? ""),
        }, apiToken)

    if (!response.ok) {
      const message = `TikHub Reddit request failed with HTTP ${response.status}.`
      if (options?.retryTransient && (response.status === 429 || response.status >= 500)) {
        throw new RetryableMetadataError(message)
      }
      return {
        provider: REDDIT_METADATA_PROVIDER,
        status: "failed",
        data: baseMetadata,
        errorMessage: message,
      }
    }

    const payload = await response.json().catch(() => null)
    if (!isRecord(payload) || Number(payload.code) !== 200 || !isRecord(payload.data)) {
      return {
        provider: REDDIT_METADATA_PROVIDER,
        status: "failed",
        data: baseMetadata,
        errorMessage: getApiError(payload) ?? "TikHub returned an invalid Reddit response.",
      }
    }

    return subreddit
      ? createSubredditMetadataResult(subreddit, payload.data)
      : createPostMetadataResult(resource, post?.postId ?? "", payload.data)
  },
}

function fetchRedditApi(
  endpoint: string,
  params: Record<string, string>,
  apiToken: string,
) {
  const url = new URL(endpoint)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  return fetch(url.toString(), {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(25_000),
  })
}

function withPostPrefix(postId: string) {
  return postId.startsWith("t3_") ? postId : `t3_${postId}`
}

function createPostMetadataResult(
  resource: MetadataProviderResource,
  fallbackPostId: string,
  data: Record<string, unknown>,
): MetadataResult {
  const posts = Array.isArray(data.postsInfoByIds) ? data.postsInfoByIds : []
  const post = posts.find((item): item is Record<string, unknown> => isRecord(item))
  if (!post) {
    return {
      provider: REDDIT_METADATA_PROVIDER,
      status: "failed",
      data: createBaseResourceMetadata({ type: "reddit", title: resource.title }),
      errorMessage: "TikHub returned no Reddit post details.",
    }
  }

  const postId = firstString(post.id) ?? fallbackPostId
  const permalink = firstString(post.permalink)
  const postUrl = permalink ? `https://www.reddit.com${permalink}` : resource.url
  const subreddit = recordValue(post.subreddit) ?? {}
  const author = recordValue(post.authorInfo) ?? {}
  const flair = recordValue(post.flair) ?? {}
  const media = extractPostMedia(post, postId, postUrl)
  const previewMedia = media.map((item) => ({
    alt: "视频",
    duration: item.duration,
    height: item.height,
    kind: item.kind,
    previewUrl: item.thumbnailUrl,
    url: item.url,
    width: item.width,
  }))
  const title = normalizeTitle(firstString(post.postTitle) ?? resource.title) || "Reddit post"
  const text = normalizeText(firstString(post.selftext, post.text, post.body))
  const createdAt = redditDateToIso(firstString(post.createdAt))
  const subredditName = firstString(subreddit.name)
  const authorName = firstString(author.name)
  const metrics = {
    comments: numberValue(post.commentCount),
    score: numberValue(post.score),
    shares: numberValue(recordValue(post.postStats)?.shareAllTotal),
  }
  const hasMetrics = Object.values(metrics).some((value) => typeof value === "number")

  return {
    provider: REDDIT_METADATA_PROVIDER,
    status: "completed",
    data: {
      ...createBaseResourceMetadata({ type: "reddit", title }),
      title,
      ...(text ? { description: text } : {}),
      ...(media.length > 0 ? { media } : {}),
      identifiers: {
        ...(postId ? { postId } : {}),
      },
      source: {
        name: "reddit",
        url: postUrl,
        attribution: {
          label: "TikHub",
          url: "https://api.tikhub.io/",
        },
      },
      preview: {
        kind: "reddit_post",
        data: {
          postId,
          url: postUrl,
          title,
          ...(text ? { text } : {}),
          ...(createdAt ? { createdAt } : {}),
          ...(subredditName
            ? {
                subredditName,
                subredditPrefixedName:
                  firstString(subreddit.prefixedName) ?? `r/${subredditName}`,
                subredditTitle: firstString(subreddit.title),
                subredditIconUrl: firstString(recordValue(subreddit.styles)?.icon),
                subredditUrl: `https://www.reddit.com/r/${subredditName}`,
                subredditSubscribersCount: numberValue(subreddit.subscribersCount),
                subredditIsNsfw: subreddit.isNsfw === true,
              }
            : {}),
          ...(authorName
            ? {
                authorName,
                authorUrl: `https://www.reddit.com/user/${encodeURIComponent(authorName)}`,
                authorAvatarUrl: firstMediaUrl(
                  recordValue(author.newIcon),
                  recordValue(author.iconSmall),
                ),
              }
            : {}),
          flairText: firstString(flair.text),
          isNsfw: post.isNsfw === true,
          domain: firstString(post.domain),
          postHint: firstString(post.postHint),
          ...(media.length > 0 ? { media: previewMedia } : {}),
          ...(hasMetrics ? { metrics } : {}),
        },
      },
      extra: {
        reddit: {
          api: POST_DETAILS_ENDPOINT,
          kind: "post",
          ...(postId ? { postId } : {}),
          ...(subredditName ? { subredditName } : {}),
          ...(authorName ? { authorName } : {}),
          ...(flair.text ? { flairText: flair.text } : {}),
          isNsfw: post.isNsfw === true,
          ...(post.domain ? { domain: post.domain } : {}),
          ...(post.postHint ? { postHint: post.postHint } : {}),
        },
      },
    },
  }
}

function extractPostMedia(
  post: Record<string, unknown>,
  postId: string,
  postUrl: string,
): ResourceMediaMetadata[] {
  const mediaRoot = recordValue(post.media)
  const downloadUrl = firstString(recordValue(mediaRoot?.download)?.url)
  if (!mediaRoot || !downloadUrl) return []

  const streaming = recordValue(mediaRoot.streaming) ?? {}
  const video = recordValue(mediaRoot.video) ?? {}
  const dimensions = recordValue(streaming.dimensions) ?? recordValue(video.dimensions) ?? {}
  const thumbnailUrl = firstMediaUrl(
    recordValue(recordValue(mediaRoot.still)?.source),
    recordValue(post.thumbnail),
  )

  return [{
    kind: "video",
    provider: REDDIT_METADATA_PROVIDER,
    sourceId: postId,
    sourceUrl: postUrl,
    url: downloadUrl,
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    mimeType: "video/mp4",
    ...(numberValue(streaming.duration) !== undefined
      ? { duration: numberValue(streaming.duration) }
      : {}),
    ...(numberValue(dimensions.height) ? { height: numberValue(dimensions.height) } : {}),
    ...(numberValue(dimensions.width) ? { width: numberValue(dimensions.width) } : {}),
    metadata: {
      ...(streaming.isGif !== undefined ? { isGif: streaming.isGif === true } : {}),
      ...(firstString(post.postHint) ? { postHint: firstString(post.postHint) } : {}),
    },
  }]
}

function createSubredditMetadataResult(
  subreddit: { name: string; url: string },
  data: Record<string, unknown>,
): MetadataResult {
  const info = recordValue(data.subredditInfoByName)
  if (!info) {
    return {
      provider: REDDIT_METADATA_PROVIDER,
      status: "failed",
      data: createBaseResourceMetadata({ type: "reddit", title: subreddit.name }),
      errorMessage: "TikHub returned no Reddit subreddit info.",
    }
  }

  const styles = recordValue(info.styles) ?? {}
  const communityStats = recordValue(info.communityStats) ?? {}
  const name = firstString(info.name) ?? subreddit.name
  const prefixedName = firstString(info.prefixedName) ?? `r/${name}`
  const description = normalizeText(
    firstString(
      recordValue(info.description)?.markdown,
      info.publicDescriptionText,
    ),
  )
  const title = normalizeTitle(firstString(info.title) ?? name) || prefixedName
  const createdAt = redditDateToIso(firstString(info.createdAt))
  const url = firstString(info.path)
    ? `https://www.reddit.com${normalizeRedditPath(firstString(info.path) ?? "")}`
    : subreddit.url

  return {
    provider: REDDIT_METADATA_PROVIDER,
    status: "completed",
    data: {
      ...createBaseResourceMetadata({ type: "reddit", title }),
      title,
      ...(description ? { description } : {}),
      identifiers: { subredditName: name },
      source: {
        name: "reddit",
        url,
        attribution: {
          label: "TikHub",
          url: "https://api.tikhub.io/",
        },
      },
      preview: {
        kind: "reddit_subreddit",
        data: {
          name,
          prefixedName,
          url,
          title,
          ...(description ? { description } : {}),
          iconUrl: firstString(styles.icon),
          bannerUrl: firstString(styles.bannerBackgroundImage ?? styles.mobileBannerImage),
          primaryColor: firstString(styles.primaryColor),
          subscribersCount: numberValue(info.subscribersCount),
          activeCount: numberValue(info.activeCount),
          weeklyActiveUsersCount: numberValue(communityStats.weeklyActiveUsersCount),
          weeklyContributionsCount: numberValue(communityStats.weeklyContributionsCount),
          ...(createdAt ? { createdAt } : {}),
          isNsfw: info.isNsfw === true,
          ...(firstString(info.type) ? { type: firstString(info.type) } : {}),
          ...(firstString(info.detectedLanguage)
            ? { detectedLanguage: firstString(info.detectedLanguage) }
            : {}),
        },
      },
      extra: {
        reddit: {
          api: SUBREDDIT_INFO_ENDPOINT,
          kind: "subreddit",
          subredditName: name,
          ...(firstString(info.id) ? { subredditId: firstString(info.id) } : {}),
          isNsfw: info.isNsfw === true,
          ...(firstString(info.type) ? { type: firstString(info.type) } : {}),
        },
      },
    },
  }
}

/**
 * Reddit/TikHub timestamps use 6-digit fractions and colon-less offsets
 * ("2026-09-04T11:33:06.198000+0000"), which `new Date()` cannot parse.
 */
function redditDateToIso(value?: string) {
  if (!value) return undefined
  const normalized = value
    .replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d{3})\d+/, "$1.$2")
    .replace(/([+-]\d{2}):?(\d{2})$/, "$1:$2")
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function normalizeRedditPath(value: string) {
  return value.startsWith("/") ? value : `/${value}`
}

function getApiError(value: unknown) {
  if (!isRecord(value)) return undefined
  return firstString(value.message, value.msg, value.detail)
}

function firstMediaUrl(...values: Array<Record<string, unknown> | undefined>) {
  for (const value of values) {
    const url = firstString(value?.url)
    if (url) return url
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

import {
  ApiError as ScraperApiError,
  AuthenticationError,
  ErrorRateLimitStrategy,
  Scraper,
  type Profile as ScraperProfile,
  type Tweet as ScraperTweet,
} from "@the-convocation/twitter-scraper"
import {
  getTweet,
  TwitterApiError as SyndicationApiError,
  type Tweet as SyndicatedTweet,
} from "react-tweet/api"

import {
  createBaseResourceMetadata,
  type ResourceMediaMetadata,
} from "@/domain/resources/metadata"
import {
  parseTwitterLink,
  parseTwitterProfileLink,
} from "@/domain/resources/input"

import {
  RetryableMetadataError,
  type MetadataProvider,
} from "../metadata-provider"

type TwitterOEmbedResponse = {
  author_name?: string
  author_url?: string
  html?: string
  url?: string
}

type ResolvedTweet = {
  media: ResourceMediaMetadata[]
  metrics: {
    bookmarks?: number
    likes?: number
    replies?: number
    reposts?: number
    views?: number
  }
  provider: "react-tweet" | "twitter-scraper"
  tweet: SyndicatedTweet
}

type FetchAttempt<T> = {
  data?: T
  retryableError?: string
}

export const twitterMetadataProvider: MetadataProvider = {
  name: "twitter",
  supports: (resource) => resource.type === "twitter",
  async resolve(resource, options) {
    const parsed = parseTwitterLink(resource.url)
    const baseMetadata = createBaseResourceMetadata({
      type: "twitter",
      title: resource.title,
    })

    const profile = parseTwitterProfileLink(resource.url)
    if (profile) {
      return resolveTwitterProfile(
        profile.username,
        baseMetadata,
        options?.retryTransient,
      )
    }

    if (!parsed) {
      return {
        provider: "twitter",
        status: "failed",
        data: baseMetadata,
        errorMessage: "Invalid x.com tweet URL.",
      }
    }

    const retryableErrors: string[] = []
    const syndication = await fetchSyndicatedTweet(parsed.tweetId)
    if (syndication.data) {
      return createResolvedTweetMetadata(baseMetadata, {
        media: getSyndicatedTweetMedia(syndication.data),
        metrics: {
          likes: syndication.data.favorite_count,
          replies: syndication.data.conversation_count,
          reposts: getOptionalNumber(syndication.data, "retweet_count"),
          views: syndication.data.video?.viewCount,
        },
        provider: "react-tweet",
        tweet: syndication.data,
      })
    }
    if (syndication.retryableError) retryableErrors.push(syndication.retryableError)

    if (options?.twitterCookieString) {
      const scraped = await fetchTweetWithCookie(
        parsed.tweetId,
        options.twitterCookieString,
      )
      if (scraped.data) {
        const tweet = toSyndicatedTweet(
          scraped.data.tweet,
          scraped.data.profile,
          parsed.tweetId,
          parsed.username,
        )
        return createResolvedTweetMetadata(baseMetadata, {
          media: getScrapedTweetMedia(scraped.data.tweet),
          metrics: {
            bookmarks: scraped.data.tweet.bookmarkCount,
            likes: scraped.data.tweet.likes,
            replies: scraped.data.tweet.replies,
            reposts: scraped.data.tweet.retweets,
            views: scraped.data.tweet.views,
          },
          provider: "twitter-scraper",
          tweet,
        })
      }
      if (scraped.retryableError) retryableErrors.push(scraped.retryableError)
    }

    const oembedAttempt = await fetchTweetOEmbed(resource.url)
    const oembed = oembedAttempt.data
    if (oembedAttempt.retryableError) retryableErrors.push(oembedAttempt.retryableError)
    if (!oembed) {
      if (retryableErrors.length > 0 && options?.retryTransient) {
        throw new RetryableMetadataError(retryableErrors.join(" "))
      }

      return {
        provider: "twitter",
        status: "failed",
        data: {
          ...baseMetadata,
          identifiers: { tweetId: parsed.tweetId },
          source: { name: "x.com", url: parsed.url },
          preview: {
            kind: "x_post",
            data: {
              tweetId: parsed.tweetId,
              url: parsed.url,
              handle: parsed.username ? `@${parsed.username}` : undefined,
            },
          },
        },
        errorMessage:
          retryableErrors.join(" ") ||
          (options?.twitterCookieString
            ? "Tweet metadata is unavailable with the configured X cookie."
            : "Tweet metadata is unavailable. Configure an X cookie for restricted posts."),
      }
    }

    const description = oembed?.html ? stripHtml(oembed.html) : undefined
    const authorUsername = getUsernameFromAuthorUrl(oembed?.author_url) ?? parsed.username

    return {
      provider: "twitter-oembed",
      status: "completed",
      data: {
        ...baseMetadata,
        title: getTweetTitle(oembed?.author_name, authorUsername),
        description,
        identifiers: {
          tweetId: parsed.tweetId,
        },
        source: {
          name: "twitter-oembed",
          url: oembed?.url ?? resource.url,
        },
        extra: {
          twitter: {
            tweetId: parsed.tweetId,
            username: authorUsername,
            authorName: oembed?.author_name,
            authorUrl: oembed?.author_url,
            html: oembed?.html,
          },
        },
        preview: {
          kind: "x_post",
          data: {
            tweetId: parsed.tweetId,
            url: oembed?.url ?? resource.url,
            authorName: oembed?.author_name,
            handle: authorUsername ? `@${authorUsername}` : undefined,
            text: description,
          },
        },
      },
    }
  },
}

async function fetchSyndicatedTweet(tweetId: string) {
  try {
    const tweet = await getTweet(tweetId, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    })
    return {
      data: isSyndicatedTweet(tweet) ? tweet : undefined,
    } satisfies FetchAttempt<SyndicatedTweet>
  } catch (error) {
    console.error("react-tweet request failed", { tweetId, error })
    return {
      retryableError: getRetryableTwitterError(error, "X syndication request"),
    } satisfies FetchAttempt<SyndicatedTweet>
  }
}

function createResolvedTweetMetadata(
  baseMetadata: ReturnType<typeof createBaseResourceMetadata>,
  resolved: ResolvedTweet,
) {
  const { tweet } = resolved
  const tweetUrl = `https://x.com/${tweet.user.screen_name}/status/${tweet.id_str}`

  return {
    provider: resolved.provider,
    status: "completed" as const,
    data: {
      ...baseMetadata,
      title: getTweetTitle(tweet.user.name, tweet.user.screen_name),
      description: tweet.text,
      ...(resolved.media.length > 0 ? { media: resolved.media } : {}),
      identifiers: { tweetId: tweet.id_str },
      source: {
        name: "x.com",
        url: tweetUrl,
      },
      extra: {
        twitter: {
          tweetId: tweet.id_str,
          user: tweet.user,
          counts: resolved.metrics,
          sensitiveContent: tweet.possibly_sensitive,
        },
      },
      preview: {
        kind: "x_post" as const,
        data: {
          tweet,
          tweetId: tweet.id_str,
          url: tweetUrl,
          authorName: tweet.user.name,
          avatarUrl: tweet.user.profile_image_url_https,
          handle: `@${tweet.user.screen_name}`,
          createdAt: tweet.created_at,
          text: tweet.text,
          media: resolved.media,
          metrics: {
            likes: resolved.metrics.likes,
            replies: resolved.metrics.replies,
            reposts: resolved.metrics.reposts,
            views: resolved.metrics.views,
          },
        },
      },
    },
  }
}

function isSyndicatedTweet(value: unknown): value is SyndicatedTweet {
  if (!value || typeof value !== "object") return false
  const tweet = value as Partial<SyndicatedTweet>
  return Boolean(
    normalizeString(tweet.id_str) &&
    typeof tweet.text === "string" &&
    tweet.user &&
    normalizeString(tweet.user.name) &&
    normalizeString(tweet.user.screen_name) &&
    normalizeString(tweet.user.profile_image_url_https),
  )
}

function getSyndicatedTweetMedia(tweet: SyndicatedTweet): ResourceMediaMetadata[] {
  const media: ResourceMediaMetadata[] = []
  for (const [index, detail] of (tweet.mediaDetails ?? []).entries()) {
    if (detail.type === "photo") {
      media.push({
        height: detail.original_info.height,
        kind: "image",
        provider: "twitter",
        sourceId: `photo:${index}`,
        sourceUrl: detail.media_url_https,
        thumbnailUrl: detail.media_url_https,
        url: detail.media_url_https,
        width: detail.original_info.width,
        metadata: { altText: detail.ext_alt_text },
      })
      continue
    }

    const variants = detail.video_info.variants
      .filter((variant) => variant.content_type === "video/mp4")
      .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))
    const source = variants[0]
    if (!source) continue
    const durationMillis = getOptionalNumber(detail.video_info, "duration_millis")
    media.push({
      ...(typeof durationMillis === "number"
        ? { duration: durationMillis / 1000 }
        : {}),
      height: detail.original_info.height,
      kind: "video",
      provider: "twitter",
      sourceId: `video:${index}`,
      sourceUrl: source.url,
      url: source.url,
      thumbnailUrl: detail.media_url_https,
      width: detail.original_info.width,
    })
  }
  return media
}

type TwitterProfileResponse = {
  name?: unknown
  handle?: unknown
  bio?: unknown
  avatarUrl?: unknown
  followingCount?: unknown
  followersCount?: unknown
  location?: unknown
  website?: unknown
}

async function resolveTwitterProfile(
  username: string,
  baseMetadata: ReturnType<typeof createBaseResourceMetadata>,
  retryTransient?: boolean,
) {
  const fallback = {
    ...baseMetadata,
    identifiers: { username },
    source: { name: "x.com", url: `https://x.com/${username}` },
    preview: {
      kind: "x_profile" as const,
      data: { handle: `@${username}`, url: `https://x.com/${username}` },
    },
  }

  try {
    const response = await fetch("https://xprofilecards.com/api/scrape-twitter", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ twitterUrl: `https://x.com/${username}` }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) {
      if (isTransientHttpResponse(response)) {
        throw new RetryableMetadataError(
          `X profile request failed with HTTP ${response.status}.`,
        )
      }
      return {
        provider: "x-profile",
        status: "failed" as const,
        data: fallback,
        errorMessage: `X profile request failed with HTTP ${response.status}.`,
      }
    }

    const payload = await response.json()
    const profile = isTwitterProfileResponse(payload) ? payload : null
    if (!profile) {
      return {
        provider: "x-profile",
        status: "failed" as const,
        data: fallback,
        errorMessage: "X profile response was invalid.",
      }
    }

    const handle = normalizeString(profile.handle) || `@${username}`
    const name = normalizeString(profile.name) || username
    const data = {
      avatarUrl: normalizeString(profile.avatarUrl),
      bio: normalizeString(profile.bio),
      followersCount: parseCount(profile.followersCount),
      followingCount: parseCount(profile.followingCount),
      handle,
      location: normalizeString(profile.location),
      name,
      url: `https://x.com/${username}`,
      website: normalizeString(profile.website),
    }

    return {
      provider: "x-profile",
      status: "completed" as const,
      data: {
        ...baseMetadata,
        title: name,
        description: data.bio,
        identifiers: { username },
        source: { name: "x.com", url: data.url },
        preview: { kind: "x_profile" as const, data },
        extra: { twitter: { username, profile: data } },
      },
    }
  } catch (error) {
    if (error instanceof RetryableMetadataError && retryTransient) throw error
    const retryableError = getRetryableTwitterError(error, "X profile request")
    if (retryableError && retryTransient) {
      throw new RetryableMetadataError(retryableError)
    }

    return {
      provider: "x-profile",
      status: "failed" as const,
      data: fallback,
      errorMessage:
        error instanceof Error
          ? error.message
          : retryableError ?? "X profile request failed.",
    }
  }
}

function isTwitterProfileResponse(value: unknown): value is TwitterProfileResponse {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  return ["name", "handle", "bio", "avatarUrl", "followersCount", "followingCount"]
    .some((key) => key in candidate)
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function parseCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return undefined
  const parsed = Number.parseInt(value.replace(/,/g, ""), 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

function toSyndicatedTweet(
  tweet: ScraperTweet,
  profile: ScraperProfile | undefined,
  fallbackTweetId: string,
  fallbackUsername?: string,
): SyndicatedTweet {
  const id = tweet.id ?? fallbackTweetId
  const text = tweet.text ?? ""
  const username = tweet.username ?? profile?.username ?? fallbackUsername ?? "i"
  const createdAt = getScrapedTweetCreatedAt(tweet, id)
  const versions = tweet.versions?.length ? tweet.versions : [id]

  return {
    __typename: "Tweet",
    conversation_count: tweet.replies ?? 0,
    created_at: createdAt,
    display_text_range: [0, Array.from(text).length],
    edit_control: {
      edit_tweet_ids: versions,
      editable_until_msecs: "0",
      edits_remaining: "0",
      is_edit_eligible: false,
    },
    entities: {
      hashtags: [],
      symbols: [],
      urls: [],
      user_mentions: [],
    },
    favorite_count: tweet.likes ?? 0,
    id_str: id,
    isEdited: tweet.isEdited ?? versions.length > 1,
    isStaleEdit: false,
    lang: "und",
    news_action_type: "conversation",
    possibly_sensitive: tweet.sensitiveContent,
    text,
    user: {
      id_str: profile?.userId ?? tweet.userId ?? username,
      is_blue_verified: profile?.isBlueVerified ?? false,
      name: tweet.name ?? profile?.name ?? username,
      profile_image_shape: "Circle",
      profile_image_url_https: profile?.avatar ?? "",
      screen_name: username,
      verified: profile?.isVerified ?? false,
    },
  }
}

function getScrapedTweetCreatedAt(tweet: ScraperTweet, tweetId: string) {
  if (tweet.timeParsed && !Number.isNaN(tweet.timeParsed.getTime())) {
    return tweet.timeParsed.toISOString()
  }
  if (typeof tweet.timestamp === "number" && Number.isFinite(tweet.timestamp)) {
    return new Date(tweet.timestamp * 1000).toISOString()
  }

  try {
    const twitterEpoch = 1_288_834_974_657n
    const timestamp = Number((BigInt(tweetId) >> 22n) + twitterEpoch)
    if (Number.isFinite(timestamp)) return new Date(timestamp).toISOString()
  } catch {
    // Keep a valid Tweet shape even when a non-Snowflake fallback ID is returned.
  }

  return new Date(0).toISOString()
}

function getScrapedTweetMedia(tweet: ScraperTweet): ResourceMediaMetadata[] {
  const media: ResourceMediaMetadata[] = []

  for (const [index, photo] of tweet.photos.entries()) {
    if (!photo.url) continue
    media.push({
      kind: "image",
      provider: "twitter",
      sourceId: `photo:${index}`,
      sourceUrl: photo.url,
      url: photo.url,
      thumbnailUrl: photo.url,
      ...(photo.alt_text ? { metadata: { altText: photo.alt_text } } : {}),
    })
  }

  for (const [index, video] of tweet.videos.entries()) {
    if (!video.url) continue
    media.push({
      kind: "video",
      provider: "twitter",
      sourceId: `video:${index}`,
      sourceUrl: video.url,
      url: video.url,
      ...(video.preview ? { thumbnailUrl: video.preview } : {}),
    })
  }

  return media
}

async function fetchTweetWithCookie(
  tweetId: string,
  cookieString: string,
): Promise<FetchAttempt<{ profile?: ScraperProfile; tweet: ScraperTweet }>> {
  try {
    const scraper = new Scraper({
      fetch: fetchWithTimeout,
      rateLimitStrategy: new ErrorRateLimitStrategy(),
    })
    await scraper.setCookies(splitCookieString(cookieString))
    const tweet = await scraper.getTweet(tweetId)
    if (!tweet) return {}

    const profile = tweet.username
      ? await scraper.getProfile(tweet.username).catch((error) => {
          console.warn("Twitter profile lookup failed for scraped tweet", {
            tweetId,
            username: tweet.username,
            error,
          })
          const retryableError = getRetryableTwitterError(
            error,
            "X profile lookup",
          )
          if (retryableError) throw new RetryableMetadataError(retryableError)
          return undefined
        })
      : undefined
    return { data: { profile, tweet } }
  } catch (error) {
    console.error("Twitter cookie-authenticated request failed", {
      tweetId,
      error,
    })
    return {
      retryableError:
        error instanceof RetryableMetadataError
          ? error.message
          : getRetryableTwitterError(error, "Cookie-authenticated X request"),
    }
  }
}

function getOptionalNumber(value: unknown, key: string) {
  if (!value || typeof value !== "object") return undefined
  const candidate = (value as Record<string, unknown>)[key]
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : undefined
}

const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(8_000),
  })

function splitCookieString(cookieString: string) {
  return cookieString
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.includes("="))
}

async function fetchTweetOEmbed(url: string): Promise<FetchAttempt<TwitterOEmbedResponse>> {
  const endpoint = new URL("https://publish.twitter.com/oembed")
  endpoint.searchParams.set("url", url)
  endpoint.searchParams.set("omit_script", "1")
  endpoint.searchParams.set("dnt", "1")

  try {
    const response = await fetch(endpoint, {
      headers: {
        accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    })

    if (!response.ok) {
      return {
        retryableError: isTransientHttpResponse(response)
          ? `X oEmbed request failed with HTTP ${response.status}.`
          : undefined,
      }
    }

    const payload: unknown = await response.json()
    return isTwitterOEmbedResponse(payload) ? { data: payload } : {}
  } catch (error) {
    console.error("Twitter oEmbed request failed", { url, error })
    return {
      retryableError: getRetryableTwitterError(error, "X oEmbed request"),
    }
  }
}

function isTwitterOEmbedResponse(value: unknown): value is TwitterOEmbedResponse {
  if (!value || typeof value !== "object") return false
  const candidate = value as TwitterOEmbedResponse
  return Boolean(
    normalizeString(candidate.author_name) ||
    normalizeString(candidate.author_url) ||
    normalizeString(candidate.html) ||
    normalizeString(candidate.url),
  )
}

function isTransientHttpResponse(response: Response) {
  return (
    response.status === 408 ||
    response.status === 425 ||
    response.status === 429 ||
    response.status >= 500
  )
}

function getRetryableTwitterError(error: unknown, label: string) {
  if (error instanceof SyndicationApiError) {
    return isTransientStatus(error.status)
      ? `${label} failed with HTTP ${error.status}.`
      : undefined
  }
  if (error instanceof ScraperApiError) {
    return isTransientHttpResponse(error.response)
      ? `${label} failed with HTTP ${error.response.status}.`
      : undefined
  }
  if (error instanceof AuthenticationError) return undefined
  if (!isTransientNetworkError(error)) return undefined
  return `${label} failed temporarily: ${getErrorMessage(error)}`
}

function isTransientStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500
}

function isTransientNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    error instanceof TypeError ||
    /\b(timeout|timed out|network|fetch|econn|enotfound|eai_again)\b/.test(message)
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Network request failed."
}

function getTweetTitle(authorName?: string, fallbackUsername?: string) {
  if (authorName) return `${authorName}@x.com`
  return fallbackUsername ? `${fallbackUsername}@x.com` : "x.com"
}

function getUsernameFromAuthorUrl(authorUrl?: string) {
  if (!authorUrl) return undefined
  try {
    const url = new URL(authorUrl)
    return url.pathname.split("/").filter(Boolean)[0]
  } catch {
    return undefined
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

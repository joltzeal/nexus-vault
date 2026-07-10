import { Scraper, type Tweet } from "@the-convocation/twitter-scraper"

import { createBaseResourceMetadata } from "@nexus-vault/shared/resource-metadata"
import { parseTwitterLink } from "@nexus-vault/shared/resource-input"

import type { MetadataProvider, MetadataResolveOptions } from "../metadata-provider"

export const twitterMetadataProvider: MetadataProvider = {
  name: "twitter-scraper",
  supports: (resource) => resource.type === "twitter",
  async resolve(resource, options) {
    const parsed = parseTwitterLink(resource.url)
    const baseMetadata = createBaseResourceMetadata({
      type: "twitter",
      title: resource.title,
    })

    if (!parsed) {
      return {
        provider: "twitter-scraper",
        status: "failed",
        data: baseMetadata,
        errorMessage: "Invalid x.com tweet URL.",
      }
    }

    const scraper = createTwitterScraper(options)
    let tweet = null

    try {
      await installTwitterCookies(scraper, options)
      tweet = await scraper.getTweet(parsed.tweetId)
    } catch (error) {
      console.error("Twitter scraper request failed", {
        resourceId: resource.id,
        url: resource.url,
        tweetId: parsed.tweetId,
        error,
      })
      throw error
    }

    console.log("Twitter scraper response", {
      resourceId: resource.id,
      url: resource.url,
      tweet,
    })

    return {
      provider: "twitter-scraper",
      status: "completed",
      data: {
        ...baseMetadata,
        title: getTweetTitle(tweet, parsed.username),
        description: tweet?.text,
        cover: getTweetCover(tweet),
        screenshots: getTweetScreenshots(tweet),
        fileType: tweet?.videos.length ? "video" : tweet?.photos.length ? "image" : undefined,
        fileCount: (tweet?.photos.length ?? 0) + (tweet?.videos.length ?? 0) || undefined,
        identifiers: {
          tweetId: parsed.tweetId,
          ...(tweet?.userId ? { userId: tweet.userId } : {}),
        },
        source: {
          name: "twitter-scraper",
          url: resource.url,
        },
        extra: {
          twitter: {
            tweetId: parsed.tweetId,
            username: parsed.username,
            permanentUrl: tweet?.permanentUrl,
            text: tweet?.text,
            photos: tweet?.photos.map((photo) => ({
              id: photo.id,
              url: photo.url,
              altText: photo.alt_text,
            })),
            videos: tweet?.videos.map((video) => ({
              id: video.id,
              preview: video.preview,
              url: video.url,
            })),
          },
        },
      },
    }
  },
}

function createTwitterScraper(options?: MetadataResolveOptions) {
  const proxyUrl = options?.twitterRequestProxyUrl ?? getTwitterRequestProxyUrl()

  return new Scraper({
    fetch,
    ...(proxyUrl
      ? {
          transform: {
            request(input, init) {
              if (input instanceof URL) {
                return [createProxiedTwitterRequestUrl(proxyUrl, input.toString()), init]
              }
              if (typeof input === "string") {
                return [createProxiedTwitterRequestUrl(proxyUrl, input), init]
              }
              return [input, init]
            },
          },
        }
      : {}),
  })
}

async function installTwitterCookies(scraper: Scraper, options?: MetadataResolveOptions) {
  const cookieString = options?.twitterCookieString ?? getTwitterCookieString()
  if (!cookieString) return

  const cookies = cookieString
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.includes("="))

  if (!cookies.length) return

  await scraper.setCookies(cookies)

  const isLoggedIn = await scraper.isLoggedIn()
  console.log("Twitter scraper cookie auth", {
    cookieNames: cookies.map((cookie) => cookie.split("=")[0]).filter(Boolean),
    isLoggedIn,
  })
}

function getTwitterRequestProxyUrl() {
  return getRuntimeEnv("TWITTER_REQUEST_PROXY_URL")
}

function getTwitterCookieString() {
  return getRuntimeEnv("TWITTER_COOKIE_STRING")
}

function getRuntimeEnv(name: string) {
  try {
    const runtime = globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>
      }
    }
    const value = runtime.process?.env?.[name]?.trim()
    return value || undefined
  } catch {
    return undefined
  }
}

function createProxiedTwitterRequestUrl(proxyUrl: string, targetUrl: string) {
  return proxyUrl.includes("{url}")
    ? proxyUrl.replace("{url}", encodeURIComponent(targetUrl))
    : `${proxyUrl}${encodeURIComponent(targetUrl)}`
}

function getTweetTitle(tweet: Tweet | null, fallbackUsername?: string) {
  const username = tweet?.username ?? fallbackUsername
  return username ? `X.com@${username}` : "X.com"
}

function getTweetCover(tweet: Tweet | null) {
  if (tweet?.videos.length) return undefined
  return tweet?.photos[0]?.url
}

function getTweetScreenshots(tweet: Tweet | null) {
  if (!tweet) return undefined
  if (tweet.videos.length) return undefined

  const images = tweet.photos.map((photo) => photo.url).filter(Boolean)

  return images.length ? [...new Set(images)] : undefined
}

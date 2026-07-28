import { createBaseResourceMetadata } from "@/domain/resources/metadata"
import { parseTwitterLink } from "@/domain/resources/input"

import type { MetadataProvider } from "../metadata-provider"

type TwitterOEmbedResponse = {
  author_name?: string
  author_url?: string
  html?: string
  url?: string
}

export const twitterMetadataProvider: MetadataProvider = {
  name: "twitter-oembed",
  supports: (resource) => resource.type === "twitter",
  async resolve(resource) {
    const parsed = parseTwitterLink(resource.url)
    const baseMetadata = createBaseResourceMetadata({
      type: "twitter",
      title: resource.title,
    })

    if (!parsed) {
      return {
        provider: "twitter-oembed",
        status: "failed",
        data: baseMetadata,
        errorMessage: "Invalid x.com tweet URL.",
      }
    }

    const oembed = await fetchTweetOEmbed(resource.url)
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
      },
    }
  },
}

async function fetchTweetOEmbed(url: string) {
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

    if (!response.ok) return null

    return (await response.json()) as TwitterOEmbedResponse
  } catch (error) {
    console.error("Twitter oEmbed request failed", { url, error })
    return null
  }
}

function getTweetTitle(authorName?: string, fallbackUsername?: string) {
  if (authorName) return `X.com @ ${authorName}`
  return fallbackUsername ? `X.com @ ${fallbackUsername}` : "X.com"
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

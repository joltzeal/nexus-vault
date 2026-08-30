import assert from "node:assert/strict"
import test from "node:test"

import {
  ErrorRateLimitStrategy,
  Scraper,
} from "@the-convocation/twitter-scraper"
import { getTweet } from "react-tweet/api"

const REQUEST_TIMEOUT_MS = 30_000
const input = parseTweetUrl(getTweetUrlArgument(process.argv.slice(2)))

test("fetch Tweet with react-tweet syndication API", async () => {
  const startedAt = performance.now()
  const tweet = await getTweet(input.tweetId, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  assert.ok(tweet, `react-tweet returned no data for ${input.url}`)
  assert.equal(tweet.id_str, input.tweetId)

  console.info("\n[react-tweet] result", {
    durationMs: Math.round(performance.now() - startedAt),
    tweet,
  })
})

test("fetch Tweet with twitter-scraper, optionally using an X cookie", async () => {
  const cookieString = process.env.X_COM_COOKIE?.trim()

  const scraper = new Scraper({
    fetch: fetchWithTimeout,
    rateLimitStrategy: new ErrorRateLimitStrategy(),
  })
  if (cookieString) {
    await scraper.setCookies(splitCookieString(cookieString))
  }

  const startedAt = performance.now()
  const tweet = await scraper.getTweet(input.tweetId)

  assert.ok(tweet, `twitter-scraper returned no data for ${input.url}`)
  assert.equal(tweet.id, input.tweetId)

  console.info("\n[twitter-scraper] result", {
    authentication: cookieString ? "cookie" : "guest",
    durationMs: Math.round(performance.now() - startedAt),
    tweet,
  })
})

function getTweetUrlArgument(args: string[]) {
  const value = args
    .map(extractUrlArgument)
    .find((argument): argument is string => Boolean(argument))
  assert.ok(
    value,
    "Pass an X status URL, for example: pnpm test:twitter -- https://x.com/user/status/123",
  )
  return value
}

function extractUrlArgument(argument: string) {
  const markdownLink = argument.match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/i)
  if (markdownLink?.[1]) return markdownLink[1]

  const directUrl = argument.match(/https?:\/\/[^\s\])]+/i)
  return directUrl?.[0]
}

function parseTweetUrl(value: string) {
  const url = new URL(value)
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "")
  assert.ok(
    ["x.com", "twitter.com", "mobile.x.com", "mobile.twitter.com"].includes(
      hostname,
    ),
    `Unsupported X host: ${url.hostname}`,
  )

  const segments = url.pathname.split("/").filter(Boolean)
  const statusIndex = segments.findIndex((segment) =>
    ["status", "statuses"].includes(segment.toLowerCase()),
  )
  const tweetId = statusIndex >= 0 ? segments[statusIndex + 1] : undefined
  assert.match(tweetId ?? "", /^\d+$/, `Invalid X status URL: ${value}`)

  return {
    tweetId: tweetId!,
    url: url.toString(),
  }
}

function splitCookieString(cookieString: string) {
  return cookieString
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.includes("="))
}

const fetchWithTimeout: typeof fetch = (resource, init) =>
  fetch(resource, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

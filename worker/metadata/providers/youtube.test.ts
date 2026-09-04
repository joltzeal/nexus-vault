import assert from "node:assert/strict"
import test from "node:test"

import {
  parseYoutubeVideoLink,
} from "../../domain/resources/input"

import { RetryableMetadataError } from "../metadata-provider"
import { youtubeMetadataProvider } from "./youtube"

const videoResource = {
  id: "youtube-video-resource",
  type: "youtube" as const,
  title: "YouTube video",
  description: "",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
}

const watchPageHtml = (playerResponse: unknown, initialData?: unknown) => `
<!DOCTYPE html>
<html><head><title>YouTube</title></head>
<body>
<script>var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};</script>
${initialData ? `<script>var ytInitialData = ${JSON.stringify(initialData)};</script>` : ""}
</body></html>
`

const playerResponse = {
  videoDetails: {
    videoId: "dQw4w9WgXcQ",
    title: "Never Gonna Give You Up",
    author: "Rick Astley",
    channelId: "UCuAXFkgsw1L7xaCfnd5JJOw",
    shortDescription: "The official video for Never Gonna Give You Up.\n\nFrom the album Whenever You Need Somebody.\nSubscribe for more.",
    lengthSeconds: "213",
    viewCount: "1600000000",
    thumbnail: {
      thumbnails: [
        { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", width: 480, height: 360 },
        { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg", width: 1280, height: 720 },
      ],
    },
    isLiveContent: false,
  },
  microformat: {
    playerMicroformatRenderer: {
      publishDate: "2009-10-25T06:57:33-07:00",
      uploadDate: "2009-10-25T06:57:33-07:00",
      viewCount: "1600000000",
      lengthSeconds: "213",
      category: "Music",
      thumbnail: {
        thumbnails: [{ url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg", width: 1280, height: 720 }],
      },
    },
  },
}

test("YouTube link parser canonicalizes watch, shorts, live, and youtu.be URLs", () => {
  assert.deepEqual(parseYoutubeVideoLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s"), {
    videoId: "dQw4w9WgXcQ",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  })
  assert.deepEqual(parseYoutubeVideoLink("https://youtu.be/dQw4w9WgXcQ?si=abc"), {
    videoId: "dQw4w9WgXcQ",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  })
  assert.deepEqual(parseYoutubeVideoLink("https://www.youtube.com/shorts/dQw4w9WgXcQ"), {
    videoId: "dQw4w9WgXcQ",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  })
  assert.deepEqual(parseYoutubeVideoLink("https://music.youtube.com/watch?v=dQw4w9WgXcQ"), {
    videoId: "dQw4w9WgXcQ",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  })
  assert.equal(parseYoutubeVideoLink("https://www.youtube.com/@RickAstleyYT"), null)
  assert.equal(parseYoutubeVideoLink("https://vimeo.com/12345678901"), null)
  assert.equal(parseYoutubeVideoLink("https://www.youtube.com/watch?v=shortid"), null)
})

test("YouTube provider merges oEmbed and watch page data into a card preview", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = getRequestUrl(input)
    if (url.startsWith("https://www.youtube.com/oembed")) {
      return jsonResponse({
        author_name: "Rick Astley",
        author_url: "https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw",
        thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        title: "Never Gonna Give You Up",
      })
    }
    if (url.includes("youtube.com/watch")) {
      return new Response(watchPageHtml(playerResponse, {
        contents: [
          {
            videoSecondaryInfoRenderer: {
              owner: {
                videoOwnerRenderer: {
                  thumbnailRenderer: {
                    channelThumbnailWithLinkRenderer: {
                      thumbnail: {
                        thumbnails: [
                          { url: "https://yt3.ggpht.com/avatar=s48", height: 48 },
                          { url: "https://yt3.ggpht.com/avatar=s176", height: 176 },
                        ],
                      },
                    },
                  },
                  subscriberCountText: { simpleText: "4.2M subscribers" },
                },
              },
            },
          },
        ],
      }), {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    }
    throw new Error(`Unexpected request: ${url}`)
  })

  const result = await youtubeMetadataProvider.resolve(videoResource)

  assert.equal(result.provider, "youtube")
  assert.equal(result.status, "completed")
  assert.equal(result.data.title, "Never Gonna Give You Up")
  assert.equal(
    result.data.description,
    "The official video for Never Gonna Give You Up.\n\nFrom the album Whenever You Need Somebody.\nSubscribe for more.",
  )
  assert.deepEqual(result.data.identifiers, {
    channelId: "UCuAXFkgsw1L7xaCfnd5JJOw",
    videoId: "dQw4w9WgXcQ",
  })
  assert.equal(result.data.source?.url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
  assert.equal(result.data.media?.[0]?.url, "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg")
  assert.equal(result.data.preview?.kind, "youtube_video")

  const preview = result.data.preview?.data
  assert.equal(preview?.videoId, "dQw4w9WgXcQ")
  assert.equal(preview?.duration, 213)
  assert.equal(preview?.views, 1_600_000_000)
  assert.equal(preview?.publishedAt, "2009-10-25T13:57:33.000Z")
  assert.equal(preview?.channelName, "Rick Astley")
  assert.equal(preview?.channelUrl, "https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw")
  assert.equal(preview?.channelAvatarUrl, "https://yt3.ggpht.com/avatar=s176")
  assert.equal(preview?.subscribersText, "4.2M subscribers")
  assert.equal(preview?.category, "Music")
  assert.equal(preview?.thumbnailUrl, "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg")
})

test("YouTube provider completes with oEmbed-only data when the watch page fails", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = getRequestUrl(input)
    if (url.startsWith("https://www.youtube.com/oembed")) {
      return jsonResponse({
        author_name: "Rick Astley",
        author_url: "https://www.youtube.com/@RickAstleyYT",
        thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        title: "Never Gonna Give You Up",
      })
    }
    return new Response(null, { status: 500 })
  })

  const result = await youtubeMetadataProvider.resolve(videoResource)

  assert.equal(result.status, "completed")
  assert.equal(result.data.title, "Never Gonna Give You Up")
  assert.equal(result.data.description, undefined)
  assert.equal(
    result.data.preview?.data.thumbnailUrl,
    "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  )
  assert.equal(result.data.preview?.data.channelAvatarUrl, undefined)
})

test("YouTube provider fails for unavailable videos", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = getRequestUrl(input)
    if (url.startsWith("https://www.youtube.com/oembed")) {
      return new Response(null, { status: 404 })
    }
    return jsonResponse({ playabilityStatus: { status: "ERROR" } }, 404)
  })

  const result = await youtubeMetadataProvider.resolve({
    ...videoResource,
    url: "https://www.youtube.com/watch?v=AAAAAAAAAAA",
  })

  assert.equal(result.status, "failed")
  assert.match(result.errorMessage ?? "", /unavailable/)
})

test("YouTube provider fails for non-video URLs", async () => {
  const result = await youtubeMetadataProvider.resolve({
    ...videoResource,
    url: "https://www.youtube.com/@RickAstleyYT",
  })

  assert.equal(result.status, "failed")
  assert.match(result.errorMessage ?? "", /Invalid YouTube/)
})

test("YouTube provider exposes transient failures to the queue", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 503 }))

  await assert.rejects(
    youtubeMetadataProvider.resolve(videoResource, { retryTransient: true }),
    RetryableMetadataError,
  )
})

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  })
}

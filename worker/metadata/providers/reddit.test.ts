import assert from "node:assert/strict"
import test from "node:test"

import {
  parseRedditPostLink,
  parseRedditSubredditLink,
} from "../../domain/resources/input"

import { RetryableMetadataError } from "../metadata-provider"
import { redditMetadataProvider } from "./reddit"

const postResource = {
  id: "reddit-post-resource",
  type: "reddit" as const,
  title: "Reddit post",
  description: "",
  url: "https://www.reddit.com/r/CollegeFuckDoll/comments/1w71tb5/can_i_crash_on_your_couch/",
}

const subredditResource = {
  id: "reddit-subreddit-resource",
  type: "reddit" as const,
  title: "Reddit post",
  description: "",
  url: "https://www.reddit.com/r/pics/",
}

test("Reddit link parsers keep post and subreddit routes distinct", () => {
  assert.deepEqual(
    parseRedditPostLink("https://www.reddit.com/r/pics/comments/1abcde/some_slug/?share=1"),
    {
      postId: "1abcde",
      subreddit: "pics",
      url: "https://www.reddit.com/r/pics/comments/1abcde",
    },
  )
  assert.deepEqual(parseRedditPostLink("https://old.reddit.com/comments/1abcde/"), {
    postId: "1abcde",
    url: "https://www.reddit.com/comments/1abcde",
  })
  assert.deepEqual(parseRedditPostLink("https://redd.it/1abcde"), {
    postId: "1abcde",
    url: "https://www.reddit.com/comments/1abcde",
  })
  assert.deepEqual(parseRedditSubredditLink("https://www.reddit.com/r/pics/?utm_source=x"), {
    name: "pics",
    url: "https://www.reddit.com/r/pics",
  })
  assert.equal(parseRedditSubredditLink("https://www.reddit.com/r/pics/comments/1abcde/"), null)
  assert.equal(parseRedditSubredditLink("https://www.reddit.com/r/pics/about"), null)
  assert.equal(parseRedditPostLink("https://www.reddit.com/r/pics/"), null)
  assert.equal(parseRedditPostLink("https://x.com/pics/status/1abcde"), null)
})

test("Reddit provider maps post details into media and card preview data", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(getRequestUrl(input))
    assert.equal(url.origin + url.pathname, "https://api.tikhub.io/api/v1/reddit/app/fetch_post_details")
    assert.equal(url.searchParams.get("post_id"), "t3_1w71tb5")
    assert.equal(url.searchParams.get("need_format"), "true")
    assert.equal(url.searchParams.get("include_comment_id"), "false")
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-tikhub-token")
    return jsonResponse({
      code: 200,
      data: {
        postsInfoByIds: [
          {
            id: "t3_1w71tb5",
            createdAt: "2026-09-04T11:33:06.198000+0000",
            postTitle: "Can I crash on your couch… promise I won’t be too loud…",
            url: "https://www.redgifs.com/watch/darkmagentainnocentafricancivet",
            domain: "redgifs.com",
            isNsfw: true,
            score: 87,
            commentCount: 7,
            postHint: "RICH_VIDEO",
            permalink: "/r/CollegeFuckDoll/comments/1w71tb5/can_i_crash_on_your_couch/",
            subreddit: {
              id: "t5_csvwgq",
              name: "CollegeFuckDoll",
              prefixedName: "r/CollegeFuckDoll",
              title: "CollegeFuckDoll",
              subscribersCount: 603786,
              isNsfw: true,
              styles: {
                icon: "https://styles.redditmedia.com/t5_csvwgq/styles/communityIcon_02jzyau4fbre1.png",
                primaryColor: "#00BFFF",
              },
            },
            authorInfo: {
              name: "nurse_neon",
              newIcon: {
                url: "https://preview.redd.it/snoovatar/avatars/headshot.png",
              },
            },
            thumbnail: {
              url: "https://external-preview.redd.it/thumb.jpeg?width=140&height=140",
            },
            media: {
              still: {
                source: {
                  url: "https://external-preview.redd.it/vaX.jpeg?format=pjpg&auto=webp",
                  dimensions: { width: 480, height: 854 },
                },
              },
              streaming: {
                duration: 31,
                isGif: true,
                dimensions: { width: 1080, height: 1920 },
              },
              video: {
                url: "https://www.redgifs.com/watch/darkmagentainnocentafricancivet",
                dimensions: { width: 1080, height: 1920 },
              },
              packagedMedia: {
                muxedMp4s: {
                  recommended: {
                    url: "https://packaged-media.redd.it/eeuabflxohnh1/muxed-medium.mp4",
                  },
                },
              },
              download: {
                url: "https://packaged-media.redd.it/eeuabflxohnh1/dl/m2-res_1280p.mp4",
              },
            },
            postStats: { shareAllTotal: 19 },
          },
        ],
      },
    })
  })

  const result = await redditMetadataProvider.resolve(postResource, {
    tikhubApiToken: "test-tikhub-token",
  })

  assert.equal(result.provider, "reddit-tikhub")
  assert.equal(result.status, "completed")
  assert.equal(result.data.title, "Can I crash on your couch… promise I won’t be too loud…")
  assert.equal(result.data.identifiers?.postId, "t3_1w71tb5")
  assert.equal(result.data.source?.attribution?.label, "TikHub")
  assert.equal(result.data.media?.length, 1)
  assert.equal(
    result.data.media?.[0]?.url,
    "https://packaged-media.redd.it/eeuabflxohnh1/dl/m2-res_1280p.mp4",
  )
  assert.equal(result.data.media?.[0]?.kind, "video")
  assert.equal(result.data.media?.[0]?.thumbnailUrl, "https://external-preview.redd.it/vaX.jpeg?format=pjpg&auto=webp")
  assert.equal(result.data.media?.[0]?.duration, 31)
  assert.equal(result.data.media?.[0]?.width, 1080)
  assert.deepEqual(result.data.media?.[0]?.metadata, { isGif: true, postHint: "RICH_VIDEO" })

  assert.equal(result.data.preview?.kind, "reddit_post")
  const preview = result.data.preview?.data
  assert.equal(preview?.subredditName, "CollegeFuckDoll")
  assert.equal(preview?.subredditPrefixedName, "r/CollegeFuckDoll")
  assert.equal(
    preview?.subredditIconUrl,
    "https://styles.redditmedia.com/t5_csvwgq/styles/communityIcon_02jzyau4fbre1.png",
  )
  assert.equal(preview?.subredditUrl, "https://www.reddit.com/r/CollegeFuckDoll")
  assert.equal(preview?.authorName, "nurse_neon")
  assert.equal(preview?.authorUrl, "https://www.reddit.com/user/nurse_neon")
  assert.equal(
    preview?.authorAvatarUrl,
    "https://preview.redd.it/snoovatar/avatars/headshot.png",
  )
  assert.equal(preview?.isNsfw, true)
  assert.equal(preview?.domain, "redgifs.com")
  assert.equal(preview?.createdAt, "2026-09-04T11:33:06.198Z")
  assert.deepEqual(preview?.metrics, { comments: 7, score: 87, shares: 19 })
  assert.equal(preview?.url, "https://www.reddit.com/r/CollegeFuckDoll/comments/1w71tb5/can_i_crash_on_your_couch/")
  assert.equal(Array.isArray(preview?.media) ? preview.media.length : 0, 1)
})

test("Reddit provider keeps text-only posts completable without media", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    jsonResponse({
      code: 200,
      data: {
        postsInfoByIds: [
          {
            id: "t3_textonly",
            postTitle: "Text only",
            selftext: "Just asking a question",
            permalink: "/r/AskReddit/comments/textonly/text_only/",
            subreddit: { name: "AskReddit" },
          },
        ],
      },
    }),
  )

  const result = await redditMetadataProvider.resolve({
    ...postResource,
    url: "https://www.reddit.com/r/AskReddit/comments/textonly/text_only/",
  }, {
    tikhubApiToken: "test-tikhub-token",
  })

  assert.equal(result.status, "completed")
  assert.equal(result.data.media, undefined)
  assert.equal(result.data.preview?.kind, "reddit_post")
  assert.equal(result.data.preview?.data.text, "Just asking a question")
})

test("Reddit provider maps subreddit info with icon and banner into card data", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(getRequestUrl(input))
    assert.equal(url.origin + url.pathname, "https://api.tikhub.io/api/v1/reddit/app/fetch_subreddit_info")
    assert.equal(url.searchParams.get("subreddit_name"), "pics")
    assert.equal(url.searchParams.get("need_format"), "true")
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-tikhub-token")
    return jsonResponse({
      code: 200,
      data: {
        subredditInfoByName: {
          id: "t5_2qh0u",
          name: "pics",
          prefixedName: "r/pics",
          styles: {
            primaryColor: "#0dd3bb",
            icon: "https://styles.redditmedia.com/t5_2qh0u/styles/communityIcon.png",
            bannerBackgroundImage: "https://styles.redditmedia.com/t5_2qh0u/styles/banner.png",
          },
          title: "/r/pics",
          description: { markdown: "A place for pictures." },
          publicDescriptionText: "A place for pictures.",
          subscribersCount: 30_000_000,
          activeCount: 12_345,
          communityStats: {
            weeklyActiveUsersCount: 547_376,
            weeklyContributionsCount: 2_013,
          },
          createdAt: "2008-01-25T03:12:37.000000+0000",
          type: "PUBLIC",
          path: "/r/pics/",
          isNsfw: false,
          detectedLanguage: "en",
        },
      },
    })
  })

  const result = await redditMetadataProvider.resolve(subredditResource, {
    tikhubApiToken: "test-tikhub-token",
  })

  assert.equal(result.provider, "reddit-tikhub")
  assert.equal(result.status, "completed")
  assert.equal(result.data.identifiers?.subredditName, "pics")
  assert.equal(result.data.description, "A place for pictures.")
  assert.equal(result.data.media, undefined)
  assert.equal(result.data.preview?.kind, "reddit_subreddit")
  const preview = result.data.preview?.data
  assert.equal(preview?.prefixedName, "r/pics")
  assert.equal(preview?.iconUrl, "https://styles.redditmedia.com/t5_2qh0u/styles/communityIcon.png")
  assert.equal(preview?.bannerUrl, "https://styles.redditmedia.com/t5_2qh0u/styles/banner.png")
  assert.equal(preview?.primaryColor, "#0dd3bb")
  assert.equal(preview?.subscribersCount, 30_000_000)
  assert.equal(preview?.weeklyActiveUsersCount, 547_376)
  assert.equal(preview?.weeklyContributionsCount, 2_013)
  assert.equal(preview?.createdAt, "2008-01-25T03:12:37.000Z")
  assert.equal(preview?.type, "PUBLIC")
  assert.equal(preview?.detectedLanguage, "en")
  assert.equal(preview?.isNsfw, false)
})

test("Reddit provider fails for non-Reddit URLs", async () => {
  const result = await redditMetadataProvider.resolve({
    ...postResource,
    url: "https://example.com/watch?v=1",
  }, {
    tikhubApiToken: "test-tikhub-token",
  })

  assert.equal(result.status, "failed")
  assert.match(result.errorMessage ?? "", /Invalid Reddit/)
})

test("Reddit provider fails when the TikHub token is missing", async () => {
  const result = await redditMetadataProvider.resolve(postResource)

  assert.equal(result.status, "failed")
  assert.equal(result.errorMessage, "TIKHUB_API_TOKEN is not configured.")
})

test("Reddit provider exposes transient upstream failures to the queue", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    jsonResponse({ message: "rate limited" }, 429),
  )

  await assert.rejects(
    redditMetadataProvider.resolve(postResource, {
      retryTransient: true,
      tikhubApiToken: "test-tikhub-token",
    }),
    RetryableMetadataError,
  )
})

test("Reddit provider surfaces TikHub error messages", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    jsonResponse({ code: 404, message: "Post not found" }),
  )

  const result = await redditMetadataProvider.resolve(postResource, {
    tikhubApiToken: "test-tikhub-token",
  })

  assert.equal(result.status, "failed")
  assert.equal(result.errorMessage, "Post not found")
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

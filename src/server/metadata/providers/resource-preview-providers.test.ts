import assert from "node:assert/strict"
import test from "node:test"

import {
  parseGitHubLink,
  parseResourceInput,
  parseTwitterLink,
  parseTwitterProfileLink,
  parseWechatMpArticleLink,
} from "@/domain/resources/input"

import { getMetadataProvider, RetryableMetadataError } from "../metadata-provider"
import { douyinTiktokDownloadApiMetadataProvider } from "./douyin-tiktok-download-api"
import { githubMetadataProvider } from "./github"
import { twitterMetadataProvider } from "./twitter"
import { wechatMpMetadataProvider } from "./wechat-mp"

const twitterResource = {
  id: "twitter-resource",
  type: "twitter" as const,
  title: "Untitled tweet",
  description: "",
  url: "https://x.com/example/status/2085673727166165147",
}

const githubResource = {
  id: "github-resource",
  type: "http" as const,
  title: "Untitled link",
  description: "",
  url: "https://github.com/deploy-check",
}

test("resource preview URL parsers keep supported X and GitHub routes distinct", () => {
  assert.deepEqual(parseTwitterProfileLink("https://twitter.com/xue55888/?ref=profile"), {
    username: "xue55888",
    url: "https://x.com/xue55888",
  })
  assert.deepEqual(
    parseTwitterLink("https://mobile.x.com/example/status/2085673727166165147?ref=share"),
    {
      tweetId: "2085673727166165147",
      username: "example",
      url: "https://x.com/example/status/2085673727166165147",
    },
  )
  assert.equal(parseTwitterProfileLink("https://x.com/settings"), null)
  assert.deepEqual(parseWechatMpArticleLink("https://mp.weixin.qq.com/s/b2jhSldjmuR3yfNgV2ZUrA?scene=1"), {
    articleToken: "b2jhSldjmuR3yfNgV2ZUrA",
    url: "https://mp.weixin.qq.com/s/b2jhSldjmuR3yfNgV2ZUrA",
  })
  assert.deepEqual(parseGitHubLink("https://github.com/openai/codex/"), {
    kind: "repository",
    owner: "openai",
    repository: "codex",
    url: "https://github.com/openai/codex",
  })
  assert.deepEqual(
    parseGitHubLink("https://github.com/openai/codex/releases/tag/v1.2.3?source=card"),
    {
      kind: "release",
      owner: "openai",
      repository: "codex",
      tag: "v1.2.3",
      url: "https://github.com/openai/codex/releases/tag/v1.2.3",
    },
  )
  assert.equal(parseGitHubLink("https://github.com/openai/codex/issues/1"), null)
})

test("Douyin share text extracts the embedded URL and selects the primary provider", () => {
  const parsed = parseResourceInput({
    url: "9.79 02/11 :2pm 吉他弹唱教学 https://v.douyin.com/Ydz2TWfVSIE/ 复制此链接，打开抖音搜索",
  })

  assert.equal(parsed.type, "douyin")
  assert.equal(parsed.url, "https://v.douyin.com/Ydz2TWfVSIE/")
  assert.equal(getMetadataProvider(parsed).name, "douyin-tiktok-download-api")
  assert.equal(
    getMetadataProvider({ type: "http", url: "https://www.tiktok.com/@creator/video/123" }).name,
    "douyin-tiktok-download-api",
  )
  assert.equal(
    getMetadataProvider({ type: "wechat_mp", url: "https://mp.weixin.qq.com/s/b2jhSldjmuR3yfNgV2ZUrA" }).name,
    "wechat-mp-tikhub",
  )
})

test("TikHub provider persists original media URLs and social video card data", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(getRequestUrl(input))
    assert.equal(url.origin + url.pathname, "https://api.tikhub.io/api/v1/hybrid/video_data")
    assert.equal(url.searchParams.get("url"), "https://v.douyin.com/Ydz2TWfVSIE/")
    assert.equal(url.searchParams.get("minimal"), "false")
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-tikhub-token")
    return jsonResponse({
      code: 200,
      data: {
        author: {
          avatar_thumb: { url_list: ["https://cdn.example/avatar.jpeg"] },
          nickname: "糖木吉他庞老师",
          sec_uid: "douyin-sec-uid",
          unique_id: "tangmujita",
        },
        aweme_id: "7366233989855677750",
        aweme_type: 0,
        create_time: 1715085012,
        desc: "视频描述",
        duration: 268700,
        item_title: "曾经的你吉他弹唱教学",
        music: {
          play_url: { url_list: ["https://cdn.example/music.mp3"] },
          title: "视频原声",
        },
        statistics: {
          collect_count: 10,
          comment_count: 20,
          digg_count: 30,
          play_count: 40,
          share_count: 50,
        },
        video: {
          cover: { url_list: ["https://cdn.example/cover.jpeg"] },
          dynamic_cover: { url_list: ["https://cdn.example/dynamic.webp"] },
          play_addr_h264: {
            data_size: 1024,
            height: 1920,
            url_list: [
              "https://cdn.example/video.mp4",
              "https://www.douyin.com/aweme/v1/play/?video_id=video-source-id",
            ],
            width: 1080,
          },
        },
        video_tag: [
          { tag_name: "音乐" },
          { tag_name: "吉他" },
        ],
      },
    })
  })

  const result = await douyinTiktokDownloadApiMetadataProvider.resolve({
    id: "douyin-resource",
    type: "douyin",
    title: "抖音视频",
    description: "",
    url: "https://v.douyin.com/Ydz2TWfVSIE/",
  }, {
    tikhubApiToken: "test-tikhub-token",
  })

  assert.equal(result.provider, "douyin-tiktok-download-api")
  assert.equal(result.status, "completed")
  assert.equal(result.data.title, "曾经的你吉他弹唱教学")
  assert.equal(result.data.preview?.kind, "social_video")
  assert.equal(result.data.preview?.data.authorName, "糖木吉他庞老师")
  assert.equal(
    result.data.preview?.data.authorUrl,
    "https://www.douyin.com/user/douyin-sec-uid",
  )
  assert.deepEqual(result.data.preview?.data.videoTags, ["音乐", "吉他"])
  const previewMedia = result.data.preview?.data.media
  assert.equal(
    Array.isArray(previewMedia) ? previewMedia.length : 0,
    1,
  )
  assert.equal(result.data.media?.length, 1)
  assert.equal(
    result.data.media?.[0]?.url,
    "https://www.douyin.com/aweme/v1/play/?video_id=video-source-id",
  )
  assert.equal(result.data.media?.[0]?.provider, "douyin-tiktok-download-api")
  assert.equal(result.data.media?.[0]?.thumbnailUrl, "https://cdn.example/cover.jpeg")
})

test("TikHub provider treats aweme image posts as images even when video data exists", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    jsonResponse({
      code: 200,
      data: {
        aweme_id: "image-post-id",
        aweme_type: 68,
        desc: "图文作品",
        images: [
          {
            download_url_list: ["https://cdn.example/image-1-download.webp"],
            height: 1603,
            live_photo_type: 1,
            url_list: [
              "https://cdn.example/image-1.webp",
              "https://cdn.example/image-1.jpeg",
            ],
            video: {
              duration: 2267,
              play_addr: {
                height: 1076,
                url_list: [
                  "https://cdn.example/live-photo-1.mp4",
                  "https://www.douyin.com/aweme/v1/play/?video_id=live-photo-1",
                ],
                width: 720,
              },
            },
            width: 1080,
          },
          {
            download_url_list: ["https://cdn.example/image-2-download.webp"],
            height: 1570,
            url_list: [
              "https://cdn.example/image-2.webp",
              "https://cdn.example/image-2.jpeg",
            ],
            width: 1080,
          },
        ],
        video: {
          cover: { url_list: ["https://cdn.example/image-post-cover.jpeg"] },
          play_addr: {
            height: 1920,
            url_list: ["https://cdn.example/image-post-placeholder.mp4"],
            width: 1080,
          },
        },
      },
    }),
  )

  const result = await douyinTiktokDownloadApiMetadataProvider.resolve({
    id: "douyin-image-resource",
    type: "douyin",
    title: "抖音图文",
    description: "",
    url: "https://v.douyin.com/image-post/",
  }, {
    tikhubApiToken: "test-tikhub-token",
  })

  assert.equal(result.status, "completed")
  assert.equal(result.data.media?.length, 2)
  assert.deepEqual(
    result.data.media?.map(({ height, kind, url, width }) => ({ height, kind, url, width })),
    [
      {
        height: 1603,
        kind: "image",
        url: "https://cdn.example/image-1.webp",
        width: 1080,
      },
      {
        height: 1570,
        kind: "image",
        url: "https://cdn.example/image-2.webp",
        width: 1080,
      },
    ],
  )
  assert.equal(result.data.preview?.kind, "social_video")
  assert.equal(result.data.preview?.data.media.length, 2)
  assert.ok(result.data.preview?.data.media.every((item) => item.kind === "image"))
  assert.deepEqual(result.data.media?.[0]?.metadata, {
    mediaType: "live_photo",
    livePhoto: {
      duration: 2.267,
      height: 1076,
      url: "https://www.douyin.com/aweme/v1/play/?video_id=live-photo-1",
      width: 720,
    },
  })
  assert.deepEqual(result.data.preview?.data.media[0].livePhoto, {
    duration: 2.267,
    height: 1076,
    videoUrl: "https://www.douyin.com/aweme/v1/play/?video_id=live-photo-1",
    width: 720,
  })
  assert.equal(result.data.media?.[1]?.metadata, undefined)
  assert.equal(result.data.preview?.data.media[1].livePhoto, undefined)
  assert.equal(result.data.preview?.data.duration, undefined)
  assert.equal(result.data.preview?.data.height, undefined)
  assert.equal(result.data.preview?.data.width, undefined)
})

test("TikHub provider uses image arrays as a fallback when aweme_type is inaccurate", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    jsonResponse({
      code: 200,
      data: {
        aweme_type: 0,
        image_list: [
          {
            height: 1440,
            url_list: ["https://cdn.example/fallback-image.webp"],
            width: 1080,
          },
        ],
        video: {
          play_addr: { url_list: ["https://cdn.example/ignored-video.mp4"] },
        },
      },
    }),
  )

  const result = await douyinTiktokDownloadApiMetadataProvider.resolve({
    id: "douyin-fallback-image-resource",
    type: "douyin",
    title: "抖音图文",
    description: "",
    url: "https://v.douyin.com/fallback-image-post/",
  }, {
    tikhubApiToken: "test-tikhub-token",
  })

  assert.deepEqual(
    result.data.media?.map(({ kind, url }) => ({ kind, url })),
    [{ kind: "image", url: "https://cdn.example/fallback-image.webp" }],
  )
  assert.deepEqual(
    result.data.preview?.data.media.map(({ kind, url }) => ({ kind, url })),
    [{ kind: "image", url: "https://cdn.example/fallback-image.webp" }],
  )
})

test("TikHub provider prefers browser-friendly image URLs over HEIC", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    jsonResponse({
      code: 200,
      data: {
        aweme_type: 68,
        images: [
          {
            height: 2038,
            url_list: [
              "https://cdn.example/photo.heic",
              "https://cdn.example/photo.jpeg",
            ],
            width: 1440,
          },
        ],
      },
    }),
  )

  const result = await douyinTiktokDownloadApiMetadataProvider.resolve({
    id: "douyin-heic-resource",
    type: "douyin",
    title: "抖音图文",
    description: "",
    url: "https://v.douyin.com/heic-post/",
  }, {
    tikhubApiToken: "test-tikhub-token",
  })

  assert.equal(result.status, "completed")
  assert.equal(result.data.media?.[0]?.url, "https://cdn.example/photo.jpeg")
  assert.equal(result.data.preview?.data.media?.[0]?.url, "https://cdn.example/photo.jpeg")
})

test("TikHub provider prefers standard image URLs over origin image URLs", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    jsonResponse({
      code: 200,
      data: {
        aweme_type: 68,
        images: [
          {
            height: 1440,
            url_list: [
              "https://p3-sign.douyinpic.com/photo-origin.image",
              "https://p11-sign.douyinpic.com/photo-origin.image",
              "https://p3-sign.douyinpic.com/photo.jpeg",
            ],
            width: 1080,
            video: {
              duration: 2967,
              play_addr: {
                height: 960,
                url_list: ["https://v5-dy-ov-experiment.zjcdn.com/live-photo.mp4"],
                width: 720,
              },
            },
          },
        ],
      },
    }),
  )

  const result = await douyinTiktokDownloadApiMetadataProvider.resolve({
    id: "douyin-origin-image-resource",
    type: "douyin",
    title: "抖音实况图",
    description: "",
    url: "https://v.douyin.com/origin-image-post/",
  }, {
    tikhubApiToken: "test-tikhub-token",
  })

  assert.equal(result.status, "completed")
  assert.equal(result.data.media?.[0]?.url, "https://p3-sign.douyinpic.com/photo.jpeg")
  assert.equal(result.data.media?.[0]?.thumbnailUrl, "https://p3-sign.douyinpic.com/photo.jpeg")
  assert.equal(result.data.preview?.data.media?.[0]?.url, "https://p3-sign.douyinpic.com/photo.jpeg")
  assert.deepEqual(result.data.media?.[0]?.metadata, {
    mediaType: "live_photo",
    livePhoto: {
      duration: 2.967,
      height: 960,
      url: "https://v5-dy-ov-experiment.zjcdn.com/live-photo.mp4",
      width: 720,
    },
  })
})

test("Twitter provider marks an empty syndication result as failed", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = getRequestUrl(input)
    if (url.includes("cdn.syndication.twimg.com")) {
      return jsonResponse({})
    }
    if (url.includes("publish.twitter.com/oembed")) {
      return new Response(null, { status: 404 })
    }
    throw new Error(`Unexpected request: ${url}`)
  })

  const result = await twitterMetadataProvider.resolve(twitterResource)

  assert.equal(result.status, "failed")
  assert.equal(result.data.preview?.kind, "x_post")
  assert.equal(result.data.preview?.data.tweetId, "2085673727166165147")
})

test("Twitter provider exposes transient upstream failures to the queue", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = getRequestUrl(input)
    if (url.includes("cdn.syndication.twimg.com")) {
      return jsonResponse({ error: "temporarily unavailable" }, 503)
    }
    if (url.includes("publish.twitter.com/oembed")) {
      return new Response(null, { status: 503 })
    }
    throw new Error(`Unexpected request: ${url}`)
  })

  await assert.rejects(
    twitterMetadataProvider.resolve(twitterResource, { retryTransient: true }),
    RetryableMetadataError,
  )
})

test("WeChat MP provider sends the raw article url to TikHub and normalizes article metadata", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(getRequestUrl(input))
    assert.equal(url.origin + url.pathname, "https://api.tikhub.io/api/v1/wechat_mp/v2/fetch_article_detail")
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-tikhub-token")
    assert.equal(new Headers(init?.headers).get("content-type"), "application/json")
    assert.deepEqual(JSON.parse(String(init?.body)), {
      raw: true,
      url: "https://mp.weixin.qq.com/s/b2jhSldjmuR3yfNgV2ZUrA",
    })
    return jsonResponse({
      code: 200,
      data: {
        bizUin: 3957893683,
        content: {
          bizuin: "Mzk1Nzg5MzY4Mw==",
          content_noencode: "<section><p>公众号原文</p><p><img src=\"https://cdn.example/article.jpeg\" /></p></section>",
          create_time: "2026-08-09 06:03",
          desc: "一、传统无头 Chrome，规模化自动化的痛点",
          hd_head_img: "https://cdn.example/avatar.png",
          idx: 1,
          mid: 2247486200,
          nick_name: "飞翔的SA",
          ori_head_img_url: "https://cdn.example/avatar.png",
          public_tag_info: {
            tags: [{ tag_name: "优质工具" }],
          },
          round_head_img: "https://cdn.example/avatar.png",
          signature: "爱折腾的技术控",
          sn: "882cac716e69d68890e761b0e42d7b76",
          title: "开源轻量无头浏览器 Obscura，AI 爬虫直接平替 Chrome",
          user_name: "gh_9793d9f5e687",
        },
        itemIdx: 1,
        msgId: 2247486200,
        url: "https://mp.weixin.qq.com/s/b2jhSldjmuR3yfNgV2ZUrA",
      },
    })
  })

  const result = await wechatMpMetadataProvider.resolve({
    id: "wechat-resource",
    type: "wechat_mp",
    title: "微信公众号文章",
    description: "",
    url: "https://mp.weixin.qq.com/s/b2jhSldjmuR3yfNgV2ZUrA",
  }, {
    tikhubApiToken: "test-tikhub-token",
  })

  assert.equal(result.provider, "wechat-mp-tikhub")
  assert.equal(result.status, "completed")
  assert.equal(result.data.type, "wechat_mp")
  assert.equal(result.data.title, "开源轻量无头浏览器 Obscura，AI 爬虫直接平替 Chrome")
  assert.equal(result.data.description?.includes("公众号原文"), true)
  assert.equal(result.data.preview?.kind, "wechat_mp_article")
  assert.equal(result.data.preview?.data.accountName, "飞翔的SA")
  assert.equal(result.data.source?.attribution?.url, "https://api.tikhub.io/")
  assert.equal(result.data.identifiers?.articleToken, "b2jhSldjmuR3yfNgV2ZUrA")
  assert.equal(result.data.identifiers?.messageId, "2247486200")
  assert.equal(result.data.media?.[0]?.url, "https://cdn.example/article.jpeg")
})

test("GitHub provider calculates user totals only from a complete repository set", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    const url = new URL(getRequestUrl(input))
    if (url.pathname === "/users/deploy-check" && !url.search) {
      return jsonResponse({
        avatar_url: "https://avatars.githubusercontent.com/u/1",
        login: "deploy-check",
        public_repos: 101,
        type: "User",
      })
    }
    if (url.pathname === "/users/deploy-check/repos") {
      const page = Number(url.searchParams.get("page"))
      const count = page === 1 ? 100 : 1
      return jsonResponse(
        Array.from({ length: count }, (_, index) => ({
          forks_count: 2,
          language: "TypeScript",
          name: `repository-${page}-${index}`,
          stargazers_count: 1,
        })),
      )
    }
    throw new Error(`Unexpected request: ${url}`)
  })

  const result = await githubMetadataProvider.resolve(githubResource)

  assert.equal(result.status, "completed")
  assert.equal(result.data.preview?.kind, "github_user")
  assert.equal(result.data.preview?.data.totalStars, 101)
  assert.equal(result.data.preview?.data.totalForks, 202)
})

test("GitHub provider exposes rate limits to the queue", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    jsonResponse(
      { message: "API rate limit exceeded" },
      429,
      { "x-ratelimit-remaining": "0" },
    ),
  )

  await assert.rejects(
    githubMetadataProvider.resolve(githubResource, { retryTransient: true }),
    RetryableMetadataError,
  )
})

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

function jsonResponse(
  data: unknown,
  status = 200,
  headers?: Record<string, string>,
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  })
}

import type { Tweet } from "react-tweet/api"

import type { ResourceCardPreview } from "./types"

const sampleTweetText =
  "上海滩藤校顶美\n张口找我要理查德米勒\n\n最终还是聊崩了\n事实证明\n没有女人是真心爱你的\n最后总有一天会开口要\n\n男人离开校园\n再也碰不到真爱了\n所有的爱情都是交易\n\n哎\n失恋了\n处成朋友了\n让她介绍几个姐妹给我陪陪罪\n\n不说了\n美团单车骑完还没付款\n切出去付一下款 https://t.co/oggIWlH6kF"

const sampleTweet: Tweet = {
  __typename: "Tweet",
  conversation_count: 190,
  created_at: "2026-08-07T10:25:41.000Z",
  display_text_range: [0, sampleTweetText.length],
  edit_control: {
    edit_tweet_ids: ["2085673727166165147"],
    editable_until_msecs: "1786101941000",
    edits_remaining: "5",
    is_edit_eligible: false,
  },
  entities: {
    hashtags: [],
    symbols: [],
    urls: [
      {
        display_url: "pic.x.com/oggIWlH6kF",
        expanded_url:
          "https://x.com/lilk1kopops/status/2085673727166165147/video/1",
        indices: [133, 156],
        url: "https://t.co/oggIWlH6kF",
      },
    ],
    user_mentions: [],
    media: [
      {
        display_url: "pic.x.com/oggIWlH6kF",
        expanded_url:
          "https://x.com/lilk1kopops/status/2085673727166165147/video/1",
        indices: [133, 156],
        url: "https://t.co/oggIWlH6kF",
      },
    ],
  },
  favorite_count: 121,
  id_str: "2085673727166165147",
  isEdited: false,
  isStaleEdit: false,
  lang: "zh",
  news_action_type: "conversation",
  photos: [
    {
      backgroundColor: { blue: 221, green: 214, red: 204 },
      cropCandidates: [],
      expandedUrl:
        "https://x.com/lilk1kopops/status/2085673727166165147/video/1",
      height: 4096,
      url: "https://pbs.twimg.com/media/HPHNL1maYAAwCLL.jpg",
      width: 1026,
    },
    {
      backgroundColor: { blue: 221, green: 214, red: 204 },
      cropCandidates: [],
      expandedUrl:
        "https://x.com/lilk1kopops/status/2085673727166165147/video/1",
      height: 1555,
      url: "https://pbs.twimg.com/media/HPHNL1maYAEcc-i.jpg",
      width: 991,
    },
    {
      backgroundColor: { blue: 221, green: 214, red: 204 },
      cropCandidates: [],
      expandedUrl:
        "https://x.com/lilk1kopops/status/2085673727166165147/video/1",
      height: 2026,
      url: "https://pbs.twimg.com/media/HPHNL1nbcAA88Bq.jpg",
      width: 1206,
    },
  ],
  text: sampleTweetText,
  user: {
    id_str: "1693881438268256256",
    is_blue_verified: true,
    name: "K1ko妹妹的爸比",
    profile_image_shape: "Circle",
    profile_image_url_https:
      "https://pbs.twimg.com/profile_images/1875211415285612545/biwCTFto_normal.jpg",
    screen_name: "lilk1kopops",
    verified: false,
  },
  video: {
    aspectRatio: [9, 16],
    contentType: "media_entity",
    durationMs: 4268,
    mediaAvailability: { status: "available" },
    poster:
      "https://pbs.twimg.com/amplify_video_thumb/2085673705930391552/img/njdd6ZazUlR4WhuB.jpg",
    variants: [
      {
        type: "application/x-mpegURL",
        src: "https://video.twimg.com/amplify_video/2085673705930391552/pl/5VPQDv24fqBpre5e.m3u8",
      },
      {
        type: "video/mp4",
        src: "https://video.twimg.com/amplify_video/2085673705930391552/vid/avc1/320x568/e1m1RQtkHC31YIM_.mp4",
      },
      {
        type: "video/mp4",
        src: "https://video.twimg.com/amplify_video/2085673705930391552/vid/avc1/480x852/ovDtzUWRe9pnLmuW.mp4",
      },
      {
        type: "video/mp4",
        src: "https://video.twimg.com/amplify_video/2085673705930391552/vid/avc1/720x1280/VRMC84egz3L550jR.mp4",
      },
    ],
    videoId: { type: "tweet", id: "2085673727166165147" },
    viewCount: 0,
  },
}

export type ResourceCardShowcaseFixture = {
  failed: ResourceCardPreview
  label: string
  ready: ResourceCardPreview
}

export const resourceCardShowcaseFixtures: ResourceCardShowcaseFixture[] = [
  {
    label: "X Profile",
    ready: {
      kind: "x_profile",
      data: {
        avatarUrl:
          "https://pbs.twimg.com/profile_images/1987376660623269888/ATgUu75m_400x400.jpg",
        bio: "定投大饼主流币 | 不追短期暴富，专注长期成长 | AI 实习生\n内容不构成投资建议。",
        followersCount: 27_459,
        followingCount: 3_783,
        handle: "@xue55888",
        location: "Shanghai",
        name: "董小姐 | Gate 美股 0 费率",
        url: "https://x.com/xue55888",
        website: undefined,
      },
    },
    failed: {
      kind: "x_profile",
      data: {
        handle: "@xue55888",
        url: "https://x.com/xue55888",
      },
    },
  },
  {
    label: "Tweet",
    ready: {
      kind: "x_post",
      data: {
        metrics: {
          likes: 121,
          replies: 190,
          views: 0,
        },
        tweet: sampleTweet,
        tweetId: sampleTweet.id_str,
        url: "https://x.com/lilk1kopops/status/2085673727166165147",
      },
    },
    failed: {
      kind: "x_post",
      data: {
        handle: "@lilk1kopops",
        tweetId: "2085673727166165147",
        url: "https://x.com/lilk1kopops/status/2085673727166165147",
      },
    },
  },
  {
    label: "GitHub User",
    ready: {
      kind: "github_user",
      data: {
        avatarUrl: "https://avatars.githubusercontent.com/u/14985020?v=4",
        bio: "Agentic infrastructure for every app and agent.",
        blog: "vercel.com",
        followers: 30_143,
        following: 0,
        login: "vercel",
        name: "Vercel",
        popularRepositories: [
          { forks: 28_642, name: "next.js", stars: 137_218, url: "https://github.com/vercel/next.js" },
          { forks: 3_012, name: "ai", stars: 21_864, url: "https://github.com/vercel/ai" },
          { forks: 3_174, name: "turborepo", stars: 29_741, url: "https://github.com/vercel/turborepo" },
        ],
        publicRepos: 239,
        topLanguages: ["TypeScript", "JavaScript", "Rust", "Go"],
        totalForks: 38_906,
        totalStars: 214_763,
        type: "Organization",
        url: "https://github.com/vercel",
      },
    },
    failed: {
      kind: "github_user",
      data: {
        login: "vercel",
        url: "https://github.com/vercel",
      },
    },
  },
  {
    label: "GitHub Repository",
    ready: {
      kind: "github_repository",
      data: {
        avatarUrl: "https://avatars.githubusercontent.com/u/14985020?v=4",
        contributors: [
          { avatarUrl: "https://github.com/lfades.png", login: "lfades" },
          { avatarUrl: "https://github.com/rauchg.png", login: "rauchg" },
          { avatarUrl: "https://github.com/shuding.png", login: "shuding" },
          { avatarUrl: "https://github.com/vercel.png", login: "vercel" },
        ],
        defaultBranch: "main",
        description: "Embed tweets in your React application.",
        forks: 117,
        language: "TypeScript",
        languages: ["TypeScript", "JavaScript", "CSS"],
        license: "MIT",
        name: "react-tweet",
        openIssues: 46,
        owner: "vercel",
        stars: 1_881,
        topics: ["react", "tweet", "embed", "typescript"],
        url: "https://github.com/vercel/react-tweet",
        watchers: 19,
      },
    },
    failed: {
      kind: "github_repository",
      data: {
        name: "react-tweet",
        owner: "vercel",
        url: "https://github.com/vercel/react-tweet",
      },
    },
  },
  {
    label: "GitHub Release",
    ready: {
      kind: "github_release",
      data: {
        assetsCount: 0,
        authorAvatarUrl: "https://avatars.githubusercontent.com/u/4278345?v=4",
        authorLogin: "lfades",
        body: "Fixed rendering when Tweet entity data is missing or incomplete. Empty and partial entity payloads no longer break the renderer.",
        name: "react-tweet@3.3.1",
        owner: "vercel",
        publishedAt: "2026-06-03T18:02:00.000Z",
        repository: "react-tweet",
        tag: "react-tweet@3.3.1",
        url: "https://github.com/vercel/react-tweet/releases/tag/react-tweet%403.3.1",
      },
    },
    failed: {
      kind: "github_release",
      data: {
        owner: "vercel",
        repository: "react-tweet",
        tag: "react-tweet@3.3.1",
        url: "https://github.com/vercel/react-tweet/releases/tag/react-tweet%403.3.1",
      },
    },
  },
  {
    label: "Douyin Video",
    ready: {
      kind: "social_video",
      data: {
        authorName: "糖木吉他庞老师",
        authorUrl: "https://www.douyin.com/user/MS4wLjABAAAAP4y6D_zjihiqovLvRmnvd4EtAaWTphag7Dhsl9-Liowchvk0JyxkUJBLnhMEioll",
        avatarUrl: "https://picsum.photos/seed/nexus-douyin-avatar/160/160",
        createdAt: "2024-05-07T12:30:12.000Z",
        description: "吉他弹唱曾经的你，许巍《曾经的你》吉他弹唱教学，曾经的你吉他谱。",
        duration: "4:29",
        height: 1920,
        media: [
          {
            alt: "曾经的你吉他弹唱教学",
            duration: "4:29",
            height: 1920,
            kind: "video",
            previewUrl: "https://picsum.photos/seed/nexus-douyin-cover/1080/1920",
            url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
            width: 1080,
          },
        ],
        metrics: {
          collections: 8_624,
          comments: 1_932,
          likes: 61_807,
          plays: 1_284_000,
          shares: 4_126,
        },
        platform: "douyin",
        title: "曾经的你吉他弹唱教学",
        url: "https://v.douyin.com/Ydz2TWfVSIE/",
        username: "tangmujita",
        videoId: "7366233989855677750",
        videoTags: ["音乐", "西洋乐器", "吉他"],
        width: 1080,
      },
    },
    failed: {
      kind: "social_video",
      data: {
        platform: "douyin",
        url: "https://v.douyin.com/Ydz2TWfVSIE/",
      },
    },
  },
  {
    label: "Telegram Message",
    ready: {
      kind: "telegram_message",
      data: {
        authorAvatarUrl: "https://picsum.photos/seed/nexus-telegram-author/96/96",
        authorId: "764223901",
        authorName: "Lin Chen",
        authorUsername: "lin_builds",
        avatarUrl: "https://picsum.photos/seed/nexus-telegram-chat/160/160",
        chatTitle: "Product Engineering Notes",
        chatType: "channel",
        chatUsername: "nexus_vault_updates",
        date: "2026-08-06T13:42:00.000Z",
        editedAt: "2026-08-06T14:05:00.000Z",
        forwards: 86,
        media: [
          {
            alt: "Resource card layout preview",
            height: 780,
            kind: "image",
            url: "https://picsum.photos/seed/nexus-telegram-message/1200/780",
            width: 1200,
          },
        ],
        messageId: "1842",
        reactions: [
          { emoji: "👍", count: 218 },
          { emoji: "🔥", count: 47 },
        ],
        replies: 34,
        text: "资源卡片审查版本已经整理完成。列表视图强调阅读效率，瀑布流保留更紧凑的摘要和媒体预览。",
        url: "https://t.me/nexus_vault_updates/1842",
        views: 12_840,
      },
    },
    failed: {
      kind: "telegram_message",
      data: {
        chatUsername: "nexus_vault_updates",
        messageId: "1842",
        url: "https://t.me/nexus_vault_updates/1842",
      },
    },
  },
  {
    label: "WeChat MP",
    ready: {
      kind: "wechat_mp_article",
      data: {
        accountAvatarUrl: "https://picsum.photos/seed/nv-wechat-avatar/160/160",
        accountName: "飞翔的SA",
        accountUsername: "gh_9793d9f5e687",
        albumTitle: "优质工具",
        authorName: "飞翔的SA",
        contentHtml: `
          <section>
            <h2>开源轻量无头浏览器 Obscura</h2>
            <p>文章正文通过微信 HTML 原样渲染，但会被卡片层统一收口。</p>
            <p><img src="https://picsum.photos/seed/nv-wechat-content/1200/700" alt="正文插图" /></p>
            <blockquote>适合做 AI 爬虫与自动化浏览器替代方案。</blockquote>
          </section>
        `,
        coverUrl: "https://picsum.photos/seed/nv-wechat-cover/1280/720",
        createdAt: "2026-08-09T06:03:00.000+08:00",
        excerpt: "一、传统无头 Chrome，规模化自动化的痛点",
        ipLocation: "中国 · 北京",
        messageId: "2247486200",
        signature: "爱折腾的技术控",
        tags: ["优质工具"],
        title: "开源轻量无头浏览器 Obscura，AI 爬虫直接平替 Chrome",
        url: "https://mp.weixin.qq.com/s/b2jhSldjmuR3yfNgV2ZUrA",
      },
    },
    failed: {
      kind: "wechat_mp_article",
      data: {
        title: "微信公众号文章",
        url: "https://mp.weixin.qq.com/s/b2jhSldjmuR3yfNgV2ZUrA",
      },
    },
  },
]

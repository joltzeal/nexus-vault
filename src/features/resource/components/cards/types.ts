import type { Tweet } from "react-tweet/api"
import type { MouseEventHandler, ReactNode, Ref } from "react"

export type ResourceCardViewMode = "list" | "masonry"
export type ResourcePreviewRenderState = "ready" | "loading" | "failed"

export type ResourceCardChromeProps = {
  actions?: ReactNode
  annotation?: ReactNode
  articleId?: string
  articleRef?: Ref<HTMLElement>
  className?: string
  commentAction?: ReactNode
  commentEditor?: ReactNode
  descriptionContent?: ReactNode
  footerActions?: ReactNode
  resourceCreatedAt?: string
  leadingControl?: ReactNode
  onActivate?: MouseEventHandler<HTMLElement>
}

export type ResourcePreviewMetric = {
  label: string
  value?: number
}

export type ResourcePreviewMedia = {
  alt: string
  duration?: string
  height?: number
  kind: "image" | "video"
  livePhoto?: {
    duration?: string
    height?: number
    videoUrl: string
    width?: number
  }
  previewUrl?: string
  url: string
  width?: number
}

export type XProfileCardData = {
  avatarUrl?: string
  bio?: string
  followersCount?: number
  followingCount?: number
  handle: string
  location?: string
  name?: string
  url: string
  website?: string
}

export type XPostCardData = {
  authorName?: string
  avatarUrl?: string
  createdAt?: string
  handle?: string
  media?: ResourcePreviewMedia[]
  metrics?: {
    likes?: number
    replies?: number
    reposts?: number
    views?: number
  }
  text?: string
  tweet?: Tweet
  tweetId: string
  url: string
}

export type GitHubUserCardData = {
  avatarUrl?: string
  bio?: string
  blog?: string
  company?: string
  followers?: number
  following?: number
  location?: string
  login: string
  name?: string
  publicRepos?: number
  totalForks?: number
  totalStars?: number
  topLanguages?: string[]
  popularRepositories?: Array<{
    forks?: number
    name: string
    stars?: number
    url?: string
  }>
  type?: "Organization" | "User"
  url: string
}

export type GitHubRepositoryCardData = {
  archived?: boolean
  avatarUrl?: string
  defaultBranch?: string
  description?: string
  contributors?: Array<{
    avatarUrl?: string
    login: string
  }>
  forks?: number
  language?: string
  languages?: string[]
  license?: string
  name: string
  openIssues?: number
  owner: string
  stars?: number
  topics?: string[]
  watchers?: number
  url: string
}

export type GitHubReleaseCardData = {
  assetsCount?: number
  authorAvatarUrl?: string
  authorLogin?: string
  body?: string
  draft?: boolean
  name?: string
  owner: string
  prerelease?: boolean
  publishedAt?: string
  repository: string
  tag: string
  url: string
}

export type TelegramMessageCardData = {
  authorAvatarUrl?: string
  authorId?: string
  authorName?: string
  authorUsername?: string
  avatarUrl?: string
  chatTitle?: string
  chatType?: "channel" | "group" | "private"
  chatUsername?: string
  date?: string
  editedAt?: string
  forwards?: number
  media?: ResourcePreviewMedia[]
  messageId: string
  reactions?: Array<{
    emoji: string
    count: number
  }>
  replies?: number
  text?: string
  url: string
  views?: number
}

export type WechatMpArticleCardData = {
  accountAvatarUrl?: string
  accountName?: string
  accountUsername?: string
  albumTitle?: string
  authorName?: string
  contentHtml?: string
  coverUrl?: string
  createdAt?: string
  excerpt?: string
  ipLocation?: string
  messageId?: string
  signature?: string
  tags?: string[]
  title: string
  url: string
}

export type SocialVideoPlatform = "douyin" | "tiktok" | "bilibili" | "unknown"

export type SocialVideoCardData = {
  authorName?: string
  authorUrl?: string
  avatarUrl?: string
  createdAt?: string
  description?: string
  duration?: string
  height?: number
  media?: ResourcePreviewMedia[]
  metrics?: {
    collections?: number
    comments?: number
    likes?: number
    plays?: number
    shares?: number
  }
  platform: SocialVideoPlatform
  title?: string
  url: string
  username?: string
  videoId?: string
  videoTags?: string[]
  width?: number
}

export type RedditPostCardData = {
  authorAvatarUrl?: string
  authorName?: string
  authorUrl?: string
  createdAt?: string
  domain?: string
  flairText?: string
  isNsfw?: boolean
  media?: ResourcePreviewMedia[]
  metrics?: {
    comments?: number
    score?: number
    shares?: number
  }
  postHint?: string
  postId: string
  subredditIconUrl?: string
  subredditIsNsfw?: boolean
  subredditName?: string
  subredditPrefixedName?: string
  subredditSubscribersCount?: number
  subredditTitle?: string
  subredditUrl?: string
  text?: string
  title?: string
  url: string
}

export type RedditSubredditCardData = {
  activeCount?: number
  bannerUrl?: string
  createdAt?: string
  description?: string
  detectedLanguage?: string
  iconUrl?: string
  isNsfw?: boolean
  name: string
  prefixedName: string
  primaryColor?: string
  subscribersCount?: number
  title?: string
  type?: string
  url: string
  weeklyActiveUsersCount?: number
  weeklyContributionsCount?: number
}

export type YoutubeVideoCardData = {
  category?: string
  channelAvatarUrl?: string
  channelId?: string
  channelName?: string
  channelUrl?: string
  description?: string
  duration?: number
  isLive?: boolean
  publishedAt?: string
  subscribersText?: string
  thumbnailUrl?: string
  title?: string
  url: string
  videoId: string
  views?: number
}

export type ResourceCardPreview =
  | { kind: "x_profile"; data: XProfileCardData }
  | { kind: "x_post"; data: XPostCardData }
  | { kind: "github_user"; data: GitHubUserCardData }
  | { kind: "github_repository"; data: GitHubRepositoryCardData }
  | { kind: "github_release"; data: GitHubReleaseCardData }
  | { kind: "telegram_message"; data: TelegramMessageCardData }
  | { kind: "wechat_mp_article"; data: WechatMpArticleCardData }
  | { kind: "social_video"; data: SocialVideoCardData }
  | { kind: "reddit_subreddit"; data: RedditSubredditCardData }
  | { kind: "reddit_post"; data: RedditPostCardData }
  | { kind: "youtube_video"; data: YoutubeVideoCardData }

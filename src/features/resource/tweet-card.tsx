import { Eye, Heart, MessageCircle, Repeat2 } from "lucide-react"
import { enrichTweet, type EnrichedTweet } from "react-tweet"
import type { Tweet } from "react-tweet/api"

import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import type {
  ResourceCardViewMode,
  ResourcePreviewMedia,
  XPostCardData,
} from "@/features/resource/components/cards/types"
import { PreviewMedia } from "@/features/resource/components/cards/preview-media"
import { formatCompactNumber } from "@/features/resource/components/cards/resource-card-frame"
import { XUserHeader } from "@/features/resource/components/cards/x-user-header"
import { cn } from "@/lib/utils"

export function TweetCardContent({
  data,
  mediaVisible = true,
  viewMode,
}: {
  data: XPostCardData
  mediaVisible?: boolean
  viewMode: ResourceCardViewMode
}) {
  const tweet = data.tweet ? enrichTweet(withSafeTweetEntities(data.tweet)) : null
  const authorName = tweet?.user.name || data.authorName || data.handle || "X user"
  const handle = tweet?.user.screen_name || data.handle?.replace(/^@/, "")
  const avatarUrl = tweet?.user.profile_image_url_https || data.avatarUrl
  const text = tweet?.text || data.text
  const media = data.media?.length ? data.media : tweet ? getTweetMedia(tweet) : undefined
  const metrics = {
    replies: data.metrics?.replies ?? tweet?.conversation_count,
    reposts: data.metrics?.reposts,
    likes: data.metrics?.likes ?? tweet?.favorite_count,
    views: data.metrics?.views ?? tweet?.video?.viewCount,
  }
  const profileUrl = tweet?.user.url || (handle ? `https://x.com/${handle}` : data.url)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <XUserHeader
        avatarUrl={avatarUrl}
        href={profileUrl}
        name={authorName}
        screenName={handle || `tweet-${data.tweetId}`}
        verified={Boolean(tweet?.user.verified || tweet?.user.is_blue_verified)}
      />

      {tweet ? (
        <TweetBody tweet={tweet} />
      ) : text ? (
        <p className="mono whitespace-pre-line break-words text-[13px] leading-6 text-muted-foreground">
          {text}
        </p>
      ) : (
        <p className="mono text-xs text-muted-foreground">Tweet ID: {data.tweetId}</p>
      )}

      {mediaVisible && (
        <PreviewMedia
          items={media}
          title={`${authorName}${handle ? ` @${handle}` : ""}`}
          videoPlayback="external"
          viewMode={viewMode}
        />
      )}
      <div className="flex flex-col gap-2">
        <Separator className="h-px w-full shrink-0 bg-border" />
        <TweetMetrics metrics={metrics} />
      </div>
    </div>
  )
}

export function TweetSkeleton({
  className,
  media = true,
}: {
  className?: string
  media?: boolean
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full bg-muted" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-2/5 bg-muted" />
          <Skeleton className="h-3 w-1/4 bg-muted" />
        </div>
      </div>
      <Skeleton className="h-3 w-full bg-muted" />
      <Skeleton className="h-3 w-5/6 bg-muted" />
      {media && <Skeleton className="aspect-video w-full bg-muted" />}
    </div>
  )
}

export function TweetNotFound({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-28 items-center justify-center text-sm text-muted-foreground", className)}>
      无法读取这条 Tweet
    </div>
  )
}

export function MagicTweet({
  className,
  tweet,
  viewMode = "list",
}: {
  className?: string
  tweet: Tweet
  viewMode?: ResourceCardViewMode
}) {
  return (
    <div className={className}>
      <TweetCardContent
        data={{ tweet, tweetId: tweet.id_str, url: `https://x.com/i/status/${tweet.id_str}` }}
        viewMode={viewMode}
      />
    </div>
  )
}

function TweetBody({ tweet }: { tweet: EnrichedTweet }) {
  return (
    <p className="mono whitespace-pre-wrap break-words text-[13px] leading-6 text-muted-foreground">
      {tweet.entities.map((entity, index) => {
        if (entity.type === "text") return <span key={`${entity.type}:${index}`}>{entity.text}</span>
        if (entity.type === "media") return null

        return (
          <a
            className="text-primary transition-colors hover:text-primary"
            href={entity.href}
            key={`${entity.type}:${index}`}
            onClick={(event) => event.stopPropagation()}
            rel="noreferrer"
            target="_blank"
          >
            {entity.text}
          </a>
        )
      })}
    </p>
  )
}

function TweetMetrics({
  metrics,
}: {
  metrics: {
    likes?: number
    replies?: number
    reposts?: number
    views?: number
  }
}) {
  const items = [
    { icon: MessageCircle, label: "回复", value: metrics.replies },
    { icon: Repeat2, label: "转发", value: metrics.reposts },
    { icon: Heart, label: "喜欢", value: metrics.likes },
    { icon: Eye, label: "浏览", value: metrics.views },
  ].filter((item) => typeof item.value === "number")

  if (items.length === 0) return null

  return (
    <dl className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-muted-foreground">
      {items.map(({ icon: Icon, label, value }) => (
        <div className="inline-flex items-center gap-1.5" key={label} title={label}>
          <Icon aria-hidden="true" className="size-3.5" />
          <dd className="mono text-[10.5px]">{formatCompactNumber(value ?? 0)}</dd>
          <dt className="sr-only">{label}</dt>
        </div>
      ))}
    </dl>
  )
}

function getTweetMedia(tweet: EnrichedTweet): ResourcePreviewMedia[] {
  const media: ResourcePreviewMedia[] = []

  if (tweet.video) {
    const mp4Sources = tweet.video.variants.filter((variant) => variant.type === "video/mp4")
    const source = mp4Sources[mp4Sources.length - 1] ?? tweet.video.variants[0]
    if (source) {
      media.push({
        alt: tweet.text,
        duration: formatDuration(tweet.video.durationMs),
        height: tweet.video.aspectRatio?.[1],
        kind: "video",
        previewUrl: tweet.video.poster,
        url: source.src,
        width: tweet.video.aspectRatio?.[0],
      })
    }
  }

  media.push(
    ...(tweet.photos ?? []).map((photo) => ({
      alt: tweet.text,
      height: photo.height,
      kind: "image" as const,
      url: photo.url,
      width: photo.width,
    }))
  )

  return media
}

function formatDuration(durationMs?: number) {
  if (!durationMs || durationMs <= 0) return undefined
  return `${Math.max(1, Math.round(durationMs / 1000))}s`
}

function withSafeTweetEntities(tweet: Tweet): Tweet {
  return {
    ...tweet,
    entities: {
      hashtags: tweet.entities?.hashtags ?? [],
      urls: tweet.entities?.urls ?? [],
      symbols: tweet.entities?.symbols ?? [],
      user_mentions: tweet.entities?.user_mentions ?? [],
      ...(tweet.entities?.media ? { media: tweet.entities.media } : {}),
    },
    quoted_tweet: tweet.quoted_tweet
      ? {
          ...tweet.quoted_tweet,
          entities: {
            hashtags: tweet.quoted_tweet.entities?.hashtags ?? [],
            urls: tweet.quoted_tweet.entities?.urls ?? [],
            symbols: tweet.quoted_tweet.entities?.symbols ?? [],
            user_mentions: tweet.quoted_tweet.entities?.user_mentions ?? [],
            ...(tweet.quoted_tweet.entities?.media
              ? { media: tweet.quoted_tweet.entities.media }
              : {}),
          },
        }
      : undefined,
  }
}

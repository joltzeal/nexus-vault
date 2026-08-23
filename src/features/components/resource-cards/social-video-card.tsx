import { Clapperboard } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

import { PreviewMedia } from "./preview-media"
import { TikTokSourceIcon } from "./platform-icons"
import {
  formatPreviewDate,
  PreviewMetrics,
  ResourceCardFrame,
  ResourceCardSkeleton,
} from "./resource-card-frame"
import { XUserHeader } from "./x-user-header"
import type {
  ResourceCardChromeProps,
  ResourceCardViewMode,
  ResourcePreviewRenderState,
  SocialVideoCardData,
} from "./types"

export function SocialVideoCard({
  actions,
  annotation,
  articleId,
  articleRef,
  className,
  commentAction,
  commentEditor,
  data,
  footerActions,
  leadingControl,
  mediaVisible = true,
  onActivate,
  state,
  viewMode,
}: ResourceCardChromeProps & {
  data: SocialVideoCardData
  mediaVisible?: boolean
  state: ResourcePreviewRenderState
  viewMode: ResourceCardViewMode
}) {
  const platformName = getPlatformName(data.platform)
  const authorName = data.authorName || data.username || platformName
  const descriptionDiffersFromTitle = Boolean(
    data.description && data.description !== data.title,
  )
  const screenName = data.username || (data.videoId ? `video-${data.videoId}` : platformName)

  return (
    <ResourceCardFrame
      actions={actions}
      annotation={annotation}
      articleId={articleId}
      articleRef={articleRef}
      className={className}
      commentAction={commentAction}
      commentEditor={commentEditor}
      footerActions={footerActions}
      footerMeta={data.createdAt ? (
        <time className="mono" dateTime={data.createdAt}>
          {formatPreviewDate(data.createdAt)}
        </time>
      ) : undefined}
      leadingControl={leadingControl}
      onActivate={onActivate}
      sourceIcon={data.platform === "douyin" || data.platform === "tiktok"
        ? <TikTokSourceIcon />
        : <Clapperboard />}
      sourceName={platformName}
      state={state}
      url={data.url}
      viewMode={viewMode}
    >
      {state === "loading" ? (
        <ResourceCardSkeleton media={mediaVisible} viewMode={viewMode} />
      ) : (
        <div className="flex min-w-0 flex-col gap-2.5">
          <XUserHeader
            avatarUrl={data.avatarUrl}
            href={data.authorUrl || data.url}
            name={authorName}
            screenName={screenName}
          />

          {data.title && (
            <h3 className="break-words text-sm font-semibold leading-5 text-fg">
              {data.title}
            </h3>
          )}
          {descriptionDiffersFromTitle && (
            <p className="mono whitespace-pre-line break-words text-xs leading-5 text-fg-muted">
              {data.description}
            </p>
          )}
          {data.videoTags && data.videoTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="视频标签">
              {data.videoTags.map((tag) => (
                <Badge key={tag} variant="secondary">#{tag}</Badge>
              ))}
            </div>
          )}

          {mediaVisible && (
            <PreviewMedia
              items={data.media}
              proxyVideoPlayback
              title={data.title || authorName}
              videoPlayback="inline"
              viewMode={viewMode}
            />
          )}

          {data.metrics && (
            <>
              <Separator className="h-px w-full shrink-0 bg-line-soft" />
              <PreviewMetrics
                items={[
                  { label: "播放", value: data.metrics.plays },
                  { label: "喜欢", value: data.metrics.likes },
                  { label: "评论", value: data.metrics.comments },
                  { label: "收藏", value: data.metrics.collections },
                  { label: "分享", value: data.metrics.shares },
                ]}
              />
            </>
          )}
        </div>
      )}
    </ResourceCardFrame>
  )
}

function getPlatformName(platform: SocialVideoCardData["platform"]) {
  if (platform === "douyin") return "抖音视频"
  if (platform === "tiktok") return "TikTok Video"
  if (platform === "bilibili") return "Bilibili Video"
  return "Social Video"
}

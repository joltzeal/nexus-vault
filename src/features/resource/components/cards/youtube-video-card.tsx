import type { ComponentType } from "react"

import { Tag } from "@/components/aicanvas/andromeda/components/Tag"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

import { YoutubeSourceIcon } from "./platform-icons"
import {
  formatCompactNumber,
  formatPreviewDate,
  ResourceCardFrame,
  ResourceCardSkeleton,
} from "./resource-card-frame"
import { XUserHeader } from "./x-user-header"
import type {
  ResourceCardChromeProps,
  ResourceCardViewMode,
  ResourcePreviewRenderState,
  YoutubeVideoCardData,
} from "./types"

const BaseTag = Tag as unknown as ComponentType<Record<string, unknown>>

export function YoutubeVideoCard({
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
  resourceCreatedAt,
  state,
  viewMode,
}: ResourceCardChromeProps & {
  data: YoutubeVideoCardData
  mediaVisible?: boolean
  state: ResourcePreviewRenderState
  viewMode: ResourceCardViewMode
}) {
  const description = normalizeOptionalText(data.description)
  const channelName = data.channelName || "YouTube"

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
      footerMeta={data.publishedAt ? (
        <time className="mono" dateTime={data.publishedAt}>
          {formatPreviewDate(data.publishedAt)}
        </time>
      ) : undefined}
      leadingControl={leadingControl}
      onActivate={onActivate}
      resourceCreatedAt={resourceCreatedAt}
      sourceIcon={<YoutubeSourceIcon />}
      sourceName={data.isLive ? "YouTube Live" : "YouTube"}
      state={state}
      url={data.url}
      viewMode={viewMode}
    >
      {state === "loading" ? (
        <ResourceCardSkeleton media={mediaVisible} viewMode={viewMode} />
      ) : (
        <div className="flex min-w-0 flex-col gap-2.5">
          {mediaVisible && data.thumbnailUrl && (
            <a
              aria-label={data.title || channelName}
              className={cn(
                "relative block overflow-hidden rounded-input border border-border/50 bg-black/35",
                viewMode === "list" ? "h-[var(--media-h)] w-fit max-w-full" : "w-full",
              )}
              href={data.url}
              onClick={(event) => event.stopPropagation()}
              rel="noreferrer"
              target="_blank"
            >
              <img
                alt={data.title || channelName}
                className={
                  viewMode === "list"
                    ? "block h-full w-auto object-contain"
                    : "aspect-video w-full object-cover"
                }
                loading="lazy"
                src={data.thumbnailUrl}
              />
              {(data.isLive || typeof data.duration === "number") && (
                <span
                  className={cn(
                    "mono absolute bottom-1.5 right-1.5 rounded-sm px-1.5 py-0.5 text-[10px] font-medium text-white",
                    data.isLive ? "bg-destructive" : "bg-black/80",
                  )}
                >
                  {data.isLive ? "LIVE" : formatDuration(data.duration)}
                </span>
              )}
            </a>
          )}

          <XUserHeader
            avatarUrl={data.channelAvatarUrl}
            href={data.channelUrl || data.url}
            name={channelName}
            screenName={channelName}
            wrapName={viewMode === "masonry"}
          />

          {data.title && (
            <h3 className="break-words text-sm font-semibold leading-5 text-foreground">
              {data.title}
            </h3>
          )}

          {description && (
            <p className="whitespace-pre-line break-words text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          )}

          {(data.category || data.subscribersText || typeof data.views === "number") && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {data.category && (
                <BaseTag className="max-w-full" variant="default">
                  <span className="truncate">{data.category}</span>
                </BaseTag>
              )}
              {data.subscribersText && (
                <BaseTag className="max-w-full" variant="default">
                  <span className="truncate">{data.subscribersText}</span>
                </BaseTag>
              )}
              {typeof data.views === "number" && (
                <BaseTag className="max-w-full" variant="accent">
                  <span className="truncate">
                    {formatCompactNumber(data.views)} 次观看
                  </span>
                </BaseTag>
              )}
            </div>
          )}

          {(typeof data.views === "number" || typeof data.duration === "number") && (
            <>
              <Separator className="h-px w-full shrink-0 bg-border" />
              <dl className="mono flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {typeof data.duration === "number" && (
                  <div className="flex items-baseline gap-1.5">
                    <dt>时长</dt>
                    <dd className="font-semibold text-foreground">{formatDuration(data.duration)}</dd>
                  </div>
                )}
                {typeof data.views === "number" && (
                  <div className="flex items-baseline gap-1.5">
                    <dt>播放</dt>
                    <dd className="font-semibold text-foreground">{formatCompactNumber(data.views)}</dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </div>
      )}
    </ResourceCardFrame>
  )
}

function formatDuration(seconds?: number) {
  if (typeof seconds !== "number" || seconds < 0) return undefined
  const totalSeconds = Math.round(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized || undefined
}

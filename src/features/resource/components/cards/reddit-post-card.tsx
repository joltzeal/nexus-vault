import type { ComponentType } from "react"

import { Tag } from "@/components/aicanvas/andromeda/components/Tag"
import { Separator } from "@/components/ui/separator"

import { PreviewMedia } from "./preview-media"
import { RedditSourceIcon } from "./platform-icons"
import {
  formatCompactNumber,
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
  RedditPostCardData,
} from "./types"

const BaseTag = Tag as unknown as ComponentType<Record<string, unknown>>

export function RedditPostCard({
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
  data: RedditPostCardData
  mediaVisible?: boolean
  state: ResourcePreviewRenderState
  viewMode: ResourceCardViewMode
}) {
  const authorName = data.authorName || data.subredditPrefixedName || "Reddit"
  const text = normalizeOptionalText(data.text)

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
      resourceCreatedAt={resourceCreatedAt}
      sourceIcon={<RedditSourceIcon />}
      sourceName="Reddit Post"
      state={state}
      url={data.url}
      viewMode={viewMode}
    >
      {state === "loading" ? (
        <ResourceCardSkeleton media={mediaVisible} viewMode={viewMode} />
      ) : (
        <div className="flex min-w-0 flex-col gap-2.5">
          <XUserHeader
            avatarUrl={data.authorAvatarUrl}
            href={data.authorUrl || data.url}
            name={authorName}
            screenName={data.authorName || "reddit"}
            wrapName={viewMode === "masonry"}
          />

          {data.title && (
            <h3 className="break-words text-sm font-semibold leading-5 text-foreground">
              {data.title}
            </h3>
          )}

          {(data.isNsfw || data.flairText || data.domain) && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {data.isNsfw && (
                <BaseTag className="max-w-full" variant="fault">
                  <span className="truncate">18+</span>
                </BaseTag>
              )}
              {data.flairText && (
                <BaseTag className="max-w-full" variant="accent">
                  <span className="truncate">{data.flairText}</span>
                </BaseTag>
              )}
              {data.domain && (
                <BaseTag className="max-w-full" variant="default">
                  <span className="truncate">{data.domain}</span>
                </BaseTag>
              )}
            </div>
          )}

          {text && (
            <p className="whitespace-pre-line break-words text-xs leading-5 text-muted-foreground">
              {text}
            </p>
          )}

          {mediaVisible && (
            <PreviewMedia
              items={data.media}
              title={data.title || authorName}
              videoPlayback="inline"
              viewMode={viewMode}
            />
          )}

          {data.subredditUrl && (
            <a
              className="flex min-w-0 items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
              href={data.subredditUrl}
              onClick={(event) => event.stopPropagation()}
              rel="noreferrer"
              target="_blank"
            >
              {data.subredditIconUrl ? (
                <img
                  alt=""
                  aria-hidden="true"
                  className="size-5 shrink-0 overflow-hidden rounded-full border border-border/50 object-cover"
                  loading="lazy"
                  src={data.subredditIconUrl}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid size-5 shrink-0 place-items-center rounded-full border border-border/50 bg-muted text-[8px]"
                >
                  r/
                </span>
              )}
              <span className="truncate text-xs font-medium">
                {data.subredditPrefixedName ?? `r/${data.subredditName ?? ""}`}
              </span>
              {typeof data.subredditSubscribersCount === "number" && (
                <span className="mono shrink-0 text-[10px]">
                  {formatCompactNumber(data.subredditSubscribersCount)} 位成员
                </span>
              )}
            </a>
          )}

          {data.metrics && (
            <>
              <Separator className="h-px w-full shrink-0 bg-border" />
              <PreviewMetrics
                items={[
                  { label: "点赞", value: data.metrics.score },
                  { label: "评论", value: data.metrics.comments },
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

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized || undefined
}

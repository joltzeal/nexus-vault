import type { ComponentType } from "react"

import { Tag } from "@/components/aicanvas/andromeda/components/Tag"
import { Separator } from "@/components/ui/separator"

import { RedditSourceIcon } from "./platform-icons"
import {
  formatPreviewDate,
  PreviewMetrics,
  ResourceCardFrame,
  ResourceCardSkeleton,
} from "./resource-card-frame"
import type {
  ResourceCardChromeProps,
  ResourceCardViewMode,
  ResourcePreviewRenderState,
  RedditSubredditCardData,
} from "./types"

const BaseTag = Tag as unknown as ComponentType<Record<string, unknown>>

export function RedditSubredditCard({
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
  data: RedditSubredditCardData
  mediaVisible?: boolean
  state: ResourcePreviewRenderState
  viewMode: ResourceCardViewMode
}) {
  const description = normalizeOptionalText(data.description)
  const members = typeof data.subscribersCount === "number"
    ? data.subscribersCount
    : undefined

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
      sourceName="Subreddit"
      state={state}
      url={data.url}
      viewMode={viewMode}
    >
      {state === "loading" ? (
        <ResourceCardSkeleton viewMode={viewMode} />
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          {mediaVisible && data.bannerUrl && (
            <a
              aria-label={data.prefixedName}
              className="block overflow-hidden rounded-input border border-border/50"
              href={data.url}
              onClick={(event) => event.stopPropagation()}
              rel="noreferrer"
              target="_blank"
            >
              <img
                alt={`${data.prefixedName} banner`}
                className="block h-auto w-full"
                loading="lazy"
                src={data.bannerUrl}
              />
            </a>
          )}

          <div className="flex min-w-0 items-center gap-3">
            <a
              className="shrink-0"
              href={data.url}
              onClick={(event) => event.stopPropagation()}
              rel="noreferrer"
              target="_blank"
            >
              {data.iconUrl ? (
                <img
                  alt={data.prefixedName}
                  className="size-12 overflow-hidden rounded-full border border-border/50 object-cover"
                  height={48}
                  loading="lazy"
                  src={data.iconUrl}
                  width={48}
                />
              ) : (
                <span className="grid size-12 place-items-center rounded-full border border-border/50 bg-muted text-[10px] text-muted-foreground">
                  r/
                </span>
              )}
            </a>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <a
                className="truncate font-medium text-foreground transition-opacity hover:opacity-80"
                href={data.url}
                onClick={(event) => event.stopPropagation()}
                rel="noreferrer"
                target="_blank"
              >
                {data.title || data.prefixedName}
              </a>
              <a
                className="truncate text-sm text-muted-foreground transition-colors hover:text-foreground"
                href={data.url}
                onClick={(event) => event.stopPropagation()}
                rel="noreferrer"
                target="_blank"
              >
                {data.prefixedName}
              </a>
            </div>
          </div>

          {description && (
            <p
              className={
                viewMode === "masonry"
                  ? "whitespace-normal break-words text-[14px] leading-6 text-muted-foreground"
                  : "whitespace-pre-line text-[14px] leading-6 text-muted-foreground"
              }
            >
              {description}
            </p>
          )}

          {(data.type || data.detectedLanguage || data.isNsfw) && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {data.type && (
                <BaseTag className="max-w-full" variant="default">
                  <span className="truncate">{data.type}</span>
                </BaseTag>
              )}
              {data.detectedLanguage && (
                <BaseTag className="max-w-full" variant="default">
                  <span className="truncate uppercase">{data.detectedLanguage}</span>
                </BaseTag>
              )}
              {data.isNsfw && (
                <BaseTag className="max-w-full" variant="fault">
                  <span className="truncate">18+</span>
                </BaseTag>
              )}
            </div>
          )}

          {typeof members === "number" && (
            <div className="flex flex-col gap-2">
              <Separator className="h-px w-full shrink-0 bg-border" />
              <PreviewMetrics
                items={[
                  { label: "成员", value: members },
                  { label: "在线", value: data.activeCount },
                  { label: "周活跃", value: data.weeklyActiveUsersCount },
                  { label: "周发帖", value: data.weeklyContributionsCount },
                ]}
              />
            </div>
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

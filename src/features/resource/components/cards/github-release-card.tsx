import { Tag as TagIcon } from "lucide-react"
import type { ComponentType } from "react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/aicanvas/andromeda/components/Badge"
import { Tag } from "@/components/aicanvas/andromeda/components/Tag"
import { cn } from "@/lib/utils"

import { GitHubSourceIcon } from "./platform-icons"
import {
  formatPreviewDate,
  ResourceCardFrame,
  ResourceCardSkeleton,
} from "./resource-card-frame"
import type {
  GitHubReleaseCardData,
  ResourceCardChromeProps,
  ResourceCardViewMode,
  ResourcePreviewRenderState,
} from "./types"

const BaseBadge = Badge as unknown as ComponentType<Record<string, unknown>>
const BaseTag = Tag as unknown as ComponentType<Record<string, unknown>>

export function GitHubReleaseCard({
  actions,
  annotation,
  articleId,
  articleRef,
  className,
  commentAction,
  commentEditor,
  data,
  descriptionContent,
  footerActions,
  leadingControl,
  onActivate,
  resourceCreatedAt,
  state,
  viewMode,
}: ResourceCardChromeProps & {
  data: GitHubReleaseCardData
  state: ResourcePreviewRenderState
  viewMode: ResourceCardViewMode
}) {
  const title = data.name || data.tag

  return (
    <ResourceCardFrame
      actions={actions}
      annotation={annotation}
      articleId={articleId}
      articleRef={articleRef}
      className={className}
      commentAction={commentAction}
      commentEditor={commentEditor}
      descriptionContent={descriptionContent}
      footerActions={footerActions}
      footerMeta={data.authorLogin || data.publishedAt ? (
        <div className="flex min-w-0 items-center gap-2">
          {data.authorLogin && (
            <>
              <Avatar size="sm">
                <AvatarImage alt={data.authorLogin} src={data.authorAvatarUrl} />
                <AvatarFallback>{data.authorLogin.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="truncate">{data.authorLogin}</span>
            </>
          )}
          {data.publishedAt && (
            <time className="mono shrink-0" dateTime={data.publishedAt}>
              {formatPreviewDate(data.publishedAt)}
            </time>
          )}
        </div>
      ) : undefined}
      leadingControl={leadingControl}
      onActivate={onActivate}
      resourceCreatedAt={resourceCreatedAt}
      sourceIcon={<GitHubSourceIcon />}
      sourceName="GitHub Release"
      state={state}
      url={data.url}
      viewMode={viewMode}
    >
      {state === "loading" ? (
        <ResourceCardSkeleton viewMode={viewMode} />
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="mono truncate text-[10.5px] text-muted-foreground">
                {data.owner}/{data.repository}
              </p>
              <h2 className={cn("mt-1 min-w-0 text-[17px] font-semibold text-foreground", viewMode === "masonry" ? "whitespace-normal break-words" : "truncate")}>{title}</h2>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <BaseTag variant="accent">
              <TagIcon className="size-[var(--andromeda-icon-xs,12px)]" data-icon="inline-start" />
              {data.tag}
            </BaseTag>
            {data.prerelease && <BaseBadge variant="warning">Pre-release</BaseBadge>}
            {data.draft && <BaseBadge variant="fault">Draft</BaseBadge>}
            {typeof data.assetsCount === "number" && (
              <BaseTag variant="default">{data.assetsCount} assets</BaseTag>
            )}
          </div>

          {data.body && (
            <p
              className={cn(
                "whitespace-pre-line text-[13px] leading-5 text-muted-foreground",
                viewMode === "list" ? "line-clamp-4" : "whitespace-normal break-words"
              )}
            >
              {data.body}
            </p>
          )}
        </div>
      )}
    </ResourceCardFrame>
  )
}

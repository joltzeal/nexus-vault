import { Tag } from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
              <p className="mono truncate text-[10.5px] text-fg-dim">
                {data.owner}/{data.repository}
              </p>
              <h2 className="mt-1 truncate text-[17px] font-semibold text-fg">{title}</h2>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge variant="secondary">
              <Tag data-icon="inline-start" />
              {data.tag}
            </Badge>
            {data.prerelease && <Badge variant="outline">Pre-release</Badge>}
            {data.draft && <Badge variant="outline">Draft</Badge>}
            {typeof data.assetsCount === "number" && (
              <Badge variant="ghost">{data.assetsCount} assets</Badge>
            )}
          </div>

          {data.body && (
            <p
              className={cn(
                "whitespace-pre-line text-[13px] leading-5 text-fg-muted",
                viewMode === "list" ? "line-clamp-4" : "line-clamp-5"
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

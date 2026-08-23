import { Archive, CircleDot, Eye, GitBranch, GitFork, Scale, Star, Users } from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

import { GitHubSourceIcon } from "./platform-icons"
import { ResourceCardFrame, ResourceCardSkeleton } from "./resource-card-frame"
import type {
  GitHubRepositoryCardData,
  ResourceCardChromeProps,
  ResourceCardViewMode,
  ResourcePreviewRenderState,
} from "./types"

export function GitHubRepositoryCard({
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
  data: GitHubRepositoryCardData
  state: ResourcePreviewRenderState
  viewMode: ResourceCardViewMode
}) {
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
      leadingControl={leadingControl}
      onActivate={onActivate}
      sourceIcon={<GitHubSourceIcon />}
      sourceName="GitHub Repo"
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
              <h2 className="truncate text-[19px] font-semibold text-fg">
                <span className="font-normal text-fg-muted">{data.owner}/</span>{data.name}
              </h2>
              {data.defaultBranch && (
                <Badge className="mt-1" variant="ghost">
                  <GitBranch data-icon="inline-start" />
                  {data.defaultBranch}
                </Badge>
              )}
            </div>
            {data.archived && (
              <Badge variant="secondary">
                <Archive data-icon="inline-start" />
                已归档
              </Badge>
            )}
          </div>

          {data.description && (
            <p
              className={cn(
                "text-[14px] leading-6 text-fg-muted",
                viewMode === "masonry" && "line-clamp-3"
              )}
            >
              {data.description}
            </p>
          )}

          {data.contributors && data.contributors.length > 0 && (
            <section className="flex min-w-0 flex-col gap-2">
              <h3 className="flex items-center gap-2 text-[12px] font-semibold text-fg-muted">
                <Users className="size-4 text-jade" />
                Contributors
                <Badge variant="secondary">{data.contributors.length}</Badge>
              </h3>
              <AvatarGroup className="min-w-0">
                {data.contributors.slice(0, viewMode === "list" ? 12 : 8).map((contributor) => (
                  <Avatar className="size-8" key={contributor.login} size="sm">
                    {contributor.avatarUrl && (
                      <AvatarImage alt={contributor.login} src={contributor.avatarUrl} />
                    )}
                    <AvatarFallback>{contributor.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                ))}
              </AvatarGroup>
            </section>
          )}

          {hasRepoStats(data) && (
            <div className="flex flex-col gap-3">
              <Separator className="h-px w-full shrink-0 bg-line-soft" />
              <div
                className={cn(
                  "grid gap-x-5 gap-y-3",
                  viewMode === "list" ? "grid-cols-4" : "grid-cols-2"
                )}
              >
                <RepoStat icon={Star} label="Stars" value={data.stars} />
                <RepoStat icon={GitFork} label="Forks" value={data.forks} />
                <RepoStat icon={Eye} label="Watchers" value={data.watchers} />
                <RepoStat icon={CircleDot} label="Open issues" value={data.openIssues} />
              </div>
              <Separator className="h-px w-full shrink-0 bg-line-soft" />
            </div>
          )}

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {(data.languages?.length ? data.languages : data.language ? [data.language] : [])
              .slice(0, 6)
              .map((language) => (
                <Badge key={language} variant="secondary">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-[2px]"
                    style={{ backgroundColor: getLanguageColor(language) }}
                  />
                  {language}
                </Badge>
              ))}
            {data.license && (
              <Badge className="ml-auto" variant="outline">
                <Scale data-icon="inline-start" />
                {data.license}
              </Badge>
            )}
          </div>

          {data.topics && data.topics.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {data.topics.slice(0, viewMode === "list" ? 5 : 3).map((topic) => (
                <Badge key={topic} variant="ghost">
                  {topic}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </ResourceCardFrame>
  )
}

function RepoStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Star
  label: string
  value?: number
}) {
  if (typeof value !== "number") return null
  return (
    <div className="min-w-0">
      <p className="mono text-[16px] font-semibold leading-none text-fg">
        {value.toLocaleString()}
      </p>
      <p className="mt-1.5 flex items-center gap-1.5 truncate text-[10.5px] text-fg-dim">
        <Icon aria-hidden="true" className="size-3.5 text-jade" />
        {label}
      </p>
    </div>
  )
}

function getLanguageColor(language: string) {
  const colors: Record<string, string> = {
    CSS: "#8b5cf6",
    Dockerfile: "#607d8b",
    HTML: "#e34c26",
    JavaScript: "#e8d44d",
    Shell: "#89e051",
    TypeScript: "#4f8cc9",
  }
  return colors[language] ?? "#5f7585"
}

function hasRepoStats(data: GitHubRepositoryCardData) {
  return [data.stars, data.forks, data.watchers, data.openIssues].some(
    (value) => typeof value === "number"
  )
}

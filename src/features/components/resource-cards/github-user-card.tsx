import {
  BookOpen,
  Building2,
  Code2,
  GitFork,
  Link as LinkIcon,
  MapPin,
  Star,
  Users,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

import { GitHubSourceIcon } from "./platform-icons"
import {
  ResourceCardFrame,
  ResourceCardSkeleton,
} from "./resource-card-frame"
import type {
  GitHubUserCardData,
  ResourceCardChromeProps,
  ResourceCardViewMode,
  ResourcePreviewRenderState,
} from "./types"

export function GitHubUserCard({
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
  data: GitHubUserCardData
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
      sourceName="GitHub User"
      state={state}
      url={data.url}
      viewMode={viewMode}
    >
      {state === "loading" ? (
        <ResourceCardSkeleton viewMode={viewMode} />
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-16 border border-line" size="lg">
              {data.avatarUrl && <AvatarImage alt={data.name || data.login} src={data.avatarUrl} />}
              <AvatarFallback>{data.login.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[18px] font-semibold text-fg">
                {data.name || data.login}
              </h2>
              <p className="mt-0.5 truncate text-[13px] text-fg-dim">@{data.login}</p>
            </div>
          </div>

          {data.bio && (
            <p
              className={cn(
                "text-[14px] leading-6 text-fg-muted",
                viewMode === "masonry" && "line-clamp-3"
              )}
            >
              {data.bio}
            </p>
          )}

          {(data.company || data.location || data.blog) && (
            <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-dim">
              {data.company && <MetaLine icon={Building2} value={data.company} />}
              {data.location && <MetaLine icon={MapPin} value={data.location} />}
              {data.blog && (
                <a
                  className="inline-flex min-w-0 items-center gap-1 text-fg-muted transition-colors hover:text-jade"
                  href={ensureHttpUrl(data.blog)}
                  onClick={(event) => event.stopPropagation()}
                  rel="noreferrer"
                  target="_blank"
                >
                  <LinkIcon aria-hidden="true" className="size-3" />
                  <span className="truncate">{data.blog}</span>
                </a>
              )}
            </div>
          )}

          {hasProfileStats(data) && (
            <div className="flex flex-col gap-3">
              <Separator className="h-px w-full shrink-0 bg-line-soft" />
              <div
                className={cn(
                  "grid gap-2",
                  viewMode === "list" ? "grid-cols-5" : "grid-cols-3"
                )}
              >
                <ProfileStat icon={Star} label="获得 Stars" value={data.totalStars} />
                <ProfileStat icon={GitFork} label="累计 Forks" value={data.totalForks} />
                <ProfileStat icon={Users} label="关注者" value={data.followers} />
                <ProfileStat icon={BookOpen} label="公开仓库" value={data.publicRepos} />
                <ProfileStat icon={Users} label="正在关注" value={data.following} />
              </div>
              <Separator className="h-px w-full shrink-0 bg-line-soft" />
            </div>
          )}

          {data.topLanguages && data.topLanguages.length > 0 && (
            <section className="flex min-w-0 flex-col gap-2">
              <h3 className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                <Code2 className="size-4 text-jade" />
                主要语言
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {data.topLanguages.slice(0, 5).map((language) => (
                  <Badge key={language} variant="secondary">
                    {language}
                  </Badge>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </ResourceCardFrame>
  )
}

function ProfileStat({
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
    <div className="flex min-w-0 flex-col items-start gap-1 text-left">
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon aria-hidden="true" className="size-3.5 shrink-0 text-jade" />
        <p className="mono truncate text-[14px] font-semibold leading-none text-fg">
          {value.toLocaleString()}
        </p>
      </div>
      <p className="truncate text-[10px] text-fg-dim">{label}</p>
    </div>
  )
}

function hasProfileStats(data: GitHubUserCardData) {
  return [data.totalStars, data.totalForks, data.followers, data.publicRepos, data.following].some(
    (value) => typeof value === "number"
  )
}

function MetaLine({
  icon: Icon,
  value,
}: {
  icon: typeof Building2
  value: string
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <Icon aria-hidden="true" className="size-3" />
      <span className="truncate">{value}</span>
    </span>
  )
}

function ensureHttpUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

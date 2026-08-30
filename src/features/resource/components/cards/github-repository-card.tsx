import {
  Archive,
  CircleDot,
  Eye,
  GitBranch,
  GitFork,
  Scale,
  Star,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/aicanvas/andromeda/components/Badge";
import { Tag } from "@/components/aicanvas/andromeda/components/Tag";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { GitHubSourceIcon } from "./platform-icons";
import { ResourceCardFrame, ResourceCardSkeleton } from "./resource-card-frame";
import type {
  GitHubRepositoryCardData,
  ResourceCardChromeProps,
  ResourceCardViewMode,
  ResourcePreviewRenderState,
} from "./types";

const BaseBadge = Badge as unknown as ComponentType<Record<string, unknown>>;
const BaseTag = Tag as unknown as ComponentType<Record<string, unknown>>;

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
  data: GitHubRepositoryCardData;
  state: ResourcePreviewRenderState;
  viewMode: ResourceCardViewMode;
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
          <div className="flex min-w-0 items-start gap-3 rounded-input border border-border bg-ink-850/45 p-2.5">
            <div className="min-w-0 flex-1">
              <h2 className="flex min-w-0 items-baseline gap-0 text-[17px] font-semibold tracking-tight text-foreground">
                <span className="shrink-0 font-normal text-muted-foreground">
                  {data.owner}/
                </span>
                <span className="min-w-0 truncate">{data.name}</span>
              </h2>
              {data.defaultBranch && (
                <BaseTag className="mt-1 inline-flex max-w-full" variant="default">
                  <GitBranch
                    className="size-[var(--andromeda-icon-xs,12px)]"
                    data-icon="inline-start"
                  />
                  {data.defaultBranch}
                </BaseTag>
              )}
            </div>
            {data.archived && (
              <BaseBadge variant="warning">
                <Archive
                  className="size-[var(--andromeda-icon-xs,12px)]"
                  data-icon="inline-start"
                />
                已归档
              </BaseBadge>
            )}
          </div>

          {data.description && (
            <p
              className={cn(
                "text-[14px] leading-6 text-muted-foreground",
                viewMode === "masonry" && "whitespace-normal break-words",
              )}
            >
              {data.description}
            </p>
          )}

          {data.contributors && data.contributors.length > 0 && (
            <section className="flex min-w-0 flex-col gap-2">
              <h3 className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground">
                <Users className="size-4 text-primary" />
                Contributors
                <BaseBadge variant="subtle">
                  {data.contributors.length}
                </BaseBadge>
              </h3>
              <AvatarGroup className="min-w-0">
                {data.contributors
                  .slice(0, viewMode === "list" ? 12 : 8)
                  .map((contributor) => (
                    <Avatar
                      className="size-8"
                      key={contributor.login}
                      size="sm"
                    >
                      {contributor.avatarUrl && (
                        <AvatarImage
                          alt={contributor.login}
                          src={contributor.avatarUrl}
                        />
                      )}
                      <AvatarFallback>
                        {contributor.login.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
              </AvatarGroup>
            </section>
          )}

          {hasRepoStats(data) && (
            <div className="flex flex-col gap-3">
              <Separator className="h-px w-full shrink-0 bg-border" />
              <div
                className={cn(
                  "grid gap-x-5 gap-y-3",
                  viewMode === "list"
                    ? "grid-cols-2 sm:grid-cols-4"
                    : "grid-cols-2",
                )}
              >
                <RepoStat icon={Star} label="Stars" value={data.stars} />
                <RepoStat icon={GitFork} label="Forks" value={data.forks} />
                <RepoStat icon={Eye} label="Watchers" value={data.watchers} />
                <RepoStat
                  icon={CircleDot}
                  label="Open issues"
                  value={data.openIssues}
                />
              </div>
              <Separator className="h-px w-full shrink-0 bg-border" />
            </div>
          )}

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {(data.languages?.length
              ? data.languages
              : data.language
                ? [data.language]
                : []
            )
              .slice(0, 6)
              .map((language) => (
                <BaseTag key={language} variant="default">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-[2px]"
                    style={{ backgroundColor: getLanguageColor(language) }}
                  />
                  {language}
                </BaseTag>
              ))}
            {data.license && (
              <BaseTag className="ml-auto" variant="default">
                <Scale
                  className="size-[var(--andromeda-icon-xs,12px)]"
                  data-icon="inline-start"
                />
                {data.license}
              </BaseTag>
            )}
          </div>

          {data.topics && data.topics.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {data.topics
                .slice(0, viewMode === "list" ? 5 : 3)
                .map((topic) => (
                  <BaseTag key={topic} variant="default">
                    {topic}
                  </BaseTag>
                ))}
            </div>
          )}
        </div>
      )}
    </ResourceCardFrame>
  );
}

function RepoStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Star;
  label: string;
  value?: number;
}) {
  if (typeof value !== "number") return null;
  return (
    <div className="min-w-0">
      <p className="mono text-[16px] font-semibold leading-none text-foreground">
        {value.toLocaleString()}
      </p>
      <p className="mt-1.5 flex items-center gap-1.5 truncate text-[10.5px] text-muted-foreground">
        <Icon aria-hidden="true" className="size-3.5 text-primary" />
        {label}
      </p>
    </div>
  );
}

function getLanguageColor(language: string) {
  const colors: Record<string, string> = {
    CSS: "#8b5cf6",
    Dockerfile: "#607d8b",
    HTML: "#e34c26",
    JavaScript: "#e8d44d",
    Shell: "#89e051",
    TypeScript: "#4f8cc9",
  };
  return colors[language] ?? "#5f7585";
}

function hasRepoStats(data: GitHubRepositoryCardData) {
  return [data.stars, data.forks, data.watchers, data.openIssues].some(
    (value) => typeof value === "number",
  );
}

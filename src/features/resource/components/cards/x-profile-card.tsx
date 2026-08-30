import { Link as LinkIcon, MapPin } from "lucide-react"
import type { ComponentType } from "react"

import { Tag } from "@/components/aicanvas/andromeda/components/Tag"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

import { XSourceIcon } from "./platform-icons"
import { XUserHeader } from "./x-user-header"
import {
  PreviewMetrics,
  ResourceCardFrame,
  ResourceCardSkeleton,
} from "./resource-card-frame"
import type {
  ResourceCardChromeProps,
  ResourceCardViewMode,
  ResourcePreviewRenderState,
  XProfileCardData,
} from "./types"

const BaseTag = Tag as unknown as ComponentType<Record<string, unknown>>

export function XProfileCard({
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
  onActivate,
  state,
  viewMode,
}: ResourceCardChromeProps & {
  data: XProfileCardData
  state: ResourcePreviewRenderState
  viewMode: ResourceCardViewMode
}) {
  const handle = normalizeHandle(data.handle)
  const bio = normalizeOptionalText(data.bio)
  const location = normalizeOptionalText(data.location)
  const website = normalizeOptionalText(data.website)

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
      leadingControl={leadingControl}
      onActivate={onActivate}
      sourceIcon={<XSourceIcon />}
      sourceName="X Profile"
      state={state}
      url={data.url}
      viewMode={viewMode}
    >
      {state === "loading" ? (
        <ResourceCardSkeleton viewMode={viewMode} />
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <XUserHeader
            avatarUrl={data.avatarUrl}
            href={data.url}
            name={data.name || handle}
            screenName={handle}
            wrapName={viewMode === "masonry"}
          />

          {bio && (
            <p
              className={cn(
                "whitespace-pre-line text-[14px] leading-6 text-muted-foreground",
                viewMode === "masonry" && "whitespace-normal break-words"
              )}
            >
              {bio}
            </p>
          )}

          {(location || website) && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {location && (
                <BaseTag className="max-w-full" variant="default">
                  <MapPin className="size-[var(--andromeda-icon-xs,12px)]" data-icon="inline-start" />
                  <span className="truncate">{location}</span>
                </BaseTag>
              )}
              {website && (
                <a
                  className="max-w-full"
                  href={ensureHttpUrl(website)}
                  onClick={(event) => event.stopPropagation()}
                  rel="noreferrer"
                  target="_blank"
                >
                  <BaseTag variant="accent">
                    <LinkIcon className="size-[var(--andromeda-icon-xs,12px)]" data-icon="inline-start" />
                    <span className="truncate">{getDisplayHost(website)}</span>
                  </BaseTag>
                </a>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Separator className="h-px w-full shrink-0 bg-border" />
            <PreviewMetrics
              items={[
                { label: "正在关注", value: data.followingCount },
                { label: "关注者", value: data.followersCount },
              ]}
            />
          </div>
        </div>
      )}
    </ResourceCardFrame>
  )
}

function normalizeHandle(value: string) {
  const handle = value.trim()
  return handle.startsWith("@") ? handle : `@${handle}`
}

function getDisplayHost(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return value
  }
}

function ensureHttpUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized || undefined
}

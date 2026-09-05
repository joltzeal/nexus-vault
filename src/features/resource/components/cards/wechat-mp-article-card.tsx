import { BookOpenText, MapPin } from "lucide-react"
import { useState, type ComponentType } from "react"

import { Badge } from "@/components/aicanvas/andromeda/components/Badge"
import { Tag } from "@/components/aicanvas/andromeda/components/Tag"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

import { WechatSourceIcon } from "./platform-icons"
import {
  formatPreviewDate,
  ResourceCardFrame,
  ResourceCardSkeleton,
} from "./resource-card-frame"
import type {
  ResourceCardChromeProps,
  ResourceCardViewMode,
  ResourcePreviewRenderState,
  WechatMpArticleCardData,
} from "./types"
import {
  WechatMpArticleDialog,
  WechatMpDescription,
} from "./wechat-mp-description"

const BaseBadge = Badge as unknown as ComponentType<Record<string, unknown>>
const BaseTag = Tag as unknown as ComponentType<Record<string, unknown>>

export function WechatMpArticleCard({
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
  data: WechatMpArticleCardData
  mediaVisible?: boolean
  state: ResourcePreviewRenderState
  viewMode: ResourceCardViewMode
}) {
  const accountName = data.accountName || "微信公众号"
  const screenName = getWechatScreenName(data.accountUsername)
  const [articleOpen, setArticleOpen] = useState(false)

  return (
    <>
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
        sourceIcon={<WechatSourceIcon />}
        sourceName="微信公众号"
        state={state}
        url={data.url}
        viewMode={viewMode}
      >
        {state === "loading" ? (
          <ResourceCardSkeleton media={mediaVisible} viewMode={viewMode} />
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <a
              className="shrink-0"
              href={data.url}
              onClick={(event) => event.stopPropagation()}
              rel="noreferrer"
              target="_blank"
            >
              {data.accountAvatarUrl ? (
                <img
                  alt={accountName}
                  className="size-11  border-border  object-cover"
                  height={44}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  src={data.accountAvatarUrl}
                  width={44}
                />
              ) : (
                <span className="grid size-11 place-items-center rounded-input border border-border bg-background text-xs font-semibold text-primary">
                  {getInitials(accountName)}
                </span>
              )}
            </a>
            <div className="min-w-0 flex-1">
              <a
                className={cn(
                  "block min-w-0 text-[13px] font-semibold text-foreground transition-colors hover:text-primary",
                  viewMode === "masonry" ? "whitespace-normal break-words" : "truncate",
                )}
                href={data.url}
                onClick={(event) => event.stopPropagation()}
                rel="noreferrer"
                target="_blank"
              >
                {accountName}
              </a>
              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                {screenName && <span className="mono truncate">{screenName}</span>}
                {data.authorName && <span className="truncate">作者 {data.authorName}</span>}
              </div>
              {data.signature && (
                <p className={cn(
                  "mt-1 text-[11px] leading-4 text-muted-foreground",
                  viewMode === "list" && "line-clamp-2",
                )}>
                  {data.signature}
                </p>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="text-[17px] font-semibold leading-6 text-foreground">
              <span className={viewMode === "masonry" ? "whitespace-normal break-words" : "truncate"}>{data.title}</span>
            </h3>
            {data.excerpt && (
              <p className={cn(
                "mt-1.5 text-sm leading-6 text-muted-foreground",
                viewMode === "list" && "line-clamp-3",
              )}>
                {data.excerpt}
              </p>
            )}
          </div>

          {(data.albumTitle || data.ipLocation || (data.tags && data.tags.length > 0)) && (
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {data.albumTitle && (
                <BaseBadge variant="accent">
                  <BookOpenText className="size-[var(--andromeda-icon-xs,12px)]" data-icon="inline-start" />
                  {data.albumTitle}
                </BaseBadge>
              )}
              {data.ipLocation && (
                <BaseBadge variant="outline">
                  <MapPin className="size-[var(--andromeda-icon-xs,12px)]" data-icon="inline-start" />
                  {data.ipLocation}
                </BaseBadge>
              )}
              {data.tags?.map((tag) => (
                <BaseTag key={tag} variant="default">
                  {tag}
                </BaseTag>
              ))}
            </div>
          )}

          {data.contentHtml && (
            <>
              <Separator className="h-px w-full shrink-0 bg-border" />
              <WechatMpDescription
                hideImages={!mediaVisible}
                html={data.contentHtml}
                onOpenReader={() => setArticleOpen(true)}
                title={data.title}
                viewMode={viewMode}
              />
            </>
          )}
          </div>
        )}
      </ResourceCardFrame>
      <WechatMpArticleDialog
        accountName={accountName}
        hideImages={!mediaVisible}
        html={data.contentHtml}
        onOpenChange={setArticleOpen}
        open={articleOpen}
        title={data.title}
      />
    </>
  )
}

function getInitials(value: string) {
  return Array.from(value.trim()).slice(0, 2).join("") || "微"
}

function getWechatScreenName(value?: string) {
  const screenName = value?.trim()
  if (!screenName) return undefined
  if (/^gh_[a-z0-9]+$/i.test(screenName)) return undefined
  return screenName
}

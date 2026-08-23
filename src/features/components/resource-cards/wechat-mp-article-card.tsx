import { BookOpenText, MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

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
import { WechatMpDescription } from "./wechat-mp-description"

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
                  className="size-11  border-line-soft  object-cover"
                  height={44}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  src={data.accountAvatarUrl}
                  width={44}
                />
              ) : (
                <span className="grid size-11 place-items-center rounded-input border border-line-soft bg-ink-900 text-xs font-semibold text-jade">
                  {getInitials(accountName)}
                </span>
              )}
            </a>
            <div className="min-w-0 flex-1">
              <a
                className="block truncate text-[13px] font-semibold text-fg transition-colors hover:text-jade-bright"
                href={data.url}
                onClick={(event) => event.stopPropagation()}
                rel="noreferrer"
                target="_blank"
              >
                {accountName}
              </a>
              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-fg-dim">
                {screenName && <span className="mono truncate">{screenName}</span>}
                {data.authorName && <span className="truncate">作者 {data.authorName}</span>}
              </div>
              {data.signature && (
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-fg-dim">
                  {data.signature}
                </p>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="text-[17px] font-semibold leading-6 text-fg">
              {data.title}
            </h3>
            {data.excerpt && (
              <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-fg-muted">
                {data.excerpt}
              </p>
            )}
          </div>

          {(data.albumTitle || data.ipLocation || (data.tags && data.tags.length > 0)) && (
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {data.albumTitle && (
                <Badge className="h-5 px-1.5 text-[10px] font-normal" variant="secondary">
                  <BookOpenText data-icon="inline-start" />
                  {data.albumTitle}
                </Badge>
              )}
              {data.ipLocation && (
                <Badge className="h-5 px-1.5 text-[10px] font-normal" variant="outline">
                  <MapPin data-icon="inline-start" />
                  {data.ipLocation}
                </Badge>
              )}
              {data.tags?.map((tag) => (
                <Badge className="h-5 px-1.5 text-[10px] font-normal" key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {data.contentHtml && (
            <>
              <Separator className="h-px w-full shrink-0 bg-line-soft" />
              <WechatMpDescription
                hideImages={!mediaVisible}
                html={data.contentHtml}
                title={data.title}
                viewMode={viewMode}
              />
            </>
          )}
        </div>
      )}
    </ResourceCardFrame>
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

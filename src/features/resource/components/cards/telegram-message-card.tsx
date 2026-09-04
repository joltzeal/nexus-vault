import {
  Eye,
  Forward,
  MessageCircle,
  type LucideIcon,
} from "lucide-react"
import type { ComponentType } from "react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { Badge } from "@/components/aicanvas/andromeda/components/Badge"
import { Tag } from "@/components/aicanvas/andromeda/components/Tag"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

import { TelegramSourceIcon } from "./platform-icons"
import { PreviewMedia } from "./preview-media"
import {
  formatPreviewDate,
  ResourceCardFrame,
  ResourceCardSkeleton,
} from "./resource-card-frame"
import type {
  ResourceCardChromeProps,
  ResourceCardViewMode,
  ResourcePreviewRenderState,
  TelegramMessageCardData,
} from "./types"

const BaseBadge = Badge as unknown as ComponentType<Record<string, unknown>>
const BaseTag = Tag as unknown as ComponentType<Record<string, unknown>>

export function TelegramMessageCard({
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
  data: TelegramMessageCardData
  mediaVisible?: boolean
  state: ResourcePreviewRenderState
  viewMode: ResourceCardViewMode
}) {
  const chatName = data.chatTitle || data.chatUsername || "Telegram"
  const authorName = data.authorName || data.authorUsername
  const authorIsChat = Boolean(
    authorName &&
    authorName === chatName &&
    (!data.authorUsername ||
      data.authorUsername.replace(/^@/, "") === data.chatUsername?.replace(/^@/, ""))
  )
  const hasMetrics = [data.views, data.forwards, data.replies].some(
    (value) => typeof value === "number"
  ) || Boolean(data.reactions?.length)

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
      footerMeta={data.date ? (
        <div className="flex min-w-0 items-center gap-2">
          {data.date && (
            <time className="mono truncate" dateTime={data.date}>
              {formatPreviewDate(data.date)}
            </time>
          )}
        </div>
      ) : undefined}
      leadingControl={leadingControl}
      onActivate={onActivate}
      resourceCreatedAt={resourceCreatedAt}
      sourceIcon={<TelegramSourceIcon />}
      sourceName="Telegram Message"
      state={state}
      url={data.url}
      viewMode={viewMode}
    >
      {state === "loading" ? (
        <ResourceCardSkeleton media={mediaVisible} viewMode={viewMode} />
      ) : (
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <Avatar size="lg">
              {data.avatarUrl && <AvatarImage alt={chatName} src={data.avatarUrl} />}
              <AvatarFallback>{chatName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <h2 className={cn("min-w-0 text-[15px] font-semibold text-foreground", viewMode === "masonry" ? "whitespace-normal break-words" : "truncate")}>{chatName}</h2>
                {data.chatType && (
                  <BaseBadge variant="accent">{getChatTypeLabel(data.chatType)}</BaseBadge>
                )}
              </div>
              <p className="mono truncate text-[11px] text-muted-foreground">
                {data.chatUsername ? `@${data.chatUsername.replace(/^@/, "")}` : `message ${data.messageId}`}
              </p>
            </div>
          </div>

          {authorName && !authorIsChat && (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar size="sm">
                {data.authorAvatarUrl && (
                  <AvatarImage alt={authorName} src={data.authorAvatarUrl} />
                )}
                <AvatarFallback>{authorName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 items-baseline gap-1.5">
                <span className="truncate text-xs font-medium text-muted-foreground">{authorName}</span>
                {data.authorUsername && data.authorName && (
                  <span className="mono truncate text-[10.5px] text-muted-foreground">
                    @{data.authorUsername.replace(/^@/, "")}
                  </span>
                )}
              </div>
            </div>
          )}
          {data.text && (
            <p className="mono whitespace-pre-line break-words text-xs leading-5 text-muted-foreground">
              {data.text}
            </p>
          )}
          {mediaVisible && (
            <PreviewMedia items={data.media} title={chatName} viewMode={viewMode} />
          )}
          {hasMetrics && (
            <>
              <Separator className="h-px w-full shrink-0 bg-border" />
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex min-w-0 flex-wrap items-stretch gap-4">
                  <TelegramMetric icon={Eye} label="浏览" value={data.views} />
                  <TelegramMetric icon={Forward} label="转发" value={data.forwards} />
                  <TelegramMetric icon={MessageCircle} label="回复" value={data.replies} />
                </div>
                {data.reactions && data.reactions.length > 0 && (
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {data.reactions.map((reaction) => (
                      <BaseTag key={reaction.emoji} variant="default">
                        {getReactionLabel(reaction.emoji)} {formatMetric(reaction.count)}
                      </BaseTag>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </ResourceCardFrame>
  )
}

function TelegramMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value?: number
}) {
  if (typeof value !== "number") return null

  return (
    <span className="inline-flex min-w-9 flex-col items-center gap-0.5 text-[11px] text-muted-foreground" title={label}>
      <span className="inline-flex items-center gap-1 text-foreground">
        <Icon aria-hidden="true" className="size-3.5" />
        <span className="mono font-medium">{formatMetric(value)}</span>
      </span>
      <span>{label}</span>
    </span>
  )
}

function getChatTypeLabel(type: NonNullable<TelegramMessageCardData["chatType"]>) {
  if (type === "channel") return "频道"
  if (type === "group") return "群组"
  return "私聊"
}

function getReactionLabel(value: string) {
  if (value === "paid") return "⭐"
  if (value.startsWith("custom:")) return "表情"
  return value
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value)
}

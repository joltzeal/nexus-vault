"use client"

import { ChevronLeft, ChevronRight, ImageOff, Play, Send } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { CommentItem } from "@/features/vault-workspace/types"
import { cn } from "@/lib/utils"
import { getInitials } from "./view-models"

type CommentMediaItem = {
  kind: "image" | "video"
  src: string
  label: string
}

export function ResourceCommentsPreview({
  body,
  comments,
  disabled,
  onBodyChange,
  onSubmit,
  showComposer = true,
}: {
  body: string
  comments: CommentItem[]
  disabled: boolean
  onBodyChange: (value: string) => void
  onSubmit: () => void
  showComposer?: boolean
}) {
  const shown = comments.slice(0, 2)
  const mediaByComment = useMemo(
    () =>
      new Map(
        shown.map((comment) => [
          comment.id,
          comment.deletedAt ? [] : extractCommentMedia(comment.body),
        ])
      ),
    [shown]
  )
  const [preview, setPreview] = useState<{
    items: CommentMediaItem[]
    index: number
  } | null>(null)
  const activeItem = preview?.items[preview.index]

  return (
    <div className="border-t border-line-soft">
      {shown.map((comment, index) => (
        <div className="flex gap-2 pt-2" key={comment.id}>
          <div className={`grid size-6 shrink-0 place-items-center rounded-chip border border-line text-[10px] font-semibold ${avatarClass(index)}`}>
            {getInitials(comment.authorName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <b className="text-xs font-semibold">{comment.authorName}</b>
              <time className="mono text-[10px] text-fg-dim">{formatRelative(comment.createdAt)}</time>
            </div>
            <p className="mt-0.5 text-[12.5px] text-fg-muted">
              {comment.deletedAt ? "这条评论已删除。" : comment.body}
            </p>
            <CommentMediaStrip
              media={mediaByComment.get(comment.id) ?? []}
              onPreview={(items, mediaIndex) => setPreview({ items, index: mediaIndex })}
            />
          </div>
        </div>
      ))}
      {comments.length > shown.length && (
        <button className="mono mt-1.5 text-[11px] text-fg-dim hover:text-jade" type="button">
          查看全部 {comments.length} 条评论 →
        </button>
      )}
      {showComposer && (
        <div className="mt-2 flex gap-2">
          <input
            className="h-[30px] min-w-0 flex-1 rounded-input border border-line bg-ink-900 px-2.5 text-xs text-fg outline-none transition focus:border-jade-dim focus:shadow-[0_0_0_3px_var(--jade-glow)] disabled:opacity-50"
            disabled={disabled}
            onChange={(event) => onBodyChange(event.target.value)}
            placeholder={disabled ? "登录后可以评论..." : "写下评论..."}
            value={body}
          />
          <Button size="sm" onClick={onSubmit} disabled={disabled || !body.trim()}>
            <Send data-icon="inline-start" />
            发送
          </Button>
        </div>
      )}
      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-[min(960px,calc(100vw-32px))] border-line bg-ink-900 p-3 text-fg sm:max-w-[min(960px,calc(100vw-32px))]">
          <DialogTitle className="sr-only">评论媒体预览</DialogTitle>
          <DialogDescription className="sr-only">
            查看评论中的图片或视频媒体。
          </DialogDescription>
          {activeItem && preview ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 pr-8">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{activeItem.label}</p>
                  <p className="mono mt-0.5 text-[10px] text-fg-dim">
                    {preview.index + 1}/{preview.items.length}
                  </p>
                </div>
              </div>
              <div className="relative grid min-h-[260px] place-items-center overflow-hidden rounded-input border border-line bg-black/35">
                {activeItem.kind === "video" ? (
                  <video
                    className="max-h-[72vh] w-full bg-black object-contain"
                    controls
                    src={activeItem.src}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={activeItem.label}
                    className="max-h-[72vh] w-full object-contain"
                    src={activeItem.src}
                  />
                )}
                {preview.items.length > 1 && (
                  <>
                    <Button
                      className="absolute left-2 top-1/2 -translate-y-1/2 border-line bg-ink-950/80"
                      size="icon-sm"
                      variant="outline"
                      onClick={() => setPreview((current) => movePreview(current, -1))}
                    >
                      <ChevronLeft />
                      <span className="sr-only">上一张</span>
                    </Button>
                    <Button
                      className="absolute right-2 top-1/2 -translate-y-1/2 border-line bg-ink-950/80"
                      size="icon-sm"
                      variant="outline"
                      onClick={() => setPreview((current) => movePreview(current, 1))}
                    >
                      <ChevronRight />
                      <span className="sr-only">下一张</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CommentMediaStrip({
  media,
  onPreview,
}: {
  media: CommentMediaItem[]
  onPreview: (items: CommentMediaItem[], index: number) => void
}) {
  if (media.length === 0) return null

  return (
    <ScrollArea
      className="mt-2 h-[118px] w-full min-w-0 max-w-full rounded-input"
      scrollbars="horizontal"
      type="always"
    >
      <div className="flex w-max gap-2 pb-3 pr-2">
        {media.map((item, index) => (
          <CommentMediaThumb
            item={item}
            key={`${item.src}-${index}`}
            onClick={() => onPreview(media, index)}
          />
        ))}
      </div>
    </ScrollArea>
  )
}

function CommentMediaThumb({
  item,
  onClick,
}: {
  item: CommentMediaItem
  onClick: () => void
}) {
  const [failed, setFailed] = useState(false)
  const isVideo = item.kind === "video"

  return (
    <button
      className="relative h-[96px] w-[154px] shrink-0 overflow-hidden rounded-input border border-line bg-ink-900 text-left"
      onClick={onClick}
      type="button"
    >
      {failed ? (
        <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-ink-850 text-fg-dim">
          <ImageOff className="size-4" />
          <span className="text-[11px]">图片无法显示</span>
        </div>
      ) : isVideo ? (
        <div className="grid size-full place-items-center bg-ink-950 text-fg-muted">
          <video
            className="size-full object-cover opacity-70"
            muted
            onError={() => setFailed(true)}
            preload="metadata"
            src={item.src}
          />
          <span className="absolute inset-0 bg-black/25" />
          <span className="absolute grid size-8 place-items-center rounded-full border border-white/20 bg-black/60 text-white">
            <Play />
          </span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={item.label}
          className="size-full object-cover"
          onError={() => setFailed(true)}
          src={item.src}
        />
      )}
      {!failed && (
        <span
          className={cn(
            "mono absolute left-1.5 top-1.5 rounded-sm bg-black/70 px-1.5 py-0.5 text-[9.5px] text-fg-muted",
            isVideo && "text-white"
          )}
        >
          {isVideo ? "VIDEO" : "IMAGE"}
        </span>
      )}
    </button>
  )
}

function avatarClass(index: number) {
  const classes = [
    "bg-linear-to-br from-[#3a5a6e] to-[#243846]",
    "bg-linear-to-br from-[#5a4a6e] to-[#2e2440]",
    "bg-linear-to-br from-[#6e5a3a] to-[#403624]",
    "bg-linear-to-br from-[#3a6e5c] to-[#244038]",
  ]
  return classes[index % classes.length]
}

function formatRelative(value: string) {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return value
  const minutes = Math.max(1, Math.round((Date.now() - time) / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

function extractCommentMedia(body: string): CommentMediaItem[] {
  const matches = body.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? []
  const seen = new Set<string>()

  return matches
    .map((url) => url.replace(/[,.!?;:]+$/, ""))
    .filter((url) => {
      if (seen.has(url)) return false
      seen.add(url)
      return true
    })
    .map((url) => {
      const kind = getMediaKind(url)
      if (!kind) return null

      return {
        kind,
        src: url,
        label: getMediaLabel(url),
      }
    })
    .filter((item): item is CommentMediaItem => Boolean(item))
}

function getMediaKind(url: string): CommentMediaItem["kind"] | null {
  const cleanUrl = url.split(/[?#]/)[0]?.toLowerCase() ?? url.toLowerCase()
  if (/\.(jpg|jpeg|png|webp|gif|avif|bmp)$/.test(cleanUrl)) return "image"
  if (/\.(mp4|webm|mov|m4v)$/.test(cleanUrl)) return "video"
  return null
}

function getMediaLabel(url: string) {
  try {
    const parsed = new URL(url)
    return decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname)
  } catch {
    return url
  }
}

function movePreview(
  current: {
    items: CommentMediaItem[]
    index: number
  } | null,
  offset: number
) {
  if (!current) return current
  const nextIndex = (current.index + offset + current.items.length) % current.items.length

  return {
    ...current,
    index: nextIndex,
  }
}

"use client"

import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, Play } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import type { MediaItem } from "./view-models"

export function ResourceMediaGallery({
  media,
  title,
}: {
  media: MediaItem[]
  title: string
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const activeItem = previewIndex === null ? null : media[previewIndex]

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const element = scroller

    function handleWheel(event: WheelEvent) {
      const maxScrollLeft = element.scrollWidth - element.clientWidth
      if (maxScrollLeft <= 0) return

      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY
      if (delta === 0) return

      const canScrollLeft = element.scrollLeft > 0
      const canScrollRight = element.scrollLeft < maxScrollLeft
      const canConsumeWheel = delta < 0 ? canScrollLeft : canScrollRight
      if (!canConsumeWheel) return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      element.scrollLeft = Math.min(
        maxScrollLeft,
        Math.max(0, element.scrollLeft + delta)
      )
    }

    element.addEventListener("wheel", handleWheel, { passive: false })

    return () => {
      element.removeEventListener("wheel", handleWheel)
    }
  }, [])

  if (media.length === 0) return null

  return (
    <>
      <div
        ref={scrollerRef}
        className="mt-1 h-[calc(var(--media-h)+18px)] w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden rounded-input overscroll-x-contain [scrollbar-color:var(--line)_transparent] [scrollbar-width:thin]"
      >
        <div className="flex w-max gap-2 pb-3 pr-2">
          {media.map((item, index) => (
            <MediaPreview
              item={item}
              key={`${item.src}-${index}`}
              index={index}
              onPreview={() => {
                if (item.kind === "video") {
                  window.open(item.src, "_blank", "noopener,noreferrer")
                  return
                }
                setPreviewIndex(index)
              }}
              total={media.length}
              title={title}
            />
          ))}
        </div>
      </div>
      <Dialog open={previewIndex !== null} onOpenChange={(open) => !open && setPreviewIndex(null)}>
        <DialogContent className="max-w-[min(960px,calc(100vw-32px))] border-line bg-ink-900 p-3 text-fg sm:max-w-[min(960px,calc(100vw-32px))]">
          <DialogTitle className="sr-only">资源媒体预览</DialogTitle>
          <DialogDescription className="sr-only">
            查看当前资源的图片或视频媒体。
          </DialogDescription>
          {activeItem && previewIndex !== null ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 pr-8">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{title}</p>
                  <p className="mono mt-0.5 text-[10px] text-fg-dim">
                    {previewIndex + 1}/{media.length}
                  </p>
                </div>
              </div>
              <div className="relative grid max-h-[78vh] min-h-[260px] place-items-start overflow-auto rounded-input border border-line bg-black/35">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`${title} preview ${previewIndex + 1}`}
                  className="h-auto w-full max-w-none object-contain"
                  src={activeItem.src}
                />
                {media.length > 1 && (
                  <>
                    <Button
                      className="absolute left-2 top-1/2 -translate-y-1/2 border-line bg-ink-950/80"
                      size="icon-sm"
                      variant="outline"
                      onClick={() => setPreviewIndex((current) => movePreviewIndex(current, media.length, -1))}
                    >
                      <ChevronLeft />
                      <span className="sr-only">上一张</span>
                    </Button>
                    <Button
                      className="absolute right-2 top-1/2 -translate-y-1/2 border-line bg-ink-950/80"
                      size="icon-sm"
                      variant="outline"
                      onClick={() => setPreviewIndex((current) => movePreviewIndex(current, media.length, 1))}
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
    </>
  )
}

function MediaPreview({
  index,
  item,
  onPreview,
  title,
  total,
}: {
  index: number
  item: MediaItem
  onPreview: () => void
  title: string
  total: number
}) {
  const [failed, setFailed] = useState(false)
  const previewSrc = item.kind === "video" ? item.preview ?? item.src : item.src

  if (item.kind === "video") {
    return (
      <button
        className="relative grid h-media w-[228px] shrink-0 place-items-center overflow-hidden rounded-input border border-line bg-ink-900 text-left transition hover:border-jade-dim hover:bg-ink-850"
        onClick={onPreview}
        type="button"
      >
        {failed || !previewSrc ? (
          <div className="flex size-full flex-col items-center justify-center gap-2 bg-ink-850 text-fg-dim">
            <ImageOff className="size-5" />
            <span className="text-xs">媒体无法显示</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`${title} preview ${index + 1}`}
            className="size-full object-cover"
            onError={() => setFailed(true)}
            src={previewSrc}
          />
        )}
        <span className="absolute inset-0 bg-linear-to-t from-black/45 via-black/10 to-transparent" />
        <span className="absolute inset-0 z-10 m-auto grid size-11 place-items-center rounded-full border border-white/20 bg-black/55 text-white shadow-[0_8px_28px_rgba(0,0,0,.35)] backdrop-blur-sm transition group-hover/resource-card:bg-black/65">
          <Play className="ml-0.5 size-4 fill-current stroke-[2.25]" />
        </span>
        <span className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-sm border border-line bg-ink-950/85 px-1.5 py-0.5 text-[10px] text-fg-muted">
          <ExternalLink className="size-3" />
          打开视频
        </span>
        {item.duration && (
          <span className="mono absolute bottom-2 right-2 z-10 rounded-sm border border-line bg-ink-950/85 px-1.5 py-0.5 text-[10px] text-fg-muted">
            {item.duration}
          </span>
        )}
      </button>
    )
  }

  return (
    <button
      className="relative h-media w-[228px] shrink-0 overflow-hidden rounded-input border border-line bg-ink-900 text-left"
      onClick={onPreview}
      type="button"
    >
      {failed || !previewSrc ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 bg-ink-850 text-fg-dim">
          <ImageOff className="size-5" />
          <span className="text-xs">媒体无法显示</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`${title} preview ${index + 1}`}
          className="size-full object-cover"
          onError={() => setFailed(true)}
          src={previewSrc}
        />
      )}
      <span className="mono absolute left-1.5 top-1.5 rounded-sm bg-black/70 px-1.5 py-0.5 text-[9.5px] text-fg-muted">
        {index + 1}/{total}
      </span>
    </button>
  )
}

function movePreviewIndex(current: number | null, total: number, offset: number) {
  if (current === null) return current
  return (current + offset + total) % total
}

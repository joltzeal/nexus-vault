"use client"

import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImageOff,
  Play,
} from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import type { MediaItem } from "@/features/components/view-models"
import { cn } from "@/lib/utils"

export function ResourceCardMediaCarousel({
  media,
  title,
}: {
  media: MediaItem[]
  title: string
}) {
  const [api, setApi] = useState<CarouselApi>()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const activeItem = previewIndex === null ? null : media[previewIndex]
  const naturalPreview =
    activeItem?.kind === "image" && activeItem.fit === "natural"

  useEffect(() => {
    if (!api) return

    const updateCurrentIndex = () => setCurrentIndex(api.selectedScrollSnap())

    updateCurrentIndex()
    api.on("select", updateCurrentIndex)
    api.on("reInit", updateCurrentIndex)

    return () => {
      api.off("select", updateCurrentIndex)
      api.off("reInit", updateCurrentIndex)
    }
  }, [api])

  useEffect(() => {
    setCurrentIndex((value) => Math.min(value, Math.max(media.length - 1, 0)))
  }, [media.length])

  if (media.length === 0) return null

  return (
    <>
      <Carousel
        className="mt-2 overflow-hidden rounded-input border border-line bg-ink-900 shadow-inner"
        onClick={(event) => event.stopPropagation()}
        opts={{ align: "start", loop: false }}
        setApi={setApi}
      >
        <CarouselContent className="-ml-0">
          {media.map((item, index) => (
            <CarouselItem
              className={cn(
                "pl-0",
                index !== currentIndex && "h-0 overflow-hidden"
              )}
              key={`${item.src}-${index}`}
            >
              <CardMediaSlide
                index={index}
                item={item}
                onPreview={() => setPreviewIndex(index)}
                title={title}
                total={media.length}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        {media.length > 1 && (
          <>
            <CarouselPrevious
              className="left-2 size-7 border-line-soft bg-ink-850/88 text-fg backdrop-blur-sm shadow-[0_8px_22px_rgba(0,0,0,.32)] hover:border-jade-dim hover:bg-ink-800 hover:text-jade disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-3.5"
              size="icon-xs"
              variant="outline"
            />
            <CarouselNext
              className="right-2 size-7 border-line-soft bg-ink-850/88 text-fg backdrop-blur-sm shadow-[0_8px_22px_rgba(0,0,0,.32)] hover:border-jade-dim hover:bg-ink-800 hover:text-jade disabled:pointer-events-none disabled:opacity-35 [&_svg]:size-3.5"
              size="icon-xs"
              variant="outline"
            />
          </>
        )}
      </Carousel>
      <Dialog
        open={previewIndex !== null}
        onOpenChange={(open) => !open && setPreviewIndex(null)}
      >
        <DialogContent className="max-w-[min(960px,calc(100vw-32px))] border-line bg-ink-900 p-3 text-fg sm:max-w-[min(960px,calc(100vw-32px))]">
          <DialogTitle className="sr-only">资源媒体预览</DialogTitle>
          <DialogDescription className="sr-only">
            查看当前资源的图片媒体。
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
              <div className="relative grid max-h-[78vh] min-h-[260px] place-items-center overflow-hidden rounded-input border border-line bg-black/35">
                <img
                  alt={`${title} preview ${previewIndex + 1}`}
                  className={cn(
                    "max-w-full object-contain",
                    naturalPreview ? "max-h-[78vh]" : "max-h-[78vh]"
                  )}
                  src={activeItem.src}
                />
                {media.length > 1 && (
                  <>
                    <Button
                      className="absolute left-2 top-1/2 -translate-y-1/2 border-line-soft bg-ink-850/88 text-fg backdrop-blur-sm hover:border-jade-dim hover:bg-ink-800 hover:text-jade disabled:pointer-events-none disabled:opacity-35"
                      disabled={previewIndex === 0}
                      onClick={() =>
                        setPreviewIndex((current) =>
                          current === null ? current : Math.max(0, current - 1)
                        )
                      }
                      size="icon-sm"
                      variant="outline"
                    >
                      <ChevronLeft />
                      <span className="sr-only">上一张</span>
                    </Button>
                    <Button
                      className="absolute right-2 top-1/2 -translate-y-1/2 border-line-soft bg-ink-850/88 text-fg backdrop-blur-sm hover:border-jade-dim hover:bg-ink-800 hover:text-jade disabled:pointer-events-none disabled:opacity-35"
                      disabled={previewIndex === media.length - 1}
                      onClick={() =>
                        setPreviewIndex((current) =>
                          current === null
                            ? current
                            : Math.min(media.length - 1, current + 1)
                        )
                      }
                      size="icon-sm"
                      variant="outline"
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

function CardMediaSlide({
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
  const naturalImage = item.kind === "image" && item.fit === "natural"
  const unavailable = failed || !previewSrc

  return (
    <button
      className={cn(
        "relative grid w-full place-items-center overflow-hidden bg-black/30 text-left",
        unavailable
          ? "aspect-[4/3] min-h-[180px]"
          : naturalImage
            ? "min-h-0"
            : "aspect-[4/3] min-h-[180px]"
      )}
      onClick={(event) => {
        event.stopPropagation()
        if (item.kind === "video") {
          window.open(item.src, "_blank", "noopener,noreferrer")
          return
        }
        if (!unavailable) {
          onPreview()
        }
      }}
      type="button"
    >
      {unavailable ? (
        <div className="flex size-full flex-col items-center justify-center gap-2 bg-ink-850 text-fg-dim">
          <ImageOff className="size-6" />
          <span className="text-xs">媒体无法显示</span>
        </div>
      ) : (
        <img
          alt={`${title} preview ${index + 1}`}
          className={cn(
            "object-contain",
            naturalImage ? "h-auto max-h-[360px] max-w-full" : "size-full"
          )}
          onError={() => setFailed(true)}
          src={previewSrc}
        />
      )}
      <span className="mono absolute left-2 top-2 rounded-sm bg-black/70 px-1.5 py-0.5 text-[9.5px] text-fg-muted">
        {index + 1}/{total}
      </span>
      {item.kind === "video" && !unavailable && (
        <>
          <span className="absolute inset-0 bg-linear-to-t from-black/45 via-black/10 to-transparent" />
          <span className="absolute inset-0 z-10 m-auto grid size-11 place-items-center rounded-full border border-white/20 bg-black/55 text-white shadow-[0_8px_28px_rgba(0,0,0,.35)] backdrop-blur-sm">
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
        </>
      )}
    </button>
  )
}

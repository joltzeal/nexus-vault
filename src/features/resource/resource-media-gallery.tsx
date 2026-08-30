"use client";

import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImageOff,
  Play,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type SyntheticEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MediaItem } from "./types";
import { LazyMediaImage } from "./components/lazy-media-image";
import { LivePhotoMedia } from "./components/live-photo-media";

export function ResourceMediaGallery({
  media,
  title,
  variant = "scroll",
}: {
  media: MediaItem[];
  title: string;
  variant?: "scroll" | "carousel";
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const mediaKey = media
    .map((item) => `${item.src}:${item.aspectRatio ?? ""}`)
    .join("|");
  const knownMediaAspectRatios = useMemo(() => {
    return mediaKey
      .split("|")
      .reduce<Record<number, number>>((ratios, item, index) => {
        const separator = item.lastIndexOf(":");
        const aspectRatio = Number(item.slice(separator + 1));
        if (aspectRatio > 0) ratios[index] = aspectRatio;
        return ratios;
      }, {});
  }, [mediaKey]);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
  const [mediaAspectRatios, setMediaAspectRatios] = useState<
    Record<number, number>
  >(knownMediaAspectRatios);
  const carouselAspectRatio = mediaAspectRatios[currentSlide] ?? 16 / 9;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeItem = previewIndex === null ? null : media[previewIndex];
  const activeImage = activeItem?.kind === "image" ? activeItem : null;
  const activeLivePhoto = activeImage?.livePhoto ? activeImage : null;
  const activeVideo =
    activeItem?.kind === "video" && activeItem.playback === "inline"
      ? activeItem
      : null;
  const previewableCount = media.filter(isInlinePreviewableMedia).length;

  useEffect(() => {
    if (variant !== "scroll") {
      setHasHorizontalOverflow(false);
      return;
    }

    const scroller = scrollerRef.current;
    if (!scroller) return;
    const element = scroller;
    const content = element.firstElementChild;

    function updateHorizontalOverflow() {
      setHasHorizontalOverflow(element.scrollWidth > element.clientWidth + 1);
    }

    function handleWheel(event: WheelEvent) {
      const maxScrollLeft = element.scrollWidth - element.clientWidth;
      if (maxScrollLeft <= 0) return;

      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (delta === 0) return;

      const canScrollLeft = element.scrollLeft > 0;
      const canScrollRight = element.scrollLeft < maxScrollLeft;
      const canConsumeWheel = delta < 0 ? canScrollLeft : canScrollRight;
      if (!canConsumeWheel) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      element.scrollLeft = Math.min(
        maxScrollLeft,
        Math.max(0, element.scrollLeft + delta),
      );
    }

    updateHorizontalOverflow();
    element.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("resize", updateHorizontalOverflow);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateHorizontalOverflow);
    resizeObserver?.observe(element);
    if (content) resizeObserver?.observe(content);

    return () => {
      element.removeEventListener("wheel", handleWheel);
      window.removeEventListener("resize", updateHorizontalOverflow);
      resizeObserver?.disconnect();
    };
  }, [mediaKey, variant]);

  useEffect(() => {
    setPreviewIndex((current) => {
      if (current === null) return current;
      if (media.length === 0) return null;
      return Math.min(current, media.length - 1);
    });
  }, [media.length]);

  useEffect(() => {
    if (!carouselApi) return;

    function updateCurrentSlide(api: CarouselApi) {
      if (!api) return;
      setCurrentSlide(api.selectedScrollSnap());
    }

    updateCurrentSlide(carouselApi);
    carouselApi.on("select", updateCurrentSlide);
    carouselApi.on("reInit", updateCurrentSlide);

    return () => {
      carouselApi.off("select", updateCurrentSlide);
      carouselApi.off("reInit", updateCurrentSlide);
    };
  }, [carouselApi]);

  useEffect(() => {
    setCurrentSlide(0);
    setMediaAspectRatios(knownMediaAspectRatios);
  }, [knownMediaAspectRatios, mediaKey]);

  if (media.length === 0) return null;

  function handlePreview(index: number) {
    const item = media[index];
    if (!item) return;

    if (item.kind === "video" && item.playback !== "inline") {
      window.open(item.src, "_blank", "noopener,noreferrer");
      return;
    }

    if (isInlinePreviewableMedia(item)) {
      setPreviewIndex(index);
    }
  }

  function handleMediaMeasure(index: number, width: number, height: number) {
    if (width <= 0 || height <= 0) return;
    const aspectRatio = width / height;
    setMediaAspectRatios((current) => {
      if (Math.abs((current[index] ?? 0) - aspectRatio) < 0.001) return current;
      return {
        ...current,
        [index]: aspectRatio,
      };
    });
  }

  return (
    <>
      {variant === "carousel" ? (
        <Carousel
          className="group/media-carousel mt-1 w-full min-w-0 overflow-hidden [&_[data-slot=carousel-content]]:h-full [&_[data-slot=carousel-content]>div]:h-full [&_[data-slot=carousel-item]]:h-full"
          opts={{ align: "start" }}
          setApi={setCarouselApi}
          style={{ aspectRatio: `${carouselAspectRatio}` }}
          onClick={(event) => event.stopPropagation()}
        >
          <CarouselContent className="-ml-0 items-start">
            {media.map((item, index) => (
              <CarouselItem className="pl-0" key={`${item.src}-${index}`}>
                <MediaPreview
                  item={item}
                  aspectRatio={mediaAspectRatios[index]}
                  index={index}
                  onMediaMeasure={(width, height) =>
                    handleMediaMeasure(index, width, height)
                  }
                  onPreview={() => handlePreview(index)}
                  title={title}
                  variant="carousel"
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          {media.length > 1 && (
            <>
              <CarouselPrevious
                className="left-2 size-7 border-line bg-ink-950/55 text-fg-muted shadow-[0_6px_18px_rgba(0,0,0,.24)] backdrop-blur-sm transition hover:border-jade-dim hover:bg-ink-850/95 hover:text-jade hover:shadow-[0_8px_22px_rgba(0,0,0,.36)] disabled:hidden [&_svg]:size-3.5"
                size="icon-xs"
                variant="outline"
              />
              <CarouselNext
                className="right-2 size-7 border-line bg-ink-950/55 text-fg-muted shadow-[0_6px_18px_rgba(0,0,0,.24)] backdrop-blur-sm transition hover:border-jade-dim hover:bg-ink-850/95 hover:text-jade hover:shadow-[0_8px_22px_rgba(0,0,0,.36)] disabled:hidden [&_svg]:size-3.5"
                size="icon-xs"
                variant="outline"
              />
              <span className="mono absolute bottom-2 right-2 rounded-sm border border-line bg-ink-950/85 px-1.5 py-0.5 text-[9.5px] text-fg-muted">
                {currentSlide + 1}/{media.length}
              </span>
            </>
          )}
        </Carousel>
      ) : (
        <div
          ref={scrollerRef}
          className={cn(
            "w-full min-w-0 max-w-full overflow-x-auto overflow-y-hidden rounded-input overscroll-x-contain [scrollbar-color:var(--line)_transparent] [scrollbar-width:thin]",
            hasHorizontalOverflow
              ? "h-[calc(var(--media-h)+18px)]"
              : "h-[var(--media-h)]",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className={cn("flex w-max gap-2", hasHorizontalOverflow && "pb-3")}
          >
            {media.map((item, index) => (
              <MediaPreview
                item={item}
                aspectRatio={mediaAspectRatios[index]}
                key={`${item.src}-${index}`}
                index={index}
                onMediaMeasure={(width, height) =>
                  handleMediaMeasure(index, width, height)
                }
                onPreview={() => handlePreview(index)}
                title={title}
              />
            ))}
          </div>
        </div>
      )}
      <Dialog
        open={previewIndex !== null}
        onOpenChange={(open) => !open && setPreviewIndex(null)}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[min(960px,calc(100vw-32px))] overflow-hidden border-line bg-ink-900 p-3 text-fg sm:max-w-[min(960px,calc(100vw-32px))]">
          <DialogTitle className="sr-only">资源媒体预览</DialogTitle>
          <DialogDescription className="sr-only">
            查看当前资源的图片或视频媒体。
          </DialogDescription>
          {(activeImage || activeVideo) && previewIndex !== null ? (
            <div className="flex min-h-0 flex-col gap-3">
              <div className="flex items-center justify-between gap-3 pr-8">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{title}</p>
                  <p className="mono mt-0.5 text-[10px] text-fg-dim">
                    {previewIndex + 1}/{media.length}
                  </p>
                </div>
              </div>
              <div className="relative grid min-h-0 w-full place-items-center overflow-hidden rounded-input border border-line bg-black/35">
                {activeLivePhoto ? (
                  <div
                    className="w-full max-w-full overflow-hidden bg-black"
                    style={{
                      aspectRatio: activeLivePhoto.aspectRatio
                        ? `${activeLivePhoto.aspectRatio}`
                        : undefined,
                      maxHeight: "calc(100dvh - 8rem)",
                    }}
                  >
                    <LivePhotoMedia
                      photoSrc={activeLivePhoto.src}
                      videoSrc={activeLivePhoto.livePhoto!.videoSrc}
                    />
                  </div>
                ) : activeImage ? (
                  <LazyMediaImage
                    alt={`${title} preview ${previewIndex + 1}`}
                    className="block h-auto max-h-[calc(100dvh-8rem)] w-auto max-w-full object-contain"
                    eager
                    src={activeImage.src}
                  />
                ) : activeVideo ? (
                  <video
                    autoPlay
                    className="block max-h-[calc(100dvh-8rem)] w-full bg-black object-contain"
                    controls
                    playsInline
                    poster={activeVideo.preview}
                    src={activeVideo.src}
                  />
                ) : null}
                {previewableCount > 1 && (
                  <>
                    <Button
                      className="absolute left-2 top-1/2 -translate-y-1/2 border-line bg-ink-950/55 text-fg-muted shadow-[0_6px_18px_rgba(0,0,0,.24)] backdrop-blur-sm transition hover:border-jade-dim hover:bg-ink-850/95 hover:text-jade hover:shadow-[0_8px_22px_rgba(0,0,0,.36)]"
                      size="icon-sm"
                      variant="outline"
                      onClick={() =>
                        setPreviewIndex((current) =>
                          movePreviewIndex(current, media, -1),
                        )
                      }
                    >
                      <ChevronLeft />
                      <span className="sr-only">上一张</span>
                    </Button>
                    <Button
                      className="absolute right-2 top-1/2 -translate-y-1/2 border-line bg-ink-950/55 text-fg-muted shadow-[0_6px_18px_rgba(0,0,0,.24)] backdrop-blur-sm transition hover:border-jade-dim hover:bg-ink-850/95 hover:text-jade hover:shadow-[0_8px_22px_rgba(0,0,0,.36)]"
                      size="icon-sm"
                      variant="outline"
                      onClick={() =>
                        setPreviewIndex((current) =>
                          movePreviewIndex(current, media, 1),
                        )
                      }
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
  );
}

function MediaPreview({
  aspectRatio,
  index,
  item,
  onMediaMeasure,
  onPreview,
  title,
  variant = "scroll",
}: {
  aspectRatio?: number;
  index: number;
  item: MediaItem;
  onMediaMeasure?: (width: number, height: number) => void;
  onPreview: () => void;
  title: string;
  variant?: "scroll" | "carousel";
}) {
  const [failed, setFailed] = useState(false);
  const previewSrc = item.kind === "video" ? item.preview : item.src;
  const isLivePhoto = item.kind === "image" && Boolean(item.livePhoto);
  const opensInline = item.kind === "video" && item.playback === "inline";
  const mediaClassName = getMediaPreviewClassName(variant, item, aspectRatio);
  const imageClassName = getMediaPreviewImageClassName(variant, item);
  const failedClassName = getMediaPreviewFailedClassName(variant, item);
  const mediaStyle = getMediaPreviewStyle(variant, item, aspectRatio);

  function handleMediaLoad(event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    onMediaMeasure?.(image.naturalWidth, image.naturalHeight);
  }

  if (item.kind === "video") {
    const content = (
      <>
        {previewSrc && !failed ? (
          <LazyMediaImage
            alt={`${title} preview ${index + 1}`}
            className={imageClassName}
            eager={variant === "carousel"}
            onError={() => setFailed(true)}
            onLoad={handleMediaLoad}
            src={previewSrc}
          />
        ) : (
          <div className={cn(failedClassName, "aspect-video")} />
        )}
        <span className="absolute inset-0 bg-linear-to-t from-black/45 via-black/10 to-transparent" />
        <span className="absolute inset-0 z-10 m-auto grid size-11 place-items-center rounded-full border border-white/20 bg-black/55 text-white shadow-[0_8px_28px_rgba(0,0,0,.35)] backdrop-blur-sm transition group-hover/resource-card:bg-black/65">
          <Play className="ml-0.5 size-4 fill-current stroke-[2.25]" />
        </span>
        <span className="absolute bottom-2 left-2 z-10 inline-flex items-center gap-1 rounded-sm border border-line bg-ink-950/85 px-1.5 py-0.5 text-[10px] text-fg-muted">
          {opensInline ? (
            <Play className="size-3 fill-current" />
          ) : (
            <ExternalLink className="size-3" />
          )}
          {opensInline ? "播放视频" : "打开视频"}
        </span>
        {(item.duration || (item.width && item.height)) && (
          <span className="absolute right-2 top-2 z-10 flex flex-col items-end gap-1">
            {item.duration && (
              <Badge className="mono h-5 border-line bg-ink-950/85 px-1.5 text-[10px] font-normal text-fg-muted">
                {item.duration}
              </Badge>
            )}
            {item.width && item.height && (
              <Badge className="mono h-5 border-line bg-ink-950/85 px-1.5 text-[10px] font-normal text-fg-muted">
                {item.width}x{item.height}
              </Badge>
            )}
          </span>
        )}
      </>
    );

    if (!opensInline) {
      return (
        <a
          aria-label={`在新标签页打开 ${title} 视频 ${index + 1}`}
          className={cn(
            mediaClassName,
            "grid place-items-center transition hover:border-jade-dim hover:bg-ink-850",
          )}
          href={item.src}
          onClick={(event) => event.stopPropagation()}
          rel="noreferrer"
          target="_blank"
          style={mediaStyle}
        >
          {content}
        </a>
      );
    }

    return (
      <button
        className={cn(
          mediaClassName,
          "grid place-items-center transition hover:border-jade-dim hover:bg-ink-850",
        )}
        onClick={(event) => {
          event.stopPropagation();
          onPreview();
        }}
        style={mediaStyle}
        type="button"
      >
        {content}
      </button>
    );
  }

  if (isLivePhoto && item.livePhoto) {
    return (
      <div
        aria-label={`播放 ${title} 实况照片 ${index + 1}`}
        className={mediaClassName}
        onClick={(event) => event.stopPropagation()}
        style={mediaStyle}
      >
        <LivePhotoMedia
          onPhotoLoad={(width, height) => onMediaMeasure?.(width, height)}
          onPreview={onPreview}
          photoSrc={item.src}
          videoSrc={item.livePhoto.videoSrc}
        />
      </div>
    );
  }

  return (
    <button
      className={mediaClassName}
      onClick={(event) => {
        event.stopPropagation();
        onPreview();
      }}
      style={mediaStyle}
      type="button"
    >
      {failed || !previewSrc ? (
        <div
          className={cn(
            failedClassName,
            "flex flex-col items-center justify-center gap-2 text-fg-dim",
          )}
        >
          <ImageOff className="size-5" />
          <span className="text-xs">媒体无法显示</span>
        </div>
      ) : (
        <LazyMediaImage
          alt={`${title} preview ${index + 1}`}
          className={imageClassName}
          eager={variant === "carousel"}
          onError={() => setFailed(true)}
          onLoad={handleMediaLoad}
          src={previewSrc}
        />
      )}
    </button>
  );
}

function getMediaPreviewClassName(
  variant: "scroll" | "carousel",
  item: MediaItem,
  aspectRatio?: number,
) {
  const base =
    "relative shrink-0 overflow-hidden rounded-sm border border-line bg-ink-900 text-left";

  if (variant === "scroll") {
    return cn(
      base,
      "grid h-[var(--media-h)] place-items-center",
      !aspectRatio && !item.aspectRatio && "w-[228px]",
    );
  }

  if (item.kind === "image") {
    return cn(base, "grid h-full w-full place-items-center bg-black/30");
  }

  return cn(base, "grid h-full w-full place-items-center bg-black/30");
}

function getMediaPreviewImageClassName(
  variant: "scroll" | "carousel",
  item: MediaItem,
) {
  if (
    variant === "carousel" &&
    (item.kind === "image" || item.kind === "video")
  ) {
    return "block size-full object-contain";
  }

  if (variant === "scroll") {
    return "block size-full object-contain";
  }

  return "size-full object-cover";
}

function getMediaPreviewFailedClassName(
  variant: "scroll" | "carousel",
  item: MediaItem,
) {
  if (variant === "carousel" && item.kind === "image") {
    return "size-full bg-ink-850";
  }

  if (variant === "carousel" && item.kind === "video") {
    return "size-full bg-ink-850";
  }

  return "size-full bg-ink-850";
}

function getMediaPreviewStyle(
  variant: "scroll" | "carousel",
  item: MediaItem,
  aspectRatio?: number,
): CSSProperties | undefined {
  if (item.kind !== "image" && item.kind !== "video") return undefined;
  const resolvedAspectRatio = aspectRatio ?? item.aspectRatio;
  if (!resolvedAspectRatio || resolvedAspectRatio <= 0) return undefined;

  if (variant !== "scroll") return undefined;

  return { width: `calc(var(--media-h) * ${resolvedAspectRatio})` };
}

function isInlinePreviewableMedia(item: MediaItem) {
  return (
    item.kind === "image" ||
    (item.kind === "video" && item.playback === "inline")
  );
}

function movePreviewIndex(
  current: number | null,
  media: MediaItem[],
  offset: number,
) {
  if (current === null) return current;
  if (media.length === 0) return null;

  for (let step = 1; step <= media.length; step += 1) {
    const next = (current + offset * step + media.length) % media.length;
    if (isInlinePreviewableMedia(media[next])) return next;
  }

  return current;
}

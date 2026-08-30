"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export function LivePhotoMedia({
  className,
  onPhotoLoad,
  onPreview,
  photoSrc,
  videoSrc,
}: {
  className?: string;
  onPhotoLoad?: (width: number, height: number) => void;
  onPreview?: () => void;
  photoSrc: string;
  videoSrc: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onPhotoLoadRef = useRef(onPhotoLoad);
  const onPreviewRef = useRef(onPreview);

  useEffect(() => {
    onPhotoLoadRef.current = onPhotoLoad;
    onPreviewRef.current = onPreview;
  }, [onPhotoLoad, onPreview]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let destroy: (() => void) | undefined;

    void import("live-photo").then(({ LivePhotoViewer }) => {
      if (disposed) return;
      const viewer = new LivePhotoViewer({
        container: host,
        height: "100%",
        imageCustomization: { styles: { objectFit: "contain" } },
        lazyLoadVideo: true,
        locale: "zh-CN",
        onClick: () => onPreviewRef.current?.(),
        onPhotoLoad: (_event, photo) =>
          onPhotoLoadRef.current?.(photo.naturalWidth, photo.naturalHeight),
        photoSrc,
        videoCustomization: { styles: { objectFit: "contain" } },
        videoSrc,
        width: "100%",
      });
      destroy = () => viewer.destroy();
    });

    return () => {
      disposed = true;
      destroy?.();
    };
  }, [photoSrc, videoSrc]);

  return (
    <div
      ref={hostRef}
      className={cn("size-full overflow-hidden bg-black/30", className)}
    />
  );
}

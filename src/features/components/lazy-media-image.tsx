"use client"

import {
  type ImgHTMLAttributes,
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from "react"

type LazyMediaImageProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "loading" | "src"
> & {
  eager?: boolean
  rootMargin?: string
  src?: string
}

export function LazyMediaImage({
  eager = false,
  onError,
  rootMargin = "900px 600px",
  src,
  ...props
}: LazyMediaImageProps) {
  const imageRef = useRef<HTMLImageElement>(null)
  const [shouldLoad, setShouldLoad] = useState(eager)

  useEffect(() => {
    setShouldLoad(eager)
  }, [eager, src])

  useEffect(() => {
    if (shouldLoad || !src) return

    const element = imageRef.current
    if (!element || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setShouldLoad(true)
        observer.disconnect()
      },
      { rootMargin }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [rootMargin, shouldLoad, src])

  function handleError(event: SyntheticEvent<HTMLImageElement, Event>) {
    if (!shouldLoad) return
    onError?.(event)
  }

  return (
    <img
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      ref={imageRef}
      src={shouldLoad ? src : undefined}
      onError={handleError}
      {...props}
    />
  )
}

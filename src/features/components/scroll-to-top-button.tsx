"use client"

import { ArrowUp } from "lucide-react"
import { useEffect, useState, type RefObject } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ScrollToTopButton({
  className,
  scrollRef,
}: {
  className?: string
  scrollRef: RefObject<HTMLElement | null>
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return

    let animationFrame = 0
    const updateVisibility = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        const hasScrollbar = root.scrollHeight > root.clientHeight + 1
        setVisible(hasScrollbar && root.scrollTop > 160)
      })
    }

    updateVisibility()
    root.addEventListener("scroll", updateVisibility, { passive: true })
    window.addEventListener("resize", updateVisibility)

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateVisibility)
    observer?.observe(root)
    if (root.firstElementChild) observer?.observe(root.firstElementChild)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      root.removeEventListener("scroll", updateVisibility)
      window.removeEventListener("resize", updateVisibility)
      observer?.disconnect()
    }
  }, [scrollRef])

  if (!visible) return null

  return (
    <Button
      aria-label="返回顶部"
      className={cn(
        "fixed bottom-4 right-4 z-40 size-9 rounded-full border-line bg-ink-850/95 text-fg-dim shadow-pop backdrop-blur transition hover:border-jade-dim hover:bg-ink-800 hover:text-jade",
        className
      )}
      onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
      size="icon-sm"
      title="返回顶部"
      type="button"
      variant="outline"
    >
      <ArrowUp />
    </Button>
  )
}

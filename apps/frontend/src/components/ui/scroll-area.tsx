"use client"

import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function ScrollArea({
  className,
  children,
  scrollbars = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  scrollbars?: "vertical" | "horizontal" | "both"
}) {
  const showVertical = scrollbars === "vertical" || scrollbars === "both"
  const showHorizontal = scrollbars === "horizontal" || scrollbars === "both"

  if (scrollbars === "horizontal") {
    const {
      scrollHideDelay: _scrollHideDelay,
      type: _type,
      ...rootProps
    } = props

    return (
      <div
        data-slot="scroll-area"
        className={cn(
          "relative min-w-0 overflow-x-scroll overflow-y-hidden [scrollbar-color:var(--ink-700)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:!block [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-ink-700 [&::-webkit-scrollbar-track]:bg-ink-900/80",
          className
        )}
        {...(rootProps as React.ComponentProps<"div">)}
      >
        {children}
      </div>
    )
  }

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative min-w-0 overflow-hidden", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="size-full min-w-0 rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {showVertical && <ScrollBar />}
      {showHorizontal && <ScrollBar orientation="horizontal" />}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "flex touch-none bg-ink-900/80 p-px transition-colors select-none",
        orientation === "horizontal"
          ? "h-2.5 flex-col border-t border-t-transparent"
          : "h-full w-2.5 border-l border-l-transparent",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-ink-700 transition-colors hover:bg-fg-dim"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }

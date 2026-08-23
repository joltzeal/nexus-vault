"use client"

import { Copy } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { MarkdownContent } from "@/features/components/markdown-content"
import { ResourceAiSummaryTransition } from "@/features/components/resource-ai-summary"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"

export function ResourceDescription({
  aiSummary,
  description,
}: {
  aiSummary?: {
    status: "pending" | "processing" | "completed" | "failed"
    text: string
  } | null
  description: string
}) {
  const [open, setOpen] = useState(false)
  const previousAiStatusRef = useRef(aiSummary?.status)
  const isStreaming = aiSummary?.status === "pending" || aiSummary?.status === "processing"
  const descriptionStartsWithImage = startsWithMarkdownImage(description)
  const collapsedDescriptionText = getCollapsedDescriptionText(description)

  useEffect(() => {
    setOpen(false)
  }, [description])

  useEffect(() => {
    const previousStatus = previousAiStatusRef.current
    if (
      aiSummary?.status === "completed" &&
      (previousStatus === "pending" || previousStatus === "processing")
    ) {
      setOpen(true)
    }
    previousAiStatusRef.current = aiSummary?.status
  }, [aiSummary?.status])

  if (isStreaming) {
    return <ResourceAiSummaryTransition text={aiSummary.text} />
  }
  if (!description) return null

  return (
    <div
      className={cn(
        "group/description relative min-w-0 cursor-pointer rounded-input border border-line-soft bg-ink-850/45 px-2 py-1 text-left outline-none transition hover:border-line hover:bg-ink-850 focus-visible:border-jade-dim focus-visible:shadow-[0_0_0_3px_var(--jade-glow)]",
        open && "border-line bg-ink-850"
      )}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("a,button")) return
        event.stopPropagation()
        setOpen((value) => !value)
      }}
      onKeyDown={(event) => {
        if (event.target instanceof Element && event.target.closest("button")) return
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        event.stopPropagation()
        setOpen((value) => !value)
      }}
      role="button"
      tabIndex={0}
    >
      {!open ? (
        <span className="block truncate text-xs leading-5 text-fg-dim">
          {descriptionStartsWithImage || !collapsedDescriptionText
            ? "Expand description"
            : collapsedDescriptionText}
        </span>
      ) : (
        <MarkdownContent
          className="min-w-0 gap-1.5 text-fg-muted"
          value={description}
        />
      )}
      <Button
        className="pointer-events-none absolute right-1 top-1 size-6 rounded-sm bg-ink-900/90 text-fg-dim opacity-0 shadow-sm backdrop-blur transition-opacity group-focus-within/description:pointer-events-auto group-focus-within/description:opacity-100 group-hover/description:pointer-events-auto group-hover/description:opacity-100 hover:text-jade"
        onClick={(event) => {
          event.stopPropagation()
          void navigator.clipboard?.writeText(description)
          toast.success("Description copied")
        }}
        size="icon-xs"
        title="Copy description"
        type="button"
        variant="ghost"
      >
        <Copy />
        <span className="sr-only">Copy description</span>
      </Button>
    </div>
  )
}

function startsWithMarkdownImage(value: string) {
  const firstLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  return Boolean(
    firstLine &&
    (/^!\[[^\]]*\]\([^\s)]+(?:\s+["'][^"']*["'])?\)/.test(firstLine) ||
      /^<img\b[^>]*>/i.test(firstLine))
  )
}

function getCollapsedDescriptionText(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^\s)]+(?:\s+["'][^"']*["'])?\)/g, "$1")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[`*_>#~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

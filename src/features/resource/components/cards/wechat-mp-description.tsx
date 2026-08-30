"use client"

import { Copy } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"

import type { ResourceCardViewMode } from "./types"

export function WechatMpDescription({
  className,
  hideImages = false,
  html,
  title,
  viewMode,
}: {
  className?: string
  hideImages?: boolean
  html?: string
  title: string
  viewMode: ResourceCardViewMode
}) {
  const [open, setOpen] = useState(false)
  const safeHtml = useMemo(() => sanitizeWechatHtml(html), [html])

  if (!safeHtml) return null

  return (
    <div
      className={cn(
        "group/wechat-html relative min-w-0 overflow-hidden rounded-input border border-border bg-background/45 transition-colors hover:border-border",
        className
      )}
      data-hide-images={hideImages ? "true" : undefined}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 py-1.5">
        <span className="mono min-w-0 truncate text-[10px] uppercase text-muted-foreground">
          Article HTML
        </span>
        <Button
          className="size-5 shrink-0 rounded-sm text-muted-foreground opacity-70 transition group-hover/wechat-html:opacity-100 hover:text-primary active:translate-y-0 [&_svg]:size-3"
          onClick={(event) => {
            event.stopPropagation()
            void navigator.clipboard?.writeText(html ?? "")
            toast.success("公众号原文已复制")
          }}
          size="icon-xs"
          title="复制公众号原文"
          type="button"
          variant="ghost"
        >
          <Copy />
          <span className="sr-only">复制公众号原文</span>
        </Button>
      </div>
      <div
        className={cn(
          "wechat-mp-html min-w-0 overflow-hidden px-3 py-3 transition-[max-height]",
          open
            ? "max-h-[none]"
            : viewMode === "list"
              ? "max-h-[380px]"
              : "max-h-[260px]"
        )}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
        title={title}
      />
      {!open && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background via-background/85 to-transparent" />
      )}
      <div className="relative border-t border-border bg-background/80 px-2.5 py-1.5">
        <Button
          className="h-6 w-full justify-center rounded-sm text-[11px] text-muted-foreground hover:bg-muted hover:text-primary active:translate-y-0"
          onClick={(event) => {
            event.stopPropagation()
            setOpen((value) => !value)
          }}
          size="xs"
          type="button"
          variant="ghost"
        >
          {open ? "收起原文" : "展开原文"}
        </Button>
      </div>
    </div>
  )
}

function sanitizeWechatHtml(value?: string) {
  if (!value?.trim()) return ""
  if (typeof document === "undefined") return escapeHtml(value)

  const template = document.createElement("template")
  template.innerHTML = value

  template.content
    .querySelectorAll("script,style,iframe,object,embed,link,meta,base,form,input,button,textarea,select,noscript")
    .forEach((element) => element.remove())

  for (const element of Array.from(template.content.querySelectorAll("*"))) {
    normalizeElement(element)
  }

  return template.innerHTML.trim()
}

function normalizeElement(element: Element) {
  if (element instanceof HTMLImageElement) {
    const lazySrc =
      element.getAttribute("data-src") ||
      element.getAttribute("data-original") ||
      element.getAttribute("data-backsrc")
    if (lazySrc) element.setAttribute("src", decodeHtmlEntities(lazySrc))
    element.setAttribute("loading", "lazy")
    element.setAttribute("referrerpolicy", "no-referrer")
    if (!element.getAttribute("alt")) element.setAttribute("alt", "")
  }

  if (element instanceof HTMLAnchorElement) {
    element.setAttribute("target", "_blank")
    element.setAttribute("rel", "noreferrer")
  }

  for (const attr of Array.from(element.attributes)) {
    const name = attr.name.toLowerCase()
    if (
      name.startsWith("on") ||
      name === "style" ||
      name === "srcset" ||
      name === "class" ||
      name === "id"
    ) {
      element.removeAttribute(attr.name)
      continue
    }

    if ((name === "href" || name === "src") && !isSafeUrl(attr.value)) {
      element.removeAttribute(attr.name)
      continue
    }

    if (name.startsWith("data-")) {
      element.removeAttribute(attr.name)
    }
  }
}

function isSafeUrl(value: string) {
  const trimmed = decodeHtmlEntities(value).trim()
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("/")) return true

  try {
    const url = new URL(trimmed, window.location.origin)
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
  } catch {
    return false
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function decodeHtmlEntities(value: string) {
  const textarea = document.createElement("textarea")
  textarea.innerHTML = value
  return textarea.value
}

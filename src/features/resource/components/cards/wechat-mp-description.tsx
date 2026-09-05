"use client"

import { BookOpenText, Copy } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"

import type { ResourceCardViewMode } from "./types"

export function WechatMpDescription({
  className,
  hideImages = false,
  html,
  onOpenReader,
  title,
  viewMode,
}: {
  className?: string
  hideImages?: boolean
  html?: string
  onOpenReader?: () => void
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
        <div className="flex shrink-0 items-center gap-1">
          {onOpenReader ? (
            <Button
              className="h-6 items-center rounded-sm px-1.5 text-[11px] leading-none text-muted-foreground opacity-80 transition group-hover/wechat-html:opacity-100 hover:text-primary active:translate-y-0 [&_svg]:size-3 [&_svg]:self-center"
              onClick={(event) => {
                event.stopPropagation()
                onOpenReader()
              }}
              size="xs"
              title="在弹窗中阅读文章"
              type="button"
              variant="ghost"
            >
              <BookOpenText />
              阅读文章
            </Button>
          ) : null}
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
      </div>
      <div
      className={cn(
        "wechat-mp-html min-w-0 overflow-hidden px-3 py-3 text-sm leading-6 transition-[max-height]",
        hideImages && "[&_img]:hidden",
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

export function WechatMpArticleDialog({
  accountName,
  hideImages = false,
  html,
  onOpenChange,
  open,
  title,
}: {
  accountName?: string
  hideImages?: boolean
  html?: string
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}) {
  const safeHtml = useMemo(() => sanitizeWechatHtml(html), [html])
  if (!safeHtml) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90dvh,900px)] max-h-[calc(100dvh-2rem)] w-[min(1000px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden rounded-none border-border bg-card p-0 text-foreground sm:max-w-[1000px]">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
          <DialogTitle className="font-display text-lg">{title}</DialogTitle>
          <DialogDescription className="truncate text-muted-foreground">
            {accountName || "微信公众号"}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <article
            className={cn(
              "wechat-mp-html mx-auto min-w-0 max-w-3xl px-5 py-6 text-[15px] leading-7 text-foreground sm:px-10 sm:py-8",
              hideImages && "[&_img]:hidden",
            )}
            data-hide-images={hideImages ? "true" : undefined}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
            title={title}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
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

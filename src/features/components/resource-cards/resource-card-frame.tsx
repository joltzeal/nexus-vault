import type { MouseEventHandler, ReactNode, Ref } from "react"
import { AlertTriangle, LoaderCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import type {
  ResourceCardViewMode,
  ResourcePreviewRenderState,
} from "./types"

export function ResourceCardFrame({
  actions,
  annotation,
  articleId,
  articleRef,
  children,
  className,
  commentAction,
  commentEditor,
  descriptionContent,
  footerActions,
  footerMeta,
  leadingControl,
  onActivate,
  sourceIcon,
  sourceName,
  state,
  url,
  viewMode,
}: {
  actions?: ReactNode
  annotation?: ReactNode
  articleId?: string
  articleRef?: Ref<HTMLElement>
  children: ReactNode
  className?: string
  commentAction?: ReactNode
  commentEditor?: ReactNode
  descriptionContent?: ReactNode
  footerActions?: ReactNode
  footerMeta?: ReactNode
  leadingControl?: ReactNode
  onActivate?: MouseEventHandler<HTMLElement>
  sourceIcon: ReactNode
  sourceName: string
  state: ResourcePreviewRenderState
  url: string
  viewMode: ResourceCardViewMode
}) {
  const hasFooter = Boolean(
    commentAction || commentEditor || footerActions || annotation
  )

  const sourceMark = (
    <span
      aria-hidden="true"
      className="grid size-5 shrink-0 place-items-center [&_img]:size-4 [&_svg]:size-4"
    >
      {sourceIcon}
    </span>
  )

  return (
    <article
      className={cn(
        "group/resource-preview mono relative flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-ink-800 text-xs transition-colors hover:border-ink-700 hover:bg-ink-750",
        viewMode === "list"
          ? "[--media-h:220px] sm:[--media-h:280px]"
          : "mb-2 [--media-h:210px] [break-inside:avoid]",
        state === "failed" && "border-destructive/30",
        className
      )}
      data-preview-state={state}
      data-view-mode={viewMode}
      id={articleId}
      onClick={onActivate}
      ref={articleRef}
    >
      <header className="flex min-w-0 items-center gap-1.5 px-3 py-1.5 text-[10px]">
        <div className="flex min-w-0 items-center gap-1.5">
          {leadingControl ? (
            <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
              {leadingControl}
            </div>
          ) : (
            sourceMark
          )}
          <Badge
            className="mono h-4 cursor-pointer px-1.5 text-[9px] font-normal transition-colors hover:bg-ink-700 hover:text-jade-bright"
            render={
              <a
                href={url}
                onClick={(event) => event.stopPropagation()}
                rel="noreferrer"
                target="_blank"
                title={`打开 ${sourceName}`}
              />
            }
            variant="secondary"
          >
            {sourceName}
          </Badge>
        </div>
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1">
          {state === "loading" && (
            <Badge className="mono h-4 px-1.5 text-[9px] font-normal" variant="secondary">
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
              Processing
            </Badge>
          )}
          {state === "failed" && (
            <Badge className="mono h-4 px-1.5 text-[9px] font-normal" variant="destructive">
              <AlertTriangle data-icon="inline-start" />
              Failed
            </Badge>
          )}
          {actions && (
            <div className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {actions}
            </div>
          )}
        </div>
      </header>

      <Separator className="h-px w-full shrink-0 bg-line" />

      <section className="flex min-w-0 flex-col gap-1.5 px-3 py-2.5">
        {children}

        {descriptionContent}

        {footerMeta && (
          <div className="mt-auto min-w-0 pt-0.5 text-[10px] text-fg-dim">
            {footerMeta}
          </div>
        )}
      </section>

      {hasFooter && (
        <>
          <Separator className="h-px w-full shrink-0 bg-line" />
          <footer className="flex min-w-0 flex-col">
            {(commentAction || footerActions) && (
              <div className="flex min-w-0 items-center justify-between gap-2 px-3 py-1.5 text-[10px]">
                {commentAction ?? <span />}
                {footerActions}
              </div>
            )}

            {(annotation || commentEditor) && (
              <Separator className="h-px w-full shrink-0 bg-line" />
            )}

            {annotation && !commentEditor && (
              <div className="px-3.5 py-3" onClick={(event) => event.stopPropagation()}>
                <div className="min-w-0 rounded-input border border-line-soft bg-ink-850/35 px-2 py-1 text-xs leading-5 text-fg-muted">
                  <span className="mono mr-2 text-[10px] uppercase tracking-[.12em] text-fg-faint">
                    COMMENT
                  </span>
                  {annotation}
                </div>
              </div>
            )}

            {commentEditor && (
              <div className="px-3.5 py-3" onClick={(event) => event.stopPropagation()}>
                {commentEditor}
              </div>
            )}
          </footer>
        </>
      )}
    </article>
  )
}

export function ResourceCardSkeleton({
  media = false,
  viewMode,
}: {
  media?: boolean
  viewMode: ResourceCardViewMode
}) {
  return (
    <div aria-hidden="true" className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Skeleton className="size-11 shrink-0 rounded-full bg-ink-700" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-2/5 bg-ink-700" />
          <Skeleton className="h-3 w-1/4 bg-ink-700" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-full bg-ink-700" />
        <Skeleton className="h-3 w-5/6 bg-ink-700" />
        {viewMode === "list" && <Skeleton className="h-3 w-3/5 bg-ink-700" />}
      </div>
      {media && (
        <Skeleton
          className={cn(
            "w-full rounded-input bg-ink-700",
            viewMode === "list" ? "aspect-[16/6]" : "aspect-video"
          )}
        />
      )}
    </div>
  )
}

export function PreviewMetrics({
  items,
}: {
  items: Array<{ label: string; value?: number }>
}) {
  const visibleItems = items.filter((item) => typeof item.value === "number")
  if (visibleItems.length === 0) return null

  return (
    <dl className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">
      {visibleItems.map((item) => (
        <div className="flex items-baseline gap-1.5" key={item.label}>
          <dd className="mono text-xs font-semibold text-fg">
            {formatCompactNumber(item.value ?? 0)}
          </dd>
          <dt className="text-[11px] text-fg-dim">{item.label}</dt>
        </div>
      ))}
    </dl>
  )
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatPreviewDate(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

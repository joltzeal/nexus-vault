/* eslint-disable react-refresh/only-export-components */
import type { ComponentType, MouseEventHandler, ReactNode, Ref } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";

import { Badge as AndromedaBadge } from "@/components/aicanvas/andromeda/components/Badge";
import { Tag as AndromedaTag } from "@/components/aicanvas/andromeda/components/Tag";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { ResourceCardViewMode, ResourcePreviewRenderState } from "./types";

const BaseBadge = AndromedaBadge as unknown as ComponentType<
  Record<string, unknown>
>;
const BaseTag = AndromedaTag as unknown as ComponentType<
  Record<string, unknown>
>;

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
  sourceLabelVariant = "tag",
  state,
  url,
  viewMode,
}: {
  actions?: ReactNode;
  annotation?: ReactNode;
  articleId?: string;
  articleRef?: Ref<HTMLElement>;
  children: ReactNode;
  className?: string;
  commentAction?: ReactNode;
  commentEditor?: ReactNode;
  descriptionContent?: ReactNode;
  footerActions?: ReactNode;
  footerMeta?: ReactNode;
  leadingControl?: ReactNode;
  onActivate?: MouseEventHandler<HTMLElement>;
  sourceIcon: ReactNode;
  sourceName: string;
  sourceLabelVariant?: "plain" | "tag";
  state: ResourcePreviewRenderState;
  url: string;
  viewMode: ResourceCardViewMode;
}) {
  const hasFooter = Boolean(
    commentAction || commentEditor || footerActions || annotation,
  );

  const sourceMark = (
    <span
      aria-hidden="true"
      className="grid size-7 shrink-0 place-items-center [&_img]:size-6 [&_svg]:size-6"
    >
      {sourceIcon}
    </span>
  );
  const SourceLabel = sourceLabelVariant === "plain" ? BaseBadge : BaseTag;

  return (
    <article
      className={cn(
        "group/resource-preview mono relative flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-ink-800 text-xs outline-none transition-[border-color,box-shadow,background-color] hover:border-ink-700 hover:bg-ink-750 focus:border-[color:var(--jade)] focus:shadow-[0_0_0_1px_var(--jade),0_0_8px_var(--jade-dim)] focus-within:border-[color:var(--jade)] focus-within:shadow-[0_0_0_1px_var(--jade),0_0_8px_var(--jade-dim)]",
        viewMode === "masonry" && "mb-2 [break-inside:avoid]",
        state === "failed" && "border-destructive/30",
        className,
      )}
      data-preview-state={state}
      data-view-mode={viewMode}
      id={articleId}
      onClick={onActivate}
      ref={articleRef}
      tabIndex={0}
    >
      <header className="flex min-h-10 min-w-0 items-center gap-2 px-3 py-1 text-label">
        <div className="flex min-w-0 items-center gap-1.5">
          {leadingControl ? (
            <div
              className="shrink-0 "
              onClick={(event) => event.stopPropagation()}
            >
              {leadingControl}
            </div>
          ) : (
            sourceMark
          )}
          <a
            href={url}
            onClick={(event) => event.stopPropagation()}
            rel="noreferrer"
            target="_blank"
            title={`打开 ${sourceName}`}
          >
            <SourceLabel className="cursor-pointer" variant="default">
              {sourceName}
            </SourceLabel>
          </a>
        </div>
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1">
          {state === "loading" && (
            <BaseBadge variant="outline">
              <LoaderCircle
                data-icon="inline-start"
                className="size-[var(--andromeda-icon-xs,12px)] animate-spin"
              />
              Processing
            </BaseBadge>
          )}
          {state === "failed" && (
            <BaseBadge variant="fault">
              <AlertTriangle
                data-icon="inline-start"
                className="size-[var(--andromeda-icon-xs,12px)]"
              />
              Failed
            </BaseBadge>
          )}
          {actions && (
            <div className="pointer-events-none min-w-0 overflow-x-auto opacity-0 transition-opacity [scrollbar-width:none] group-hover/resource-preview:pointer-events-auto group-hover/resource-preview:opacity-100 group-focus-within/resource-preview:pointer-events-auto group-focus-within/resource-preview:opacity-100 [&::-webkit-scrollbar]:hidden">
              {actions}
            </div>
          )}
        </div>
      </header>

      <Separator className="h-px w-full shrink-0 bg-border" />

      <section className="flex min-w-0 flex-col gap-2 px-3 py-2.5">
        {children}

        {descriptionContent}

        {footerMeta && (
          <div className="mt-auto min-w-0 pt-0.5 text-[10px] text-muted-foreground">
            {footerMeta}
          </div>
        )}
      </section>

      {hasFooter && (
        <>
          <Separator className="h-px w-full shrink-0 bg-border" />
          <footer className="flex min-w-0 flex-col">
            {(commentAction || footerActions) && (
              <div className="flex min-w-0 items-center justify-between gap-2 px-3 py-1.5 text-[10px]">
                {commentAction ?? <span />}
                {footerActions && (
                  <div className="pointer-events-none opacity-0 transition-opacity group-hover/resource-preview:pointer-events-auto group-hover/resource-preview:opacity-100 group-focus-within/resource-preview:pointer-events-auto group-focus-within/resource-preview:opacity-100">
                    {footerActions}
                  </div>
                )}
              </div>
            )}

            {(annotation || commentEditor) && (
              <Separator className="h-px w-full shrink-0 bg-border" />
            )}

            {annotation && !commentEditor && (
              <div
                className="px-3.5 py-3"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="min-w-0 rounded-input border border-border bg-card/35 px-2 py-1 text-xs leading-5 text-muted-foreground">
                  <span className="mono mr-2 text-[10px] uppercase tracking-[.12em] text-muted-foreground">
                    COMMENT
                  </span>
                  {annotation}
                </div>
              </div>
            )}

            {commentEditor && (
              <div
                className="px-3.5 py-3"
                onClick={(event) => event.stopPropagation()}
              >
                {commentEditor}
              </div>
            )}
          </footer>
        </>
      )}
    </article>
  );
}

export function ResourceCardSkeleton({
  media = false,
  viewMode,
}: {
  media?: boolean;
  viewMode: ResourceCardViewMode;
}) {
  return (
    <div aria-hidden="true" className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Skeleton className="size-11 shrink-0 rounded-full bg-muted" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-2/5 bg-muted" />
          <Skeleton className="h-3 w-1/4 bg-muted" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-full bg-muted" />
        <Skeleton className="h-3 w-5/6 bg-muted" />
        {viewMode === "list" && <Skeleton className="h-3 w-3/5 bg-muted" />}
      </div>
      {media && (
        <Skeleton
          className={cn(
            "w-full rounded-input bg-muted",
            viewMode === "list" ? "aspect-[16/6]" : "aspect-video",
          )}
        />
      )}
    </div>
  );
}

export function PreviewMetrics({
  items,
}: {
  items: Array<{ label: string; value?: number }>;
}) {
  const visibleItems = items.filter((item) => typeof item.value === "number");
  if (visibleItems.length === 0) return null;

  return (
    <dl className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">
      {visibleItems.map((item) => (
        <div className="flex items-baseline gap-1.5" key={item.label}>
          <dd className="mono text-xs font-semibold text-foreground">
            {formatCompactNumber(item.value ?? 0)}
          </dd>
          <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPreviewDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

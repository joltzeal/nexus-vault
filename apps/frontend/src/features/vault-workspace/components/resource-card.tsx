"use client"

import { useSortable } from "@dnd-kit/react/sortable"
import {
  Copy,
  ExternalLink,
  GripVertical,
  MessageSquare,
  Star,
  Trash2,
} from "lucide-react"
import { useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Pill,
  PillIndicator,
  PillStatus,
} from "@/components/kibo-ui/pill"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MarkdownContent } from "@/features/vault-workspace/components/markdown-content"
import { ResourceCommentsPreview } from "@/features/vault-workspace/components/resource-comments-preview"
import { ResourceMediaGallery } from "@/features/vault-workspace/components/resource-media-gallery"
import type { CommentItem } from "@/features/vault-workspace/components/vault-settings-sheet"
import type { Resource } from "@/features/vault-workspace/types"
import { cn } from "@/lib/utils"
import {
  getMetadataState,
  getResourceDescription,
  getResourceDisplayUrl,
  getResourceMedia,
  getResourcePillItems,
  getResourceTitle,
  type ResourcePillItem,
} from "./view-models"

export type ResourceDragData = {
  kind: "resource"
  resourceId: string
  sourceSpaceId: string
}

const RESOURCE_ICON_MAP = {
  baidu_pan: "baidu-pan.svg",
  ed2k: "emule.svg",
  magnet: "magnet.svg",
  quark_pan: "quark-pan.svg",
  thunder: "thunder.svg",
  twitter: "x.com.svg",
} as const

export function ResourceCard({
  comments,
  commentBody,
  disabled,
  index,
  isActive,
  isSignedIn,
  isVaultOwner,
  onCommentBodyChange,
  onDelete,
  onFocusComments,
  onRequireSignIn,
  onSelect,
  onSubmitComment,
  resource,
  spaceId,
}: {
  comments: CommentItem[]
  commentBody: string
  disabled: boolean
  index: number
  isActive: boolean
  isSignedIn: boolean
  isVaultOwner: boolean
  onCommentBodyChange: (value: string) => void
  onDelete: () => void
  onFocusComments: () => void
  onRequireSignIn: () => void
  onSelect: () => void
  onSubmitComment: () => void
  resource: Resource
  spaceId: string
}) {
  const { handleRef, ref } = useSortable<ResourceDragData>({
    id: `resource:${resource.id}`,
    index,
    group: spaceId,
    type: "resource",
    accept: (draggable) => {
      const data = draggable.data as ResourceDragData | undefined
      return data?.kind === "resource"
    },
    data: {
      kind: "resource",
      resourceId: resource.id,
      sourceSpaceId: spaceId,
    },
    disabled: disabled || !isVaultOwner,
  })
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const [externalOpen, setExternalOpen] = useState(false)
  const title = getResourceTitle(resource)
  const description = getResourceDescription(resource)
  const displayUrl = getResourceDisplayUrl(resource)
  const media = getResourceMedia(resource)
  const pills = getResourcePillItems(resource)
  const metadataState = getMetadataState(resource.metadataStatus)
  const iconName = getResourceIconName(resource)
  const showComments = comments.length > 0 || (isActive && commentsOpen)
  const showComposer = isActive && commentsOpen
  const copyDisplayUrl = () => {
    void navigator.clipboard?.writeText(displayUrl)
  }
  const copyPillValue = (value: string) => {
    void navigator.clipboard?.writeText(value)
  }

  return (
    <article
      className={cn(
        "group/resource-card flex min-w-0 flex-col gap-1 rounded-card border border-line bg-ink-800 px-3.5 py-3 transition hover:border-ink-700 hover:bg-ink-750",
        isActive && "border-jade-dim bg-ink-750 shadow-[0_0_0_1px_var(--jade-dim)]"
      )}
      ref={ref}
    >
      <div className="flex min-w-0 items-center gap-2">
        {isVaultOwner ? (
          <button
            className="relative grid size-[30px] shrink-0 cursor-grab place-items-center overflow-hidden rounded-input border border-line bg-ink-700 transition hover:border-ink-600 hover:bg-ink-750 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            ref={handleRef}
            type="button"
          >
            <ResourceIcon
              className="transition group-hover/resource-card:opacity-0"
              iconName={iconName}
            />
            <GripVertical className="absolute size-4 text-fg-faint opacity-0 transition group-hover/resource-card:opacity-100" />
            <span className="sr-only">拖动排序资源</span>
          </button>
        ) : (
          <span className="relative grid size-[30px] shrink-0 place-items-center overflow-hidden rounded-input border border-line bg-ink-700">
            <ResourceIcon iconName={iconName} />
          </span>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="min-w-0 flex-1 truncate text-left text-[14.5px] font-semibold text-fg hover:text-jade-bright"
                onClick={onSelect}
                type="button"
              >
                {title}
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[360px] break-words" side="top" sideOffset={6}>
              {title}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span
          className={cn("meta-state shrink-0", metadataState.className)}
          title={metadataState.label}
        >
          <span className="dot" />
          <span className="sr-only">{metadataState.label}</span>
        </span>
        <div className="mono flex shrink-0 items-center gap-1.5 text-[10px] text-fg-dim">
          <span className="inline-flex items-center gap-0.5 [&_svg]:size-3">
            <Star />
            0
          </span>
          <Button
            className={cn(
              "h-5 gap-0.5 rounded-sm px-1 text-[10px] text-fg-dim [&_svg]:size-3",
              showComposer && "bg-ink-700 text-jade"
            )}
            size="xs"
            variant="ghost"
            onClick={() => {
              if (!isSignedIn) {
                onRequireSignIn()
                return
              }
              onFocusComments()
              setCommentsOpen((value) => (isActive ? !value : true))
            }}
            type="button"
          >
            <MessageSquare />
            <span>{comments.length}</span>
            <span className="sr-only">展开评论</span>
          </Button>
          {isVaultOwner && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="size-5 rounded-sm text-fg-dim hover:text-rose [&_svg]:size-3"
                  size="icon-xs"
                  variant="ghost"
                  disabled={disabled}
                  type="button"
                >
                  <Trash2 />
                  <span className="sr-only">删除资源</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>删除这个 resource?</AlertDialogTitle>
                  <AlertDialogDescription>
                    此操作会归档该资源，并从当前列表中移除。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={onDelete}>
                    删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {pills.map((pill) => (
            <ResourceMetadataPill
              key={pill.key}
              onCopy={copyPillValue}
              pill={pill}
            />
          ))}
          <span className="mono min-w-0 max-w-full truncate rounded-input border border-line bg-ink-900 px-2 py-1 text-[10.5px] text-fg-muted md:max-w-[520px]">
            {displayUrl}
          </span>
          <button className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-fg-dim transition hover:bg-ink-700 hover:text-jade [&_svg]:size-3" onClick={copyDisplayUrl} type="button">
            <Copy />
            <span className="sr-only">复制链接</span>
          </button>
          {isHttpResource(resource) && (
            <AlertDialog open={externalOpen} onOpenChange={setExternalOpen}>
              <AlertDialogTrigger asChild>
                <button
                  className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-fg-dim transition hover:bg-ink-700 hover:text-jade [&_svg]:size-3"
                  type="button"
                >
                  <ExternalLink />
                  <span className="sr-only">打开源链接</span>
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>即将打开外部链接</AlertDialogTitle>
                  <AlertDialogDescription>
                    你将离开 NexusVault 并访问第三方站点。请确认链接来源可信后再继续。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="mono max-w-full truncate rounded-input border border-line bg-ink-900 px-2.5 py-2 text-[11px] text-fg-dim">
                  {displayUrl}
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      window.open(displayUrl, "_blank", "noopener,noreferrer")
                    }}
                  >
                    继续打开
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {description && (
        <div
          className={cn(
            "mt-1 min-w-0 cursor-pointer rounded-input border border-transparent px-2 py-1 text-left outline-none transition hover:border-line hover:bg-ink-850 focus-visible:border-jade-dim focus-visible:shadow-[0_0_0_3px_var(--jade-glow)]",
            descriptionOpen && "border-line bg-ink-850"
          )}
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a")) return
            setDescriptionOpen((value) => !value)
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            setDescriptionOpen((value) => !value)
          }}
          role="button"
          tabIndex={0}
        >
          <MarkdownContent
            className={cn(
              "min-w-0 text-fg-muted",
              descriptionOpen && "gap-1.5"
            )}
            singleLine={!descriptionOpen}
            value={description}
          />
        </div>
      )}

      <ResourceMediaGallery media={media} title={title} />

      {showComments && (
        <ResourceCommentsPreview
          body={commentBody}
          comments={isActive ? comments : []}
          disabled={disabled || !isSignedIn}
          onBodyChange={onCommentBodyChange}
          onSubmit={onSubmitComment}
          showComposer={showComposer}
        />
      )}
    </article>
  )
}

function ResourceMetadataPill({
  onCopy,
  pill,
}: {
  onCopy: (value: string) => void
  pill: ResourcePillItem
}) {
  if (pill.kind === "status") {
    return (
      <Pill className={metadataPillClassName} title={pill.title} variant="outline">
        <PillStatus className="border-r-0 pr-0">
          <PillIndicator variant={getPillIndicatorVariant(pill.status)} />
          <span>{pill.label}</span>
        </PillStatus>
      </Pill>
    )
  }

  if (pill.kind === "copy") {
    return (
      <Pill className={metadataPillClassName} variant="outline">
        <span>{pill.label}</span>
        <span className="text-fg-muted">{pill.value}</span>
        <button
          aria-label={pill.ariaLabel}
          className="-mr-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-[3px] text-fg-dim transition hover:bg-ink-700 hover:text-jade [&_svg]:size-2"
          onClick={() => onCopy(pill.value)}
          type="button"
        >
          <Copy />
        </button>
      </Pill>
    )
  }

  return (
    <Pill className={metadataPillClassName} variant="outline">
      {pill.label}
    </Pill>
  )
}

const metadataPillClassName =
  "mono h-5 gap-1 rounded-chip border-line bg-ink-900 px-1.5 py-0 text-[10px] font-normal text-fg-dim shadow-none [&_[data-slot=button]]:text-fg-dim"

function getPillIndicatorVariant(status: Extract<ResourcePillItem, { kind: "status" }>["status"]) {
  if (status === "online") return "success"
  if (status === "offline") return "error"
  if (status === "degraded") return "warning"
  return "info"
}

function ResourceIcon({
  className,
  iconName,
}: {
  className?: string
  iconName?: ResourceIconName
}) {
  if (!iconName) {
    return <span className={cn("mono text-[10px] font-semibold text-fg-dim", className)}>LINK</span>
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      aria-hidden="true"
      className={cn("size-[18px] object-contain", className)}
      src={`/icons/${iconName}`}
    />
  )
}

type ResourceIconName = (typeof RESOURCE_ICON_MAP)[keyof typeof RESOURCE_ICON_MAP]

function getResourceIconName(resource: Resource): ResourceIconName | undefined {
  if (resource.type === "magnet") return RESOURCE_ICON_MAP.magnet
  if (resource.type === "twitter") return RESOURCE_ICON_MAP.twitter
  if (resource.type === "baidu_pan") return RESOURCE_ICON_MAP.baidu_pan
  if (resource.type === "quark_pan") return RESOURCE_ICON_MAP.quark_pan

  const protocol = getResourceProtocol(resource.url)
  if (protocol === "ed2k") return RESOURCE_ICON_MAP.ed2k
  if (protocol === "thunder") return RESOURCE_ICON_MAP.thunder

  return undefined
}

function isHttpResource(resource: Resource) {
  return resource.url.trim().toLowerCase().startsWith("http://") ||
    resource.url.trim().toLowerCase().startsWith("https://")
}

function getResourceProtocol(url: string) {
  const value = url.trim().toLowerCase()
  if (value.startsWith("ed2k://")) return "ed2k"
  if (value.startsWith("thunder://")) return "thunder"
  return undefined
}

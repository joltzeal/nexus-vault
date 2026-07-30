"use client"

import { useSortable } from "@dnd-kit/react/sortable"
import {
  Copy,
  Clock3,
  Edit3,
  ExternalLink,
  FolderInput,
  GripVertical,
  Heart,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "@/lib/toast"

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
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Rating,
  RatingButton,
} from "@/components/kibo-ui/rating"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Pill,
  PillIndicator,
  PillStatus,
} from "@/components/kibo-ui/pill"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  TreeExpander,
  TreeIcon,
  TreeLabel,
  TreeNode,
  TreeNodeContent,
  TreeNodeTrigger,
  TreeProvider,
  TreeView,
} from "@/components/kibo-ui/tree"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ButtonGroup } from "@/components/ui/button-group"
import { ResourceCardMediaCarousel } from "@/features/components/resource-card-media-carousel"
import { MarkdownContent } from "@/features/components/markdown-content"
import { ResourceMediaGallery } from "@/features/components/resource-media-gallery"
import { SpaceIcon } from "@/features/components/space-icon-picker"
import type { VaultResourceViewMode } from "@/features/components/vault-view-mode"
import type {
  Resource,
  ResourceAnnotationPatch,
  ResourceTransferTargetVault,
} from "@/features/types"
import { cn } from "@/lib/utils"
import {
  getMetadataState,
  getResourceFaviconUrl,
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
  className,
  disabled,
  index,
  canDeleteResource = false,
  canEditResource,
  isActive,
  isSelected = false,
  isSignedIn,
  isVaultOwner,
  mediaVisible,
  onActivate,
  onCreateTransferTargetSpace,
  onDelete,
  onClearAnnotation,
  onLoadTransferTargets,
  onOpenDetails,
  onResolveMetadata,
  onToggleReadLater,
  onToggleSelected,
  onToggleStar,
  onTransferResource,
  onUpdateAnnotation,
  resource,
  showAnnotationActions = true,
  showReadLaterAction = true,
  showSelectionControl = false,
  showStarAction = true,
  spaceId,
  transferFocusSpaceId,
  transferTargets,
  viewMode = "list",
}: {
  className?: string
  disabled: boolean
  index: number
  canDeleteResource?: boolean
  canEditResource: boolean
  isActive: boolean
  isSelected?: boolean
  isSignedIn: boolean
  isVaultOwner: boolean
  mediaVisible: boolean
  onActivate: () => void
  onCreateTransferTargetSpace: (vaultId: string) => void
  onDelete: () => void
  onClearAnnotation?: (resourceId: string) => void
  onLoadTransferTargets: () => Promise<void>
  onOpenDetails: () => void
  onResolveMetadata?: () => void
  onToggleReadLater?: (resourceId: string) => void
  onToggleSelected?: (selected: boolean) => void
  onToggleStar: () => void
  onTransferResource: (input: {
    action: "move" | "copy"
    resourceId: string
    targetVaultId: string
    targetSpaceId: string
  }) => Promise<void>
  onUpdateAnnotation?: (resourceId: string, patch: ResourceAnnotationPatch) => void
  resource: Resource
  showAnnotationActions?: boolean
  showReadLaterAction?: boolean
  showSelectionControl?: boolean
  showStarAction?: boolean
  spaceId: string
  transferFocusSpaceId?: string
  transferTargets: ResourceTransferTargetVault[]
  vaultId: string
  vaultName?: string
  spaceName?: string
  viewMode?: VaultResourceViewMode
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
    disabled: disabled || !isVaultOwner || showSelectionControl,
  })
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const [externalOpen, setExternalOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const title = getResourceTitle(resource)
  const description = getResourceDescription(resource)
  const descriptionStartsWithImage = startsWithMarkdownImage(description)
  const collapsedDescriptionText = getCollapsedDescriptionText(description)
  const displayUrl = getResourceDisplayUrl(resource)
  const media = getResourceMedia(resource)
  const pills = getResourcePillItems(resource)
  const metadataState = getMetadataState(resource.metadataStatus)
  const hasMetadataState = resource.metadataStatus !== "completed"
  const isResolvingMetadata =
    resource.metadataStatus === "pending" || resource.metadataStatus === "processing"
  const isMasonryView = viewMode === "masonry"
  const iconName = getResourceIconName(resource)
  const iconSrc = getResourceFaviconUrl(resource)
  const iconLabel = resource.type === "http" ? "WEB" : resource.type === "ftp" ? "FTP" : "LINK"
  const annotation = resource.annotation ?? null
  const checked = annotation?.checked === true
  const rating = annotation?.rating ?? 0
  const isWatchedLater = resource.isReadLater === true
  const [localCommentDraft, setLocalCommentDraft] = useState(
    annotation?.comment ?? ""
  )
  const copyDisplayUrl = async () => {
    await navigator.clipboard?.writeText(displayUrl)
    toast.success("链接已复制")
  }
  const copyDescription = async () => {
    await navigator.clipboard?.writeText(description)
    toast.success("描述已复制")
  }
  const copyPillValue = (value: string) => {
    void navigator.clipboard?.writeText(value)
  }

  useEffect(() => {
    setLocalCommentDraft(annotation?.comment ?? "")
  }, [annotation?.comment])

  function handleToggleWatchLater() {
    if (!isSignedIn) {
      toast.info("请先登录后再加入稍后查看。")
      return
    }
    onToggleReadLater?.(resource.id)
  }

  function handleUpdateAnnotation(patch: ResourceAnnotationPatch) {
    if (!isSignedIn) {
      toast.info("请先登录后再编辑资源批注。")
      return
    }
    onUpdateAnnotation?.(resource.id, patch)
  }

  function handleClearAnnotation() {
    if (!isSignedIn) {
      toast.info("请先登录后再编辑资源批注。")
      return
    }
    setLocalCommentDraft("")
    onClearAnnotation?.(resource.id)
  }

  function renderAnnotationActions(className?: string) {
    if (showSelectionControl) return null

    return (
      <ButtonGroup className={cn("mono h-6 items-center rounded-md border border-line-soft bg-ink-850/55 px-1 text-[10px] text-fg-dim", className)}>
        {showAnnotationActions && rating > 0 && (
          <ResourceLocalRating
            ariaLabel={`资源评分 ${rating}/5`}
            readOnly
            size={12}
            value={rating}
          />
        )}
        {showAnnotationActions && (
          <LocalAnnotationPopover
            commentDraft={localCommentDraft}
            onClear={handleClearAnnotation}
            onCommentDraftChange={setLocalCommentDraft}
            onCommentSave={() =>
              handleUpdateAnnotation({ comment: localCommentDraft })
            }
            onRatingChange={(value) =>
              handleUpdateAnnotation({ rating: value > 0 ? value : null })
            }
            rating={rating}
          />
        )}
        {showReadLaterAction && (
          <Button
            className={cn(
              "size-5 rounded-sm border border-transparent p-0 text-fg-dim hover:text-jade [&_svg]:size-3",
              isWatchedLater && "border-jade-dim bg-[var(--jade-glow)] text-jade"
            )}
            size="icon-xs"
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation()
              handleToggleWatchLater()
            }}
            type="button"
          >
            <Clock3 />
            <span className="sr-only">
              {isWatchedLater ? "移出稍后查看" : "稍后查看"}
            </span>
          </Button>
        )}
        {showStarAction && (
          <Button
            className={cn(
              "size-5 rounded-sm p-0 text-fg-dim hover:text-jade [&_svg]:size-3",
              resource.isStarred && "text-jade"
            )}
            disabled={!isSignedIn}
            size="icon-xs"
            variant="ghost"
            onClick={onToggleStar}
            type="button"
          >
            <Star className={cn(resource.isStarred && "fill-current")} />
            <span className="sr-only">{resource.isStarred ? "取消收藏资源" : "收藏资源"}</span>
          </Button>
        )}
      </ButtonGroup>
    )
  }

  function renderCheckedAction() {
    if (!showAnnotationActions || showSelectionControl) return null

    return (
      <Checkbox
        aria-label={checked ? "标记为未处理" : "标记为已处理"}
        checked={checked}
        className="size-5 rounded-[5px] border border-line-soft bg-ink-950 text-jade shadow-inner hover:border-jade-dim focus-visible:border-jade-dim focus-visible:ring-2 focus-visible:ring-jade/20 data-checked:border-jade-dim data-checked:bg-[var(--jade-glow)] data-checked:text-jade [&_[data-slot=checkbox-indicator]>svg]:size-3.5"
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={(value) =>
          handleUpdateAnnotation({ checked: value === true })
        }
      />
    )
  }

  function renderResourceActions(className?: string) {
    if (
      showSelectionControl ||
      (!canDeleteResource && !canEditResource && !isVaultOwner)
    ) {
      return null
    }

    return (
      <ButtonGroup className={cn("h-6 items-center rounded-md border border-line-soft bg-ink-850/70 px-1", className)}>
        {canDeleteResource && (
          <Button
            className="size-5 rounded-sm text-fg-dim hover:text-jade [&_svg]:size-3"
            disabled={disabled || isResolvingMetadata}
            onClick={(event) => {
              event.stopPropagation()
              onResolveMetadata?.()
            }}
            size="icon-xs"
            title="重新获取 metadata"
            type="button"
            variant="ghost"
          >
            <RefreshCw className={cn(isResolvingMetadata && "animate-spin")} />
            <span className="sr-only">重新获取 metadata</span>
          </Button>
        )}
        {canDeleteResource && (
          <AlertDialog>
            <AlertDialogTrigger
              render={
              <Button
                className="size-5 rounded-sm text-fg-dim hover:text-rose [&_svg]:size-3"
                size="icon-xs"
                variant="ghost"
                type="button"
              >
                <Trash2 />
                <span className="sr-only">删除资源</span>
              </Button>
              }
            />
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
        {isVaultOwner && (
          <ResourceTransferDialog
            disabled={disabled}
            onLoadTargets={onLoadTransferTargets}
            onOpenChange={setTransferOpen}
            onCreateSpace={onCreateTransferTargetSpace}
            onTransfer={async (input) => {
              setTransferOpen(false)
              await onTransferResource({
                ...input,
                resourceId: resource.id,
              })
            }}
            open={transferOpen}
            focusedSpaceId={transferFocusSpaceId}
            resourceTitle={title}
            sourceSpaceId={resource.spaceId}
            targets={transferTargets}
          />
        )}
      </ButtonGroup>
    )
  }

  function renderLeadingControl(className?: string) {
    if (showSelectionControl) {
      return (
        <Checkbox
          aria-label={isSelected ? "取消选择 resource" : "选择 resource"}
          checked={isSelected}
          className={cn(
            "size-7 rounded-input border border-line-soft bg-ink-900 text-jade shadow-inner transition hover:border-jade-dim hover:bg-ink-850 focus-visible:border-jade-dim focus-visible:ring-2 focus-visible:ring-jade/20 data-checked:border-jade-dim data-checked:bg-ink-850 data-checked:text-jade [&_[data-slot=checkbox-indicator]>svg]:size-4",
            isSelected && "shadow-[0_0_0_3px_var(--jade-glow),inset_0_1px_0_rgba(255,255,255,.06)]",
            className
          )}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={(value) => onToggleSelected?.(value === true)}
        />
      )
    }

    if (isVaultOwner) {
      return (
        <button
          className={cn(
            "relative grid size-[30px] shrink-0 cursor-grab place-items-center overflow-hidden rounded-input border border-line bg-ink-700 transition hover:border-ink-600 hover:bg-ink-750 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-60",
            className
          )}
          disabled={disabled}
          ref={handleRef}
          type="button"
        >
          <ResourceIcon
            className="transition group-hover/resource-card:opacity-0"
            iconName={iconName}
            iconSrc={iconSrc}
            label={iconLabel}
          />
          <GripVertical className="absolute size-4 text-fg-faint opacity-0 transition group-hover/resource-card:opacity-100" />
          <span className="sr-only">拖动排序资源</span>
        </button>
      )
    }

    return (
      <span
        className={cn(
          "relative grid size-[30px] shrink-0 place-items-center overflow-hidden rounded-input border border-line bg-ink-700",
          className
        )}
      >
        <ResourceIcon iconName={iconName} iconSrc={iconSrc} label={iconLabel} />
      </span>
    )
  }

  function renderExternalLinkAction(className?: string) {
    return (
      <AlertDialog open={externalOpen} onOpenChange={setExternalOpen}>
        <AlertDialogTrigger
          render={
          <button
            className={cn(
              "inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-fg-dim transition hover:bg-ink-700 hover:text-jade [&_svg]:size-3",
              className
            )}
            onClick={(event) => event.stopPropagation()}
            type="button"
          >
            <ExternalLink />
            <span className="sr-only">打开源链接</span>
          </button>
          }
        />
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
                setExternalOpen(false)
                window.open(displayUrl, "_blank", "noopener,noreferrer")
              }}
            >
              继续打开
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <article
      className={cn(
        "group/resource-card flex min-w-0 flex-col gap-1 rounded-card border border-line bg-ink-800 px-3.5 py-3 transition hover:border-ink-700 hover:bg-ink-750",
        isResolvingMetadata && "border-line bg-ink-800/80",
        isActive && "border-jade hover:border-jade",
        className
      )}
      id={`resource-${resource.id}`}
      onClick={() => {
        if (showSelectionControl) {
          onToggleSelected?.(!isSelected)
          return
        }
        onActivate()
      }}
      ref={ref}
    >
      {isMasonryView ? (
        <div className={cn("relative min-w-0", hasMetadataState && "pr-14")}>
          <div className="absolute left-0 top-0">
            {renderLeadingControl("size-5 rounded-[5px] [&_img]:size-3.5 [&_span.mono]:text-[8px]")}
          </div>
          <TooltipProvider>
            <Tooltip>
              {canEditResource && !showSelectionControl ? (
                <TooltipTrigger
                  render={
                  <button
                    className="block min-w-0 w-full whitespace-normal break-words text-left text-sm font-semibold leading-[22px] text-fg [text-indent:28px] hover:text-jade-bright"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenDetails()
                    }}
                    type="button"
                  >
                    {title}
                  </button>
                  }
                />
              ) : (
                <TooltipTrigger
                  render={
                  <span className="block min-w-0 w-full whitespace-normal break-words text-left text-sm font-semibold leading-[22px] text-fg [text-indent:28px]">
                    {title}
                  </span>
                  }
                />
              )}
              <TooltipContent className="max-w-[360px] break-words" side="top" sideOffset={6}>
                {title}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <ResourceMetadataState
            className="absolute right-0 top-0"
            label={metadataState.label}
            status={resource.metadataStatus}
          />
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          {renderLeadingControl()}
          <TooltipProvider>
            <Tooltip>
              {canEditResource && !showSelectionControl ? (
                <TooltipTrigger
                  render={
                  <button
                    className="min-w-0 flex-1 truncate text-left text-[14.5px] font-semibold text-fg hover:text-jade-bright"
                    onClick={(event) => {
                      event.stopPropagation()
                      onOpenDetails()
                    }}
                    type="button"
                  >
                    {title}
                  </button>
                  }
                />
              ) : (
                <TooltipTrigger
                  render={
                  <span className="min-w-0 flex-1 truncate text-left text-[14.5px] font-semibold text-fg">
                    {title}
                  </span>
                  }
                />
              )}
              <TooltipContent className="max-w-[360px] break-words" side="top" sideOffset={6}>
                {title}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <ResourceMetadataState
            className="shrink-0"
            label={metadataState.label}
            status={resource.metadataStatus}
          />
          {!showSelectionControl && (
            <div className="flex shrink-0 items-center gap-2">
              {renderAnnotationActions()}
              {renderCheckedAction()}
            </div>
          )}
        </div>
      )}

      {isMasonryView && !showSelectionControl && (
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
          {renderAnnotationActions("shrink-0")}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {renderCheckedAction()}
            {renderResourceActions("shrink-0")}
          </div>
        </div>
      )}

      {isMasonryView ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          {pills.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {pills.map((pill) => (
                <ResourceMetadataPill
                  key={pill.key}
                  onCopy={copyPillValue}
                  pill={pill}
                />
              ))}
            </div>
          )}
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              className="mono min-w-0 flex-1 truncate rounded-input border border-line bg-ink-900 px-2 py-1 text-left text-[10.5px] text-fg-muted transition hover:text-jade hover:underline"
              onClick={() => void copyDisplayUrl()}
              title="点击复制链接"
              type="button"
            >
              {displayUrl}
            </button>
            {renderExternalLinkAction("size-6 rounded-input border border-line-soft bg-ink-850 hover:border-jade-dim hover:bg-ink-800")}
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {pills.map((pill) => (
              <ResourceMetadataPill
                key={pill.key}
                onCopy={copyPillValue}
                pill={pill}
              />
            ))}
            <button
              className="mono min-w-0 max-w-full truncate rounded-input border border-line bg-ink-900 px-2 py-1 text-left text-[10.5px] text-fg-muted transition hover:text-jade hover:underline md:max-w-[520px]"
              onClick={() => void copyDisplayUrl()}
              title="点击复制链接"
              type="button"
            >
              {displayUrl}
            </button>
            {renderExternalLinkAction()}
            {renderResourceActions("ml-auto hidden group-hover/resource-card:inline-flex focus-within:inline-flex")}
          </div>
        </div>
      )}

      {description && (
        <div
          className={cn(
            "mt-1 min-w-0 cursor-pointer rounded-input border border-line-soft bg-ink-850/45 px-2 py-1 text-left outline-none transition hover:border-line hover:bg-ink-850 focus-visible:border-jade-dim focus-visible:shadow-[0_0_0_3px_var(--jade-glow)]",
            descriptionOpen && "border-line bg-ink-850"
          )}
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("a,button")) return
            setDescriptionOpen((value) => !value)
          }}
          onKeyDown={(event) => {
            if (event.target instanceof Element && event.target.closest("button")) return
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            setDescriptionOpen((value) => !value)
          }}
          role="button"
          tabIndex={0}
        >
          {!descriptionOpen ? (
            <span className="block truncate text-xs leading-5 text-fg-dim">
              {descriptionStartsWithImage || !collapsedDescriptionText
                ? "展开描述"
                : collapsedDescriptionText}
            </span>
          ) : (
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex justify-end">
                <Button
                  className="h-6 rounded-sm px-1.5 text-[11px] text-fg-dim hover:text-jade [&_svg]:size-3"
                  onClick={(event) => {
                    event.stopPropagation()
                    void copyDescription()
                  }}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  <Copy data-icon="inline-start" />
                  复制
                </Button>
              </div>
              <MarkdownContent
                className="min-w-0 gap-1.5 text-fg-muted"
                value={description}
              />
            </div>
          )}
        </div>
      )}

      {isResolvingMetadata && (
        <div className="mt-1 overflow-hidden rounded-input border border-line-soft bg-ink-850/45">
          <div className="h-0.5 w-full animate-[nv-progress_1.8s_ease-in-out_infinite] bg-linear-to-r from-transparent via-jade-dim to-transparent" />
        </div>
      )}

      {mediaVisible && !isResolvingMetadata && (
        isMasonryView ? (
          <ResourceCardMediaCarousel media={media} title={title} />
        ) : (
          <ResourceMediaGallery media={media} title={title} />
        )
      )}

      {showAnnotationActions && annotation?.comment && (
        <div
          className="mt-1 min-w-0 rounded-input border border-line-soft bg-ink-850/35 px-2 py-1 text-xs leading-5 text-fg-muted"
          onClick={(event) => event.stopPropagation()}
        >
          <span className="mono mr-2 text-[10px] uppercase tracking-[.12em] text-fg-faint">
            COMMENT
          </span>
          {annotation.comment}
        </div>
      )}
    </article>
  )
}

function startsWithMarkdownImage(value: string) {
  const firstLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) return false

  return /^!\[[^\]]*]\([^)]+\)/.test(firstLine) || /^<img\b/i.test(firstLine)
}

function getCollapsedDescriptionText(value: string) {
  const firstLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) return ""

  return firstLine
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s?/, "")
    .replace(/^[-*+]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_~]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function ResourceLocalRating({
  ariaLabel,
  className,
  onValueChange,
  readOnly = false,
  size,
  value,
}: {
  ariaLabel: string
  className?: string
  onValueChange?: (value: number) => void
  readOnly?: boolean
  size: number
  value: number
}) {
  return (
    <div aria-label={ariaLabel} onClick={(event) => event.stopPropagation()}>
      <Rating
        className={cn(
          "h-5 items-center gap-0 text-rose",
          !readOnly && "h-8 gap-0.5",
          className
        )}
        onValueChange={(nextValue) =>
          onValueChange?.(nextValue === value ? 0 : nextValue)
        }
        readOnly={readOnly}
        value={value}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <RatingButton
            className={cn(
              "inline-flex items-center justify-center p-0 text-rose focus-visible:ring-jade/35 focus-visible:ring-offset-0",
              readOnly
                ? "size-4 cursor-default rounded-sm"
                : "size-8 rounded-md hover:bg-ink-800"
            )}
            icon={<Heart />}
            key={index}
            size={size}
          />
        ))}
      </Rating>
    </div>
  )
}

function LocalAnnotationPopover({
  commentDraft,
  onClear,
  onCommentDraftChange,
  onCommentSave,
  onRatingChange,
  rating,
}: {
  commentDraft: string
  onClear: () => void
  onCommentDraftChange: (value: string) => void
  onCommentSave: () => void
  onRatingChange: (rating: number) => void
  rating: number
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
        <Button
          aria-label="编辑资源批注"
          className="size-5 rounded-sm text-fg-dim hover:text-primary [&_svg]:size-3"
          onClick={(event) => event.stopPropagation()}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Edit3 />
        </Button>
        }
      />
      <PopoverContent
        align="end"
        className="w-[280px] border-line bg-ink-850 p-3 text-fg"
        onClick={(event) => event.stopPropagation()}
      >
        <div>
          <div className="text-sm font-semibold">资源批注</div>
          <p className="mt-1 text-xs leading-5 text-fg-dim">
            给资源留一点判断和备注，之后回看会轻松很多。
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <div>
            <div className="mono mb-1.5 text-[10px] uppercase tracking-[.12em] text-fg-faint">
              Rating
            </div>
            <ResourceLocalRating
              ariaLabel="设置资源评分"
              onValueChange={onRatingChange}
              size={18}
              value={rating}
            />
          </div>
          <div>
            <div className="mono mb-1.5 text-[10px] uppercase tracking-[.12em] text-fg-faint">
              COMMENT
            </div>
            <textarea
              className="min-h-20 w-full resize-none rounded-input border border-line-soft bg-ink-900 px-2.5 py-2 text-xs leading-5 text-fg-muted outline-none placeholder:text-fg-faint focus:border-primary/50"
              onChange={(event) => onCommentDraftChange(event.target.value)}
              placeholder="写下你的判断、提醒或下次要看的重点。"
              value={commentDraft}
            />
          </div>
        </div>
        <div className="flex justify-between gap-2">
          <Button onClick={onClear} size="xs" type="button" variant="ghost">
            清空
          </Button>
          <Button onClick={onCommentSave} size="xs" type="button">
            保存
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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

function ResourceMetadataState({
  className,
  label,
  status,
}: {
  className?: string
  label: string
  status: Resource["metadataStatus"]
}) {
  if (status === "completed") return null

  const resolving = status === "pending" || status === "processing"

  return (
    <span
      className={cn(
        "mono inline-flex h-5 items-center gap-1 rounded-chip border px-1.5 text-[10px]",
        resolving && "border-sky/25 bg-sky/10 text-sky",
        status === "failed" && "border-rose/25 bg-rose/10 text-rose",
        className
      )}
      title={label}
    >
      {resolving ? (
        <LoaderCircle className="size-3 animate-spin" />
      ) : (
        <span className="size-1.5 rounded-full bg-current" />
      )}
      <span>{label}</span>
    </span>
  )
}

function normalizeTransferQuery(value: string) {
  return value.trim().toLocaleLowerCase()
}

function getFilteredTransferTargets(
  targets: ResourceTransferTargetVault[],
  query: string
) {
  if (!query) return targets

  return targets
    .map((target) => {
      const vaultMatches = normalizeTransferQuery(target.title).includes(query)
      const spaces = vaultMatches
        ? target.spaces
        : target.spaces.filter((space) =>
            normalizeTransferQuery(space.name).includes(query)
          )

      return {
        ...target,
        spaces,
      }
    })
    .filter(
      (target) =>
        normalizeTransferQuery(target.title).includes(query) ||
        target.spaces.length > 0
    )
}

export function ResourceTransferDialog({
  disabled,
  focusedSpaceId,
  onCreateSpace,
  onLoadTargets,
  onOpenChange,
  onTransfer,
  open,
  resourceTitle,
  showTriggerLabel = false,
  sourceSpaceId,
  targets,
  triggerClassName,
  triggerLabel = "移动或复制",
  triggerSize = "icon-xs",
}: {
  disabled: boolean
  focusedSpaceId?: string
  onCreateSpace: (vaultId: string) => void
  onLoadTargets: () => Promise<void>
  onOpenChange: (open: boolean) => void
  onTransfer: (input: {
    action: "move" | "copy"
    targetVaultId: string
    targetSpaceId: string
  }) => Promise<void>
  open: boolean
  resourceTitle: string
  showTriggerLabel?: boolean
  sourceSpaceId: string
  targets: ResourceTransferTargetVault[]
  triggerClassName?: string
  triggerLabel?: string
  triggerSize?: "xs" | "sm" | "icon-xs" | "icon-sm"
}) {
  const [busyKey, setBusyKey] = useState("")
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [query, setQuery] = useState("")
  const normalizedQuery = normalizeTransferQuery(query)
  const filteredTargets = getFilteredTransferTargets(targets, normalizedQuery)
  const treeKey = targets
    .map((target) => `${target.id}:${target.spaces.map((space) => space.id).join(",")}`)
    .join("|")

  useEffect(() => {
    if (!open || !focusedSpaceId) return

    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-transfer-space-id="${CSS.escape(focusedSpaceId)}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    })
  }, [focusedSpaceId, open, targets])

  async function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setQuery("")
      return
    }
    if (!nextOpen || targets.length > 0) return

    setLoadingTargets(true)
    try {
      await onLoadTargets()
    } finally {
      setLoadingTargets(false)
    }
  }

  async function handleTransfer(input: {
    action: "move" | "copy"
    targetVaultId: string
    targetSpaceId: string
  }) {
    if (input.targetSpaceId === sourceSpaceId) {
      setQuery("")
      onOpenChange(false)
      toast.info("目标就是当前 Space，无需操作。")
      return
    }

    const key = `${input.action}:${input.targetSpaceId}`
    setBusyKey(key)
    try {
      setQuery("")
      onOpenChange(false)
      await onTransfer(input)
    } finally {
      setBusyKey("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => void handleOpenChange(value)}>
      <Button
        className={cn(
          !showTriggerLabel && "size-5 rounded-sm text-fg-dim hover:text-jade [&_svg]:size-3",
          triggerClassName
        )}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          void handleOpenChange(true)
        }}
        size={triggerSize}
        type="button"
        variant="ghost"
      >
        <FolderInput />
        {showTriggerLabel ? <span>{triggerLabel}</span> : <span className="sr-only">{triggerLabel}</span>}
      </Button>
      <DialogContent className="max-h-[min(680px,calc(100dvh-2rem))] overflow-hidden border-line bg-ink-850 p-0 gap-0 text-fg sm:max-w-[520px]">
        <DialogHeader className="min-w-0 border-b border-line px-4 py-3">
          <DialogTitle className="font-display">移动或复制</DialogTitle>
          <DialogDescription className="block min-w-0 max-w-full truncate text-fg-dim">
            {resourceTitle}
          </DialogDescription>
        </DialogHeader>
        <div className="border-b border-line-soft p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-dim" />
            <Input
              autoComplete="off"
              className="h-8 border-line-soft bg-ink-900 pl-8 text-sm text-fg placeholder:text-fg-dim focus-visible:border-jade-dim focus-visible:ring-2 focus-visible:ring-jade/20"
              disabled={loadingTargets || targets.length === 0}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="筛选 Vault 或 Space"
              value={query}
            />
          </div>
        </div>
        <ScrollArea className="max-h-[min(520px,calc(100dvh-12rem))]">
          <div className="p-2">
            {loadingTargets ? (
              <div className="flex min-h-32 items-center justify-center text-sm text-fg-dim">
                正在加载 Vault...
              </div>
            ) : filteredTargets.length > 0 ? (
              <TreeProvider
                defaultExpandedIds={filteredTargets.map((target) => target.id)}
                key={`${treeKey}:${focusedSpaceId ?? ""}:${normalizedQuery}`}
                selectable={false}
                showLines={false}
              >
                <TreeView className="p-0">
                  {filteredTargets.map((vault, vaultIndex) => (
                    <TreeNode
                      isLast={vaultIndex === filteredTargets.length - 1}
                      key={vault.id}
                      nodeId={vault.id}
                    >
                      <TreeNodeTrigger className="min-w-0 rounded-input px-2 py-2 hover:bg-ink-800">
                        <TreeExpander hasChildren={vault.spaces.length > 0} />
                        <TreeLabel className="min-w-0 text-sm font-semibold text-fg">
                          {vault.title}
                        </TreeLabel>
                        <span className="mono shrink-0 text-[10px] text-fg-dim">
                          {vault.spaces.length}
                        </span>
                        <Button
                          className="ml-1 size-6 shrink-0 opacity-0 transition group-hover:opacity-100 [&_svg]:size-3.5"
                          onClick={(event) => {
                            event.stopPropagation()
                            onCreateSpace(vault.id)
                          }}
                          size="icon-xs"
                          type="button"
                          variant="ghost"
                        >
                          <Plus />
                          <span className="sr-only">在此 Vault 创建 Space</span>
                        </Button>
                      </TreeNodeTrigger>
                      <TreeNodeContent hasChildren={vault.spaces.length > 0}>
                        {vault.spaces.map((space, spaceIndex) => {
                          const moveKey = `move:${space.id}`
                          const copyKey = `copy:${space.id}`

                          return (
                            <TreeNode
                              isLast={spaceIndex === vault.spaces.length - 1}
                              key={space.id}
                              level={1}
                              nodeId={space.id}
                            >
                              <TreeNodeTrigger
                                className={cn(
                                  "group/transfer-space min-w-0 rounded-input px-2 py-1.5 hover:bg-ink-800",
                                  focusedSpaceId === space.id &&
                                    "border border-jade/70 bg-jade/10"
                                )}
                                data-transfer-space-id={space.id}
                              >
                                <TreeExpander />
                                <TreeIcon
                                  className="mr-2 text-jade [&_svg]:size-4"
                                  icon={<SpaceIcon name={space.icon} />}
                                />
                                <TreeLabel className="min-w-0 text-sm text-fg-muted">
                                  {space.name}
                                </TreeLabel>
                                <div className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition group-hover/transfer-space:opacity-100">
                                  <Button
                                    disabled={Boolean(busyKey)}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void handleTransfer({
                                        action: "move",
                                        targetVaultId: vault.id,
                                        targetSpaceId: space.id,
                                      })
                                    }}
                                    size="xs"
                                    type="button"
                                    variant="ghost"
                                  >
                                    {busyKey === moveKey ? "移动中" : "移动"}
                                  </Button>
                                  <Button
                                    disabled={Boolean(busyKey)}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void handleTransfer({
                                        action: "copy",
                                        targetVaultId: vault.id,
                                        targetSpaceId: space.id,
                                      })
                                    }}
                                    size="xs"
                                    type="button"
                                    variant="ghost"
                                  >
                                    {busyKey === copyKey ? "复制中" : "复制"}
                                  </Button>
                                </div>
                              </TreeNodeTrigger>
                            </TreeNode>
                          )
                        })}
                      </TreeNodeContent>
                    </TreeNode>
                  ))}
                </TreeView>
              </TreeProvider>
            ) : (
              <div className="flex min-h-32 items-center justify-center rounded-input border border-dashed border-line text-sm text-fg-dim">
                {normalizedQuery ? "没有匹配的目标 Space" : "还没有可用的目标 Space"}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
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
  iconSrc,
  label = "LINK",
}: {
  className?: string
  iconName?: ResourceIconName
  iconSrc?: string
  label?: string
}) {
  const [failed, setFailed] = useState(false)

  if (iconSrc && !failed) {
    return (
      <img
        alt=""
        aria-hidden="true"
        className={cn("size-[18px] rounded-[3px] object-contain", className)}
        onError={() => setFailed(true)}
        src={iconSrc}
      />
    )
  }

  if (!iconName) {
    return <span className={cn("mono text-[10px] font-semibold text-fg-dim", className)}>{label}</span>
  }

  return (
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

function getResourceProtocol(url: string) {
  const value = url.trim().toLowerCase()
  if (value.startsWith("ed2k://")) return "ed2k"
  if (value.startsWith("ftp://")) return "ftp"
  if (value.startsWith("thunder://")) return "thunder"
  return undefined
}

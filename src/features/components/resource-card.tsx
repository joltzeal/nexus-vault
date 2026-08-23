"use client"

import { useSortable } from "@dnd-kit/react/sortable"
import { LOCAL_MEDIA_PROVIDER } from "@/domain/media-storage"
import { parseGitHubLink } from "@/domain/resources/input"
import {
  Copy,
  Clock3,
  Download,
  ExternalLink,
  FolderInput,
  FolderTree,
  GripVertical,
  HardDriveUpload,
  Heart,
  Link as LinkIcon,
  LoaderCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Rating,
  RatingButton,
} from "@/components/kibo-ui/rating"
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
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
import { ResourceDescription } from "@/features/components/resource-description"
import { ResourceFileTree } from "@/features/components/resource-file-tree"
import { ResourceMediaGallery } from "@/features/components/resource-media-gallery"
import {
  ResourceCardActions,
  ResourceCardCommentButton,
  ResourceCardCommentEditor,
} from "@/features/components/resource-cards/resource-card-actions"
import { ResourcePreviewCard } from "@/features/components/resource-cards/resource-preview-card"
import { toResourceCardPreview } from "@/features/components/resource-cards/view-models"
import { SpaceIcon } from "@/features/components/space-icon-picker"
import type { VaultResourceViewMode } from "@/features/components/vault-view-mode"
import type {
  Resource,
  ResourceAnnotationPatch,
  ResourceTransferTargetVault,
} from "@/features/types"
import { formatResourceType } from "@/features/formatters"
import { cn } from "@/lib/utils"
import {
  getMetadataState,
  getResourceAiSummary,
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
  github: "github.svg",
  magnet: "magnet.svg",
  quark_pan: "quark-pan.svg",
  telegram: "telegram.svg",
  thunder: "thunder.svg",
  twitter: "x.com.svg",
  douyin: "tiktok.svg",
  wechat_mp: "wechat.svg",
  local_media: "local_media",
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
  const [externalOpen, setExternalOpen] = useState(false)
  const [specialDeleteOpen, setSpecialDeleteOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [commentEditorOpen, setCommentEditorOpen] = useState(false)
  const [magnetTreeOpen, setMagnetTreeOpen] = useState(false)
  const magnetTreeCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const title = getResourceTitle(resource)
  const description = getResourceDescription(resource)
  const aiSummary = getResourceAiSummary(resource)
  const displayUrl = getResourceDisplayUrl(resource)
  const refererUrl = getHttpUrl(resource.referer)
  const isLocalMediaResource = resource.type === "local_media"
  const resourceLinkUrl = isLocalMediaResource ? (refererUrl ?? "") : displayUrl
  const media = getResourceMedia(resource)
  const downloadableMedia = getDownloadableResourceMedia(resource)
  const pills = getResourcePillItems(resource)
  const resourceTypeLabel = formatResourceType(resource.type)
  const detailPills = pills.filter(
    (pill) => !(pill.kind === "text" && pill.label === resourceTypeLabel)
  )
  const metadataState = getMetadataState(resource.metadataStatus)
  const isResolvingMetadata =
    resource.metadataStatus === "pending" || resource.metadataStatus === "processing"
  const specializedPreview = toResourceCardPreview(resource)
  const specializedPreviewState = isResolvingMetadata
    ? "loading" as const
    : resource.metadataStatus === "failed"
      ? "failed" as const
      : "ready" as const
  const isMasonryView = viewMode === "masonry"
  const iconName = getResourceIconName(resource)
  const iconSrc = iconName ? undefined : getResourceFaviconUrl(resource)
  const iconLabel = resource.type === "http" ? "WEB" : resource.type === "ftp" ? "FTP" : "LINK"
  const magnetFileTree = resource.type === "magnet"
    ? resource.metadata?.data?.tree ?? []
    : []
  const annotation = resource.annotation ?? null
  const checked = annotation?.checked === true
  const rating = annotation?.rating ?? 0
  const isWatchedLater = resource.isReadLater === true
  const [localCommentDraft, setLocalCommentDraft] = useState(
    annotation?.comment ?? ""
  )
  const copyResourceLink = async () => {
    await navigator.clipboard?.writeText(resourceLinkUrl)
    toast.success("链接已复制")
  }
  const copyPillValue = (value: string) => {
    void navigator.clipboard?.writeText(value)
  }

  function handleDownloadAllMedia() {
    if (downloadableMedia.length === 0) return

    downloadableMedia.forEach((item) => triggerMediaDownload(item))
  }

  useEffect(() => {
    setLocalCommentDraft(annotation?.comment ?? "")
  }, [annotation?.comment])

  useEffect(() => () => {
    if (magnetTreeCloseTimerRef.current) {
      clearTimeout(magnetTreeCloseTimerRef.current)
    }
  }, [])

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

  function renderCommentAction() {
    if (!showAnnotationActions || showSelectionControl) return null

    return (
      <ResourceCardCommentButton
        onClick={() => {
          if (!isSignedIn) {
            toast.info("请先登录后再编辑资源批注。")
            return
          }
          setCommentEditorOpen((open) => !open)
        }}
      />
    )
  }

  function renderCommentEditor() {
    if (!showAnnotationActions || !commentEditorOpen) return null

    return (
      <ResourceCardCommentEditor
        onCancel={() => {
          setLocalCommentDraft(annotation?.comment ?? "")
          setCommentEditorOpen(false)
        }}
        onChange={setLocalCommentDraft}
        onSave={() => {
          const comment = localCommentDraft.trim()
          setLocalCommentDraft(comment)
          handleUpdateAnnotation({ comment })
          setCommentEditorOpen(false)
        }}
        value={localCommentDraft}
      />
    )
  }

  function renderAnnotationActions(className?: string) {
    if (showSelectionControl) return null

    return (
      <ButtonGroup className={cn("mono h-6 items-center rounded-md border border-line-soft bg-ink-850/55 px-1 text-[10px] text-fg-dim", className)}>
        {renderMagnetTreeAction()}
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
            onClick={(event) => {
              event.stopPropagation()
              onToggleStar()
            }}
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
        className="size-5 rounded-[5px] border border-line bg-ink-950 text-jade shadow-inner hover:border-line focus-visible:border-line focus-visible:ring-2 focus-visible:ring-jade/20 data-checked:border-line data-checked:bg-[var(--jade-glow)] data-checked:text-jade [&_[data-slot=checkbox-indicator]>svg]:size-3.5"
        onClick={(event) => event.stopPropagation()}
        onCheckedChange={(value) =>
          handleUpdateAnnotation({ checked: value === true })
        }
      />
    )
  }

  function renderMagnetTreeAction() {
    if (magnetFileTree.length === 0) return null

    const keepOpen = () => {
      if (magnetTreeCloseTimerRef.current) {
        clearTimeout(magnetTreeCloseTimerRef.current)
        magnetTreeCloseTimerRef.current = null
      }
      setMagnetTreeOpen(true)
    }
    const scheduleClose = () => {
      if (magnetTreeCloseTimerRef.current) {
        clearTimeout(magnetTreeCloseTimerRef.current)
      }
      magnetTreeCloseTimerRef.current = setTimeout(() => {
        setMagnetTreeOpen(false)
        magnetTreeCloseTimerRef.current = null
      }, 120)
    }

    return (
      <Popover open={magnetTreeOpen} onOpenChange={setMagnetTreeOpen}>
        <PopoverTrigger
          render={
            <Button
              className="size-5 rounded-sm text-fg-dim hover:text-jade [&_svg]:size-3"
              onClick={(event) => event.stopPropagation()}
              onMouseEnter={keepOpen}
              onMouseLeave={scheduleClose}
              size="icon-xs"
              title="查看文件目录"
              type="button"
              variant="ghost"
            />
          }
        >
          <FolderTree />
          <span className="sr-only">查看文件目录</span>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[min(92vw,32rem)] gap-0 overflow-hidden border-line bg-ink-850 p-0 text-fg"
          onClick={(event) => event.stopPropagation()}
          onMouseEnter={keepOpen}
          onMouseLeave={scheduleClose}
          sideOffset={6}
        >
          <div className="flex h-9 items-center justify-between border-b border-line px-3">
            <PopoverTitle className="mono text-[10px] font-normal uppercase tracking-[.12em] text-fg-dim">
              文件目录
            </PopoverTitle>
            {typeof resource.metadata?.data?.fileCount === "number" && (
              <Badge className="h-4 px-1.5 text-[9px] font-normal" variant="secondary">
                {resource.metadata.data.fileCount} files
              </Badge>
            )}
          </div>
          <div className="max-h-[calc(70vh-2.25rem)] overflow-y-auto overscroll-contain p-1">
            <ResourceFileTree tree={magnetFileTree} />
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  function renderResourceActions(className?: string) {
    if (
      showSelectionControl ||
      (
        downloadableMedia.length === 0 &&
        !canDeleteResource &&
        !canEditResource &&
        !isVaultOwner
      )
    ) {
      return null
    }

    return (
      <ButtonGroup className={cn("h-6 items-center rounded-md border border-line-soft bg-ink-850/70 px-1", className)}>
        {downloadableMedia.length > 0 && (
          <Button
            className="size-5 rounded-sm text-fg-dim hover:text-jade [&_svg]:size-3"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation()
              handleDownloadAllMedia()
            }}
            size="icon-xs"
            title="下载全部媒体"
            type="button"
            variant="ghost"
          >
            <Download />
            <span className="sr-only">下载全部媒体</span>
          </Button>
        )}
        {canDeleteResource && resource.metadata?.provider !== LOCAL_MEDIA_PROVIDER && (
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
                onClick={(event) => event.stopPropagation()}
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
            "group/resource-handle relative grid size-[30px] shrink-0 cursor-grab place-items-center overflow-hidden rounded-input  hover:border-ink-600 hover:border hover:bg-ink-750 border-line transition active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-60",
            className
          )}
          disabled={disabled}
          ref={handleRef}
          type="button"
        >
          <ResourceIcon
            className="transition group-hover/resource-handle:opacity-0"
            iconName={iconName}
            iconSrc={iconSrc}
            label={iconLabel}
          />
          <GripVertical className="absolute size-4 text-fg-faint opacity-0 transition group-hover/resource-handle:opacity-100" />
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

  function renderExternalLinkAction(url: string, className?: string) {
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
            {url}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setExternalOpen(false)
                window.open(url, "_blank", "noopener,noreferrer")
              }}
            >
              继续打开
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  function renderRefererLinkAction(className?: string) {
    if (!refererUrl || isLocalMediaResource) return null

    return (
      <a
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-fg-dim transition hover:bg-ink-700 hover:text-jade [&_svg]:size-3",
          className
        )}
        href={refererUrl}
        onClick={(event) => event.stopPropagation()}
        rel="noreferrer"
        target="_blank"
        title="打开 Referer"
      >
        <LinkIcon />
        <span className="sr-only">打开 Referer</span>
      </a>
    )
  }

  if (specializedPreview) {
    const specializedActions = showSelectionControl ? undefined : (
      <ResourceCardActions
        comment={localCommentDraft}
        disabled={disabled}
        isChecked={checked}
        isReadLater={isWatchedLater}
        isStarred={resource.isStarred}
        onClearAnnotation={showAnnotationActions ? handleClearAnnotation : undefined}
        onRatingChange={showAnnotationActions ? (value) =>
          handleUpdateAnnotation({ rating: value > 0 ? value : null }) : undefined}
        onSaveComment={showAnnotationActions ? (comment) => {
          setLocalCommentDraft(comment)
          handleUpdateAnnotation({ comment })
        } : undefined}
        onToggleChecked={showAnnotationActions ? () =>
          handleUpdateAnnotation({ checked: !checked }) : undefined}
        onToggleReadLater={showReadLaterAction ? handleToggleWatchLater : undefined}
        onToggleStar={showStarAction ? () => {
          if (!isSignedIn) {
            toast.info("请先登录后再收藏资源。")
            return
          }
          onToggleStar()
        } : undefined}
        rating={rating}
        section="annotation"
      />
    )
    const specializedFooterActions =
      showSelectionControl ||
      (
        downloadableMedia.length === 0 &&
        !canDeleteResource &&
        !canEditResource &&
        !isVaultOwner
      )
        ? undefined
        : (
          <ResourceCardActions
            disabled={disabled}
            onDelete={canDeleteResource ? () => setSpecialDeleteOpen(true) : undefined}
            onDownload={downloadableMedia.length > 0 ? handleDownloadAllMedia : undefined}
            onEdit={canEditResource ? onOpenDetails : undefined}
            onMove={isVaultOwner ? () => {
              setTransferOpen(true)
              if (transferTargets.length === 0) {
                void onLoadTransferTargets().catch(() => undefined)
              }
            } : undefined}
            onRetryMetadata={
              canDeleteResource &&
              resource.metadata?.provider !== LOCAL_MEDIA_PROVIDER &&
              !isResolvingMetadata
                ? onResolveMetadata
                : undefined
            }
            section="management"
          />
        )

    return (
      <>
        <ResourcePreviewCard
          actions={specializedActions}
          annotation={
            !showSelectionControl && showAnnotationActions && !commentEditorOpen
              ? localCommentDraft || undefined
              : undefined
          }
          articleId={`resource-${resource.id}`}
          articleRef={ref}
          className={cn(
            "group/resource-card",
            isResolvingMetadata && "border-line bg-ink-800/80",
            isActive && "border-jade hover:border-jade",
            className
          )}
          commentAction={renderCommentAction()}
          commentEditor={renderCommentEditor()}
          descriptionContent={
            aiSummary && aiSummary.status !== "failed"
              ? <ResourceDescription aiSummary={aiSummary} description={description} />
              : undefined
          }
          footerActions={specializedFooterActions}
          leadingControl={
            showSelectionControl || isVaultOwner
              ? renderLeadingControl(
                  "size-5 rounded-[5px] [&_img]:size-3.5 [&_span.mono]:text-[7px]"
                )
              : undefined
          }
          mediaVisible={mediaVisible}
          onActivate={() => {
            if (showSelectionControl) {
              onToggleSelected?.(!isSelected)
              return
            }
            onActivate()
          }}
          preview={specializedPreview}
          state={specializedPreviewState}
          viewMode={viewMode}
        />

        <AlertDialog open={specialDeleteOpen} onOpenChange={setSpecialDeleteOpen}>
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

        {isVaultOwner && (
          <ResourceTransferDialog
            disabled={disabled}
            focusedSpaceId={transferFocusSpaceId}
            onCreateSpace={onCreateTransferTargetSpace}
            onLoadTargets={onLoadTransferTargets}
            onOpenChange={setTransferOpen}
            onTransfer={async (input) => {
              setTransferOpen(false)
              await onTransferResource({
                ...input,
                resourceId: resource.id,
              })
            }}
            open={transferOpen}
            resourceTitle={title}
            showTrigger={false}
            sourceSpaceId={resource.spaceId}
            targets={transferTargets}
          />
        )}
      </>
    )
  }

  return (
    <article
      className={cn(
        "group/resource-card mono flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-ink-800 text-xs transition hover:border-ink-700 hover:bg-ink-750",
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
      <header className="flex min-w-0 items-center gap-1.5 px-3 py-1.5 text-[10px]">
        <div className="flex min-w-0 items-center gap-1.5">
          {renderLeadingControl(
            "size-5 rounded-[5px] [&_img]:size-3.5 [&_span.mono]:text-[7px]"
          )}
          <Badge className="mono h-4 px-1.5 text-[9px] font-normal" variant="secondary">
            {resourceTypeLabel}
          </Badge>
        </div>
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1">
          <ResourceMetadataState
            className="mono h-4 shrink-0 px-1.5 text-[9px] font-normal"
            label={metadataState.label}
            status={resource.metadataStatus}
          />
          {renderCheckedAction()}
          {renderAnnotationActions("h-5")}
        </div>
      </header>

      <Separator className="h-px w-full shrink-0 bg-line" />

      <section className="flex min-w-0 flex-col gap-1.5 px-3 py-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <TooltipProvider>
            <Tooltip>
              {canEditResource && !showSelectionControl ? (
                <TooltipTrigger
                  render={
                  <button
                    className={cn(
                      "min-w-0 flex-1 text-left font-semibold text-fg hover:text-jade-bright",
                      isMasonryView
                        ? "whitespace-normal break-words text-xs leading-5"
                        : "truncate text-xs"
                    )}
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
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-left font-semibold text-fg",
                      isMasonryView
                        ? "whitespace-normal break-words text-xs leading-5"
                        : "truncate text-xs"
                    )}
                  >
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
        </div>

        {resourceLinkUrl && (
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              className="mono min-w-0 flex-1 truncate rounded-input border border-line bg-ink-900 px-2 py-1 text-left text-[10.5px] text-fg-muted transition hover:text-jade hover:underline"
              onClick={(event) => {
                event.stopPropagation()
                void copyResourceLink()
              }}
              title="点击复制链接"
              type="button"
            >
              {resourceLinkUrl}
            </button>
            {renderExternalLinkAction(
              resourceLinkUrl,
              isMasonryView
                ? "size-6 rounded-input border border-line-soft bg-ink-850 hover:border-jade-dim hover:bg-ink-800"
                : undefined
            )}
            {renderRefererLinkAction(
              isMasonryView
                ? "size-6 rounded-input border border-line-soft bg-ink-850 hover:border-jade-dim hover:bg-ink-800"
                : undefined
            )}
          </div>
        )}

        <ResourceDescription aiSummary={aiSummary} description={description} />

        {isResolvingMetadata && (
          <div className="overflow-hidden rounded-input border border-line-soft bg-ink-850/45">
            <div className="h-0.5 w-full animate-[nv-progress_1.8s_ease-in-out_infinite] bg-linear-to-r from-transparent via-jade-dim to-transparent" />
          </div>
        )}

        {mediaVisible && media.length > 0 && !isResolvingMetadata && (
          <ResourceMediaGallery
            media={media}
            title={title}
            variant={isMasonryView ? "carousel" : "scroll"}
          />
        )}

        {detailPills.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {detailPills.map((pill) => (
              <ResourceMetadataPill
                key={pill.key}
                onCopy={copyPillValue}
                pill={pill}
              />
            ))}
          </div>
        )}
      </section>

      {!showSelectionControl && (
        <>
          <Separator className="h-px w-full shrink-0 bg-line" />
          <footer className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center justify-between gap-2 px-3 py-1.5 text-[10px]">
              {showAnnotationActions ? (
                renderCommentAction()
              ) : (
                <span />
              )}
              {renderResourceActions("h-5 shrink-0")}
            </div>

            {showAnnotationActions && (annotation?.comment || commentEditorOpen) && (
              <Separator className="h-px w-full shrink-0 bg-line" />
            )}

            {showAnnotationActions && annotation?.comment && !commentEditorOpen && (
              <div className="px-3.5 py-3" onClick={(event) => event.stopPropagation()}>
                <div className="min-w-0 rounded-input border border-line-soft bg-ink-850/35 px-2 py-1 text-xs leading-5 text-fg-muted">
                  <span className="mono mr-2 text-[10px] uppercase tracking-[.12em] text-fg-faint">
                    COMMENT
                  </span>
                  {annotation.comment}
                </div>
              </div>
            )}

            {showAnnotationActions && commentEditorOpen && (
              <div className="px-3.5 py-3" onClick={(event) => event.stopPropagation()}>
                {renderCommentEditor()}
              </div>
            )}
          </footer>
        </>
      )}
    </article>
  )
}

function getHttpUrl(value?: string | null) {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
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
          <MessageSquare />
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
      <Badge
        className="mono h-4 px-1.5 text-[9px] font-normal"
        title={pill.title}
        variant="outline"
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 rounded-full",
            pill.status === "online" && "bg-success",
            pill.status === "offline" && "bg-destructive",
            pill.status === "degraded" && "bg-primary",
            pill.status === "maintenance" && "bg-muted-foreground"
          )}
        />
        {pill.label}
      </Badge>
    )
  }

  if (pill.kind === "copy") {
    return (
      <Badge className="mono h-4 px-1.5 text-[9px] font-normal" variant="outline">
        <span>{pill.label}</span>
        <span className="text-muted-foreground">{pill.value}</span>
        <Button
          aria-label={pill.ariaLabel}
          className="size-4 shrink-0"
          onClick={(event) => {
            event.stopPropagation()
            onCopy(pill.value)
          }}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <Copy />
        </Button>
      </Badge>
    )
  }

  return (
    <Badge className="mono h-4 px-1.5 text-[9px] font-normal" variant="outline">
      {pill.label}
    </Badge>
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
    <Badge
      className={className}
      title={label}
      variant={status === "failed" ? "destructive" : "outline"}
    >
      {resolving ? (
        <LoaderCircle className="animate-spin" />
      ) : (
        <span className="size-1.5 rounded-full bg-current" />
      )}
      {label}
    </Badge>
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
  showTrigger = true,
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
  showTrigger?: boolean
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
      {showTrigger && (
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
      )}
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

  if (iconName === RESOURCE_ICON_MAP.local_media) {
    return <HardDriveUpload aria-hidden="true" className={cn("size-[18px] text-fg-dim", className)} />
  }

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
      className={cn(
        "size-[18px] object-contain",
        iconName === RESOURCE_ICON_MAP.github && "brightness-0 invert",
        className,
      )}
      src={`/icons/${iconName}`}
    />
  )
}

type ResourceIconName = (typeof RESOURCE_ICON_MAP)[keyof typeof RESOURCE_ICON_MAP]

function getResourceIconName(resource: Resource): ResourceIconName | undefined {
  if (resource.type === "local_media") return RESOURCE_ICON_MAP.local_media
  if (resource.type === "douyin") return RESOURCE_ICON_MAP.douyin
  if (resource.type === "magnet") return RESOURCE_ICON_MAP.magnet
  if (resource.type === "twitter") return RESOURCE_ICON_MAP.twitter
  if (resource.type === "telegram") return RESOURCE_ICON_MAP.telegram
  if (resource.type === "wechat_mp") return RESOURCE_ICON_MAP.wechat_mp
  if (resource.type === "baidu_pan") return RESOURCE_ICON_MAP.baidu_pan
  if (resource.type === "quark_pan") return RESOURCE_ICON_MAP.quark_pan
  if (
    resource.metadata?.data?.preview?.kind?.startsWith("github_") ||
    parseGitHubLink(resource.url ?? "")
  ) {
    return RESOURCE_ICON_MAP.github
  }

  const protocol = getResourceProtocol(resource.url ?? "")
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

type ResourceMediaDownload = {
  fileName: string
  url: string
}

function getDownloadableResourceMedia(resource: Resource): ResourceMediaDownload[] {
  const media = resource.metadata?.data?.media
  if (!Array.isArray(media)) return []

  const seenUrls = new Set<string>()
  return (media as unknown[]).flatMap((value, index) => {
    if (!value || typeof value !== "object") return []
    const item = value as Record<string, unknown>
    const url = getMediaDownloadUrl(item)
    if (!url || seenUrls.has(url)) return []
    seenUrls.add(url)

    return [{
      fileName: getMediaDownloadFileName(resource.title, item, url, index),
      url: `/api/v1/resources/${encodeURIComponent(resource.id)}/media/${index}/download`,
    }]
  })
}

function getMediaDownloadUrl(item: Record<string, unknown>) {
  const candidates = [item.url, item.thumbnailUrl]
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) continue
    const url = candidate.trim()
    try {
      const parsed = new URL(url, "https://nexus-vault.local")
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return url
    } catch {
      continue
    }
  }
  return undefined
}

function getMediaDownloadFileName(
  resourceTitle: string,
  item: Record<string, unknown>,
  url: string,
  index: number,
) {
  const persistedName = typeof item.fileName === "string"
    ? item.fileName.trim()
    : ""
  const urlName = getUrlFileName(url)
  const extension = getMediaExtension(item)
  const fallbackName = `${resourceTitle.trim() || "resource"}-${index + 1}${extension}`
  const resolvedName = persistedName || urlName || fallbackName
  const fileName = extension && !/\.[a-z0-9]{1,8}$/i.test(resolvedName)
    ? `${resolvedName}${extension}`
    : resolvedName
  return sanitizeDownloadFileName(fileName)
}

function getUrlFileName(url: string) {
  try {
    const pathname = new URL(url, "https://nexus-vault.local").pathname
    const value = pathname.split("/").filter(Boolean).at(-1)
    return value ? decodeURIComponent(value) : ""
  } catch {
    return ""
  }
}

function getMediaExtension(item: Record<string, unknown>) {
  const mimeType = typeof item.mimeType === "string"
    ? item.mimeType.toLowerCase()
    : ""
  const mimeExtensions: Record<string, string> = {
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
  }
  if (mimeExtensions[mimeType]) return mimeExtensions[mimeType]

  if (item.kind === "image") return ".jpg"
  if (item.kind === "video") return ".mp4"
  if (item.kind === "audio") return ".mp3"
  return ""
}

function sanitizeDownloadFileName(value: string) {
  const sanitized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
  return (sanitized || "media").slice(0, 180)
}

function triggerMediaDownload(item: ResourceMediaDownload) {
  const anchor = document.createElement("a")
  anchor.download = item.fileName
  anchor.href = item.url
  anchor.rel = "noreferrer"

  try {
    const target = new URL(item.url, window.location.href)
    if (target.origin !== window.location.origin) anchor.target = "_blank"
  } catch {
    return
  }

  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}

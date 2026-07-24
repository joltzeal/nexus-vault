"use client"

import { useSortable } from "@dnd-kit/react/sortable"
import {
  Copy,
  ExternalLink,
  FolderInput,
  GripVertical,
  LoaderCircle,
  MessageSquare,
  Plus,
  Star,
  Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

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
import { MarkdownContent } from "@/features/vault-workspace/components/markdown-content"
import { ResourceCommentsPreview } from "@/features/vault-workspace/components/resource-comments-preview"
import { ResourceMediaGallery } from "@/features/vault-workspace/components/resource-media-gallery"
import { SpaceIcon } from "@/features/vault-workspace/components/space-icon-picker"
import type {
  CommentItem,
  Resource,
  ResourceTransferTargetVault,
} from "@/features/vault-workspace/types"
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
  comments,
  commentBody,
  disabled,
  index,
  canEditResource,
  isActive,
  isSignedIn,
  isVaultOwner,
  mediaVisible,
  onActivate,
  onCommentBodyChange,
  onCreateTransferTargetSpace,
  onDelete,
  onFocusComments,
  onLoadTransferTargets,
  onOpenDetails,
  onSubmitComment,
  onToggleStar,
  onTransferResource,
  resource,
  spaceId,
  transferFocusSpaceId,
  transferTargets,
}: {
  comments: CommentItem[]
  commentBody: string
  disabled: boolean
  index: number
  canEditResource: boolean
  isActive: boolean
  isSignedIn: boolean
  isVaultOwner: boolean
  mediaVisible: boolean
  onActivate: () => void
  onCommentBodyChange: (value: string) => void
  onCreateTransferTargetSpace: (vaultId: string) => void
  onDelete: () => void
  onFocusComments: () => void
  onLoadTransferTargets: () => Promise<void>
  onOpenDetails: () => void
  onSubmitComment: () => void
  onToggleStar: () => void
  onTransferResource: (input: {
    action: "move" | "copy"
    resourceId: string
    targetVaultId: string
    targetSpaceId: string
  }) => Promise<void>
  resource: Resource
  spaceId: string
  transferFocusSpaceId?: string
  transferTargets: ResourceTransferTargetVault[]
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
  const [transferOpen, setTransferOpen] = useState(false)
  const title = getResourceTitle(resource)
  const description = getResourceDescription(resource)
  const descriptionStartsWithImage = startsWithMarkdownImage(description)
  const collapsedDescriptionText = getCollapsedDescriptionText(description)
  const displayUrl = getResourceDisplayUrl(resource)
  const media = getResourceMedia(resource)
  const pills = getResourcePillItems(resource)
  const metadataState = getMetadataState(resource.metadataStatus)
  const isResolvingMetadata =
    resource.metadataStatus === "pending" || resource.metadataStatus === "processing"
  const iconName = getResourceIconName(resource)
  const iconSrc = getResourceFaviconUrl(resource)
  const iconLabel = resource.type === "http" ? "WEB" : "LINK"
  const showComments = comments.length > 0 || (isActive && commentsOpen)
  const showComposer = isActive && commentsOpen
  const copyDisplayUrl = async () => {
    await navigator.clipboard?.writeText(displayUrl)
    toast.success("链接已复制")
  }
  const copyPillValue = (value: string) => {
    void navigator.clipboard?.writeText(value)
  }

  return (
    <article
      className={cn(
        "group/resource-card flex min-w-0 flex-col gap-1 rounded-card border border-line bg-ink-800 px-3.5 py-3 transition hover:border-ink-700 hover:bg-ink-750",
        isResolvingMetadata && "border-line bg-ink-800/80",
        isActive && "border-jade hover:border-jade"
      )}
      id={`resource-${resource.id}`}
      onClick={onActivate}
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
              iconSrc={iconSrc}
              label={iconLabel}
            />
            <GripVertical className="absolute size-4 text-fg-faint opacity-0 transition group-hover/resource-card:opacity-100" />
            <span className="sr-only">拖动排序资源</span>
          </button>
        ) : (
          <span className="relative grid size-[30px] shrink-0 place-items-center overflow-hidden rounded-input border border-line bg-ink-700">
            <ResourceIcon iconName={iconName} iconSrc={iconSrc} label={iconLabel} />
          </span>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {canEditResource ? (
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
              ) : (
                <span className="min-w-0 flex-1 truncate text-left text-[14.5px] font-semibold text-fg">
                  {title}
                </span>
              )}
            </TooltipTrigger>
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
        <div className="mono flex shrink-0 items-center gap-1.5 text-[10px] text-fg-dim">
          <Button
            className={cn(
              "h-5 gap-0.5 rounded-sm px-1 text-[10px] text-fg-dim [&_svg]:size-3",
              resource.isStarred && "text-jade"
            )}
            disabled={!isSignedIn}
            size="xs"
            variant="ghost"
            onClick={onToggleStar}
            type="button"
          >
            <Star className={cn(resource.isStarred && "fill-current")} />
            <span className="sr-only">{resource.isStarred ? "取消收藏资源" : "收藏资源"}</span>
          </Button>
          <Button
            className={cn(
              "h-5 gap-0.5 rounded-sm px-1 text-[10px] text-fg-dim [&_svg]:size-3",
              showComposer && "bg-ink-700 text-jade"
            )}
            disabled={!isSignedIn}
            size="xs"
            variant="ghost"
            onClick={() => {
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
            <ResourceTransferDialog
              disabled={disabled}
              onLoadTargets={onLoadTransferTargets}
              onOpenChange={setTransferOpen}
              onCreateSpace={onCreateTransferTargetSpace}
              onTransfer={async (input) => {
                await onTransferResource({
                  ...input,
                  resourceId: resource.id,
                })
                setTransferOpen(false)
              }}
              open={transferOpen}
              focusedSpaceId={transferFocusSpaceId}
              resourceTitle={title}
              sourceSpaceId={resource.spaceId}
              targets={transferTargets}
            />
          )}
          {canEditResource && (
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
          <button
            className="mono min-w-0 max-w-full truncate rounded-input border border-line bg-ink-900 px-2 py-1 text-left text-[10.5px] text-fg-muted transition hover:text-jade hover:underline md:max-w-[520px]"
            onClick={() => void copyDisplayUrl()}
            title="点击复制链接"
            type="button"
          >
            {displayUrl}
          </button>
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
        </div>
      </div>

      {description && (
        <div
          className={cn(
            "mt-1 min-w-0 cursor-pointer rounded-input border border-line-soft bg-ink-850/45 px-2 py-1 text-left outline-none transition hover:border-line hover:bg-ink-850 focus-visible:border-jade-dim focus-visible:shadow-[0_0_0_3px_var(--jade-glow)]",
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
          {!descriptionOpen ? (
            <span className="block truncate text-xs leading-5 text-fg-dim">
              {descriptionStartsWithImage || !collapsedDescriptionText
                ? "展开描述"
                : collapsedDescriptionText}
            </span>
          ) : (
            <MarkdownContent
              className="min-w-0 gap-1.5 text-fg-muted"
              value={description}
            />
          )}
        </div>
      )}

      {isResolvingMetadata && (
        <div className="mt-1 overflow-hidden rounded-input border border-line-soft bg-ink-850/45">
          <div className="h-0.5 w-full animate-[nv-progress_1.8s_ease-in-out_infinite] bg-linear-to-r from-transparent via-jade-dim to-transparent" />
        </div>
      )}

      {mediaVisible && !isResolvingMetadata && <ResourceMediaGallery media={media} title={title} />}

      {showComments && (
        <ResourceCommentsPreview
          body={commentBody}
          comments={comments}
          disabled={disabled || !isSignedIn}
          onBodyChange={onCommentBodyChange}
          onSubmit={onSubmitComment}
          showComposer={showComposer}
        />
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

function ResourceTransferDialog({
  disabled,
  focusedSpaceId,
  onCreateSpace,
  onLoadTargets,
  onOpenChange,
  onTransfer,
  open,
  resourceTitle,
  sourceSpaceId,
  targets,
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
  sourceSpaceId: string
  targets: ResourceTransferTargetVault[]
}) {
  const [busyKey, setBusyKey] = useState("")
  const [loadingTargets, setLoadingTargets] = useState(false)
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
      toast.info("目标就是当前 Space，无需操作。")
      return
    }

    const key = `${input.action}:${input.targetSpaceId}`
    setBusyKey(key)
    try {
      await onTransfer(input)
    } finally {
      setBusyKey("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => void handleOpenChange(value)}>
      <Button
        className="size-5 rounded-sm text-fg-dim hover:text-jade [&_svg]:size-3"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          void handleOpenChange(true)
        }}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <FolderInput />
        <span className="sr-only">移动或复制</span>
      </Button>
      <DialogContent className="max-h-[min(680px,calc(100dvh-2rem))] overflow-hidden border-line bg-ink-850 p-0 gap-0 text-fg sm:max-w-[520px]">
        <DialogHeader className="min-w-0 border-b border-line px-4 py-3">
          <DialogTitle className="font-display">移动或复制</DialogTitle>
          <DialogDescription className="block min-w-0 max-w-full truncate text-fg-dim">
            {resourceTitle}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[min(520px,calc(100dvh-12rem))]">
          <div className="p-2">
            {loadingTargets ? (
              <div className="flex min-h-32 items-center justify-center text-sm text-fg-dim">
                正在加载 Vault...
              </div>
            ) : targets.length > 0 ? (
              <TreeProvider
                defaultExpandedIds={targets.map((target) => target.id)}
                key={`${treeKey}:${focusedSpaceId ?? ""}`}
                selectable={false}
                showLines={false}
              >
                <TreeView className="p-0">
                  {targets.map((vault, vaultIndex) => (
                    <TreeNode
                      isLast={vaultIndex === targets.length - 1}
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
                还没有可用的目标 Space
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
      // eslint-disable-next-line @next/next/no-img-element
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

function getResourceProtocol(url: string) {
  const value = url.trim().toLowerCase()
  if (value.startsWith("ed2k://")) return "ed2k"
  if (value.startsWith("thunder://")) return "thunder"
  return undefined
}

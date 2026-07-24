"use client"

import { useDroppable } from "@dnd-kit/react"
import { useSortable } from "@dnd-kit/react/sortable"
import { useState } from "react"
import {
  ChevronDown,
  Copy,
  FolderPlus,
  GripVertical,
  Info,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { MarkdownContent } from "@/features/vault-workspace/components/markdown-content"
import { ResourceCard } from "@/features/vault-workspace/components/resource-card"
import { SpaceIcon, SpaceIconPicker } from "@/features/vault-workspace/components/space-icon-picker"
import type {
  CommentItem,
  Resource,
  ResourceTransferTargetVault,
  Space,
} from "@/features/vault-workspace/types"
import { cn } from "@/lib/utils"
import type { ResourceDragData } from "./resource-card"
import { getResourceDisplayUrl } from "./view-models"

export type SpaceDragData = {
  kind: "space"
  spaceId: string
}

export type SpaceDropData = {
  kind: "space-drop"
  spaceId: string
}

export type BoardDragData = ResourceDragData | SpaceDragData | SpaceDropData

export function SpaceSection({
  collapsed,
  commentBody,
  commentsByResourceId,
  disabled,
  canAddResource,
  currentUserId,
  isVaultEditor,
  isVaultOwner,
  isSignedIn,
  mediaVisible,
  onAddResource,
  onActivateResource,
  onCommentBodyChange,
  onCreateTransferTargetSpace,
  onDeleteSpace,
  onEditSpace,
  onDeleteResource,
  onFocusResourceComments,
  onLoadTransferTargets,
  onSelectResource,
  onSubmitComment,
  onToggleCollapsed,
  onToggleResourceStar,
  onTransferResource,
  onUpdateIcon,
  resources,
  selectedResourceId,
  space,
  spacePosition,
  transferFocusSpaceId,
  transferTargets,
}: {
  collapsed: boolean
  commentBody: string
  commentsByResourceId: Record<string, CommentItem[]>
  disabled: boolean
  canAddResource: boolean
  currentUserId?: string
  isVaultEditor: boolean
  isVaultOwner: boolean
  isSignedIn: boolean
  mediaVisible: boolean
  onAddResource: () => void
  onActivateResource: (resourceId: string) => void
  onCommentBodyChange: (value: string) => void
  onCreateTransferTargetSpace: (vaultId: string) => void
  onDeleteSpace: () => void
  onEditSpace: () => void
  onDeleteResource: (resourceId: string) => void
  onFocusResourceComments: (resourceId: string) => void
  onLoadTransferTargets: () => Promise<void>
  onSelectResource: (resourceId: string) => void
  onSubmitComment: () => void
  onToggleCollapsed: () => void
  onToggleResourceStar: (resourceId: string) => void
  onTransferResource: (input: {
    action: "move" | "copy"
    resourceId: string
    targetVaultId: string
    targetSpaceId: string
  }) => Promise<void>
  onUpdateIcon: (icon: string) => void
  resources: Resource[]
  selectedResourceId?: string
  space: Space
  spacePosition: number
  transferFocusSpaceId?: string
  transferTargets: ResourceTransferTargetVault[]
}) {
  const { handleRef, ref } = useSortable<SpaceDragData>({
    id: `space:${space.id}`,
    index: spacePosition,
    group: "spaces",
    type: "space",
    accept: "space",
    data: {
      kind: "space",
      spaceId: space.id,
    },
    disabled: disabled || !isVaultOwner,
  })
  const { ref: dropRef, isDropTarget } = useDroppable<SpaceDropData>({
    id: `space-drop:${space.id}`,
    type: "space-drop",
    accept: (draggable) => {
      const data = draggable.data as ResourceDragData | undefined
      return data?.kind === "resource"
    },
    data: {
      kind: "space-drop",
      spaceId: space.id,
    },
    disabled: disabled || !isVaultOwner,
  })

  async function handleCopySpaceLinks() {
    const links = resources.map((resource) => getResourceDisplayUrl(resource)).filter(Boolean)
    if (!links.length) return

    await navigator.clipboard.writeText(links.join("\n"))
    toast.success(`已复制 ${links.length} 个链接`)
  }

  return (
    <section
      className={cn(
        "group mb-3 scroll-mt-4 rounded-card border border-line bg-ink-900/35 px-2 py-2",
        collapsed && "opacity-95"
      )}
      id={space.id}
      ref={ref}
      data-space-section
    >
      <div className="group/space-header sticky top-0 z-30 -mx-1 flex items-center gap-1 rounded-input  bg-ink-900/95 px-2 py-2 shadow-[0_10px_24px_-22px_rgba(0,0,0,.9)] backdrop-blur">
        {isVaultOwner ? (
          <button
            className="relative grid size-6 shrink-0 cursor-grab place-items-center overflow-hidden rounded-sm text-jade transition hover:bg-ink-750 hover:text-fg-muted active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-4"
            disabled={disabled}
            ref={handleRef}
            type="button"
          >
            <SpaceIcon
              className="transition group-hover/space-header:opacity-0"
              name={space.icon}
            />
            <GripVertical className="absolute text-fg-faint opacity-0 transition group-hover/space-header:opacity-100" />
            <span className="sr-only">拖动排序 Space</span>
          </button>
        ) : (
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-jade [&_svg]:size-4">
            <SpaceIcon name={space.icon} />
          </span>
        )}
        <button
          className="inline-flex size-[20px] shrink-0 items-center justify-center rounded-sm text-fg-dim transition hover:bg-ink-750 hover:text-fg [&_svg]:size-3.5"
          onClick={onToggleCollapsed}
          type="button"
        >
          <ChevronDown className={cn("transition-transform", collapsed && "-rotate-90")} />
          <span className="sr-only">折叠 Space</span>
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h2 className="truncate font-display text-[15.5px] font-semibold">{space.name}</h2>
          <span className="mono text-[11px] text-fg-dim">{resources.length}</span>
          {space.description && (
            <HoverCard openDelay={120} closeDelay={80}>
              <HoverCardTrigger asChild>
                <span
                  className="inline-flex size-5 items-center justify-center text-fg-dim transition hover:text-jade [&_svg]:size-3.5"
                  tabIndex={0}
                >
                  <Info />
                  <span className="sr-only">Space 描述</span>
                </span>
              </HoverCardTrigger>
              <HoverCardContent
                align="start"
                className="max-h-[min(420px,calc(100dvh-7rem))] w-[min(440px,calc(100vw-2rem))] overflow-auto overscroll-contain border-line bg-ink-850 p-3 text-fg"
              >
                <MarkdownContent
                  className="max-w-full text-[12.5px]"
                  value={space.description}
                />
              </HoverCardContent>
            </HoverCard>
          )}
        </div>
        <div className="flex gap-1 opacity-0 transition hover:opacity-100 group-hover:opacity-100 md:group-hover:opacity-100">
          {resources.length > 0 && (
            <Button size="icon-sm" variant="ghost" onClick={handleCopySpaceLinks} type="button">
              <Copy />
              <span className="sr-only">复制此 Space 下所有链接</span>
            </Button>
          )}
          {canAddResource && (
            <Button size="icon-sm" variant="ghost" onClick={onAddResource} disabled={disabled}>
              <Plus />
              <span className="sr-only">此 Space 添加资源</span>
            </Button>
          )}
          {isVaultOwner && (
            <>
              <SpaceIconPicker
                disabled={disabled}
                onSelect={onUpdateIcon}
                trigger="action"
                value={space.icon}
              />
              <SpaceActionsMenu
                disabled={disabled}
                onDelete={onDeleteSpace}
                onEdit={onEditSpace}
                resourceCount={resources.length}
                spaceName={space.name}
              />
            </>
          )}
        </div>
      </div>
      <div className={cn(!collapsed && "h-px bg-line-soft mx-2 ")} />
      {!collapsed && (
        <div
          className={cn(
            "flex min-h-20 flex-col gap-2 rounded-input px-0 pt-2 transition",
            isDropTarget && "bg-[var(--jade-glow)] ring-1 ring-jade-dim"
          )}
          ref={dropRef}
        >
          {resources.map((resource, index) => (
            <ResourceCard
              commentBody={selectedResourceId === resource.id ? commentBody : ""}
              comments={commentsByResourceId[resource.id] ?? resource.comments ?? []}
              disabled={disabled}
              index={index}
              isActive={selectedResourceId === resource.id}
              isSignedIn={isSignedIn}
              canEditResource={
                !isResourceResolving(resource.metadataStatus) &&
                (isVaultOwner ||
                  Boolean(isVaultEditor && resource.createdBy && resource.createdBy === currentUserId))
              }
              isVaultOwner={isVaultOwner}
              mediaVisible={mediaVisible}
              key={resource.id}
              onActivate={() => onActivateResource(resource.id)}
              onCommentBodyChange={onCommentBodyChange}
              onCreateTransferTargetSpace={onCreateTransferTargetSpace}
              onDelete={() => onDeleteResource(resource.id)}
              onFocusComments={() => onFocusResourceComments(resource.id)}
              onLoadTransferTargets={onLoadTransferTargets}
              onOpenDetails={() => onSelectResource(resource.id)}
              onSubmitComment={onSubmitComment}
              onToggleStar={() => onToggleResourceStar(resource.id)}
              onTransferResource={onTransferResource}
              resource={resource}
              spaceId={space.id}
              transferFocusSpaceId={transferFocusSpaceId}
              transferTargets={transferTargets}
            />
          ))}
          {resources.length === 0 && (
            canAddResource ? (
              <button
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-ink-800/35 p-4 text-center text-fg-dim transition hover:border-jade-dim hover:text-fg disabled:opacity-50"
                disabled={disabled}
                onClick={onAddResource}
                type="button"
              >
                <FolderPlus />
                <span className="text-sm font-medium">向此 Space 添加资源</span>
              </button>
            ) : (
              <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-ink-800/35 p-4 text-center text-fg-dim">
                <FolderPlus />
                <span className="text-sm font-medium">该 Space 还没有资源</span>
              </div>
            )
          )}
        </div>
      )}
    </section>
  )
}

function isResourceResolving(status: string) {
  return status === "pending" || status === "processing"
}

function SpaceActionsMenu({
  disabled,
  onDelete,
  onEdit,
  resourceCount,
  spaceName,
}: {
  disabled: boolean
  onDelete: () => void
  onEdit: () => void
  resourceCount: number
  spaceName: string
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const hasResources = resourceCount > 0

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" type="button" disabled={disabled}>
            <MoreVertical />
            <span className="sr-only">Space 操作</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="border-line bg-ink-850 text-fg">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            编辑
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault()
              if (hasResources) setDeleteConfirmOpen(true)
              else onDelete()
            }}
          >
            <Trash2 />
            删除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个 Space?</AlertDialogTitle>
            <AlertDialogDescription>
              {spaceName} 下还有 {resourceCount} 个 resource。删除后这些 resource 会从当前 Space 中移除，请再次确认。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDeleteConfirmOpen(false)
                onDelete()
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

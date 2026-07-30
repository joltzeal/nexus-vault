"use client"

import { useDroppable } from "@dnd-kit/react"
import { useSortable } from "@dnd-kit/react/sortable"
import { useState } from "react"
import {
  ChevronDown,
  Copy,
  FolderInput,
  FolderPlus,
  GripVertical,
  Info,
  LoaderCircle,
  ListChecks,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { toast } from "@/lib/toast"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { MarkdownContent } from "@/features/components/markdown-content"
import { ResourceCard } from "@/features/components/resource-card"
import { SpaceIcon, SpaceIconPicker } from "@/features/components/space-icon-picker"
import type { VaultResourceViewMode } from "@/features/components/vault-view-mode"
import type {
  Resource,
  ResourceAnnotationPatch,
  ResourceTransferTargetVault,
  Space,
} from "@/features/types"
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
  disabled,
  canAddResource,
  currentUserId,
  isVaultEditor,
  isVaultOwner,
  isSignedIn,
  mediaVisible,
  onAddResource,
  onActivateResource,
  onCreateTransferTargetSpace,
  onDeleteSpace,
  onEditSpace,
  onClearResourceAnnotation,
  onDeleteResource,
  onLoadTransferTargets,
  onMoveSpace,
  onResolveResourceMetadata,
  onSelectResource,
  onToggleResourceReadLater,
  onToggleCollapsed,
  onToggleResourceStar,
  onToggleResourceSelected,
  onToggleSelectionMode,
  onTransferResource,
  onUpdateResourceAnnotation,
  onUpdateIcon,
  resources,
  selectedResourceId,
  selectedResourceIds,
  selectionMode,
  space,
  spacePosition,
  transferFocusSpaceId,
  transferTargets,
  vaultId,
  vaultName,
  viewMode,
}: {
  collapsed: boolean
  disabled: boolean
  canAddResource: boolean
  currentUserId?: string
  isVaultEditor: boolean
  isVaultOwner: boolean
  isSignedIn: boolean
  mediaVisible: boolean
  onAddResource: () => void
  onActivateResource: (resourceId: string) => void
  onCreateTransferTargetSpace: (vaultId: string) => void
  onDeleteSpace: () => void
  onEditSpace: () => void
  onClearResourceAnnotation: (resourceId: string) => void
  onDeleteResource: (resourceId: string) => void
  onLoadTransferTargets: () => Promise<void>
  onMoveSpace: (targetVaultId: string) => Promise<void>
  onResolveResourceMetadata: (resourceId: string) => void
  onSelectResource: (resourceId: string) => void
  onToggleResourceReadLater: (resourceId: string) => void
  onToggleCollapsed: () => void
  onToggleResourceStar: (resourceId: string) => void
  onToggleResourceSelected: (resourceId: string, selected: boolean) => void
  onToggleSelectionMode: () => void
  onTransferResource: (input: {
    action: "move" | "copy"
    resourceId: string
    targetVaultId: string
    targetSpaceId: string
  }) => Promise<void>
  onUpdateResourceAnnotation: (resourceId: string, patch: ResourceAnnotationPatch) => void
  onUpdateIcon: (icon: string) => void
  resources: Resource[]
  selectedResourceId?: string
  selectedResourceIds: Set<string>
  selectionMode: boolean
  space: Space
  spacePosition: number
  transferFocusSpaceId?: string
  transferTargets: ResourceTransferTargetVault[]
  vaultId: string
  vaultName: string
  viewMode: VaultResourceViewMode
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
  const selectedCount = resources.filter((resource) =>
    selectedResourceIds.has(resource.id)
  ).length

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
          {selectedCount > 0 && (
            <span className="mono rounded-chip border border-jade-dim bg-[var(--jade-glow)] px-1.5 py-0.5 text-[10px] text-jade">
              已选 {selectedCount}
            </span>
          )}
          {space.description && (
            <HoverCard>
              <HoverCardTrigger
                delay={120}
                closeDelay={80}
                render={
                <span
                  className="inline-flex size-5 items-center justify-center text-fg-dim transition hover:text-jade [&_svg]:size-3.5"
                  tabIndex={0}
                >
                  <Info />
                  <span className="sr-only">Space 描述</span>
                </span>
                }
              />
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
        <div
          className={cn(
            "flex gap-1 opacity-0 transition hover:opacity-100 group-hover:opacity-100 md:group-hover:opacity-100",
            selectionMode && "opacity-100"
          )}
        >
          {isVaultOwner && resources.length > 0 && (
            <Button
              aria-label={selectionMode ? "退出多选模式" : "进入多选模式"}
              className={cn(
                "text-fg-dim hover:text-jade",
                selectionMode && "border-jade-dim bg-[var(--jade-glow)] text-jade"
              )}
              disabled={disabled}
              onClick={onToggleSelectionMode}
              size="icon-sm"
              title={selectionMode ? "退出多选" : "多选 Resource"}
              type="button"
              variant="ghost"
            >
              <ListChecks />
            </Button>
          )}
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
              <SpaceTransferDialog
                disabled={disabled}
                onLoadTargets={onLoadTransferTargets}
                onMove={onMoveSpace}
                sourceVaultId={vaultId}
                spaceName={space.name}
                targets={transferTargets}
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
            "min-h-20 rounded-input px-0 pt-2 transition",
            viewMode === "masonry" && resources.length > 0
              ? "columns-1 gap-2 sm:columns-2 xl:columns-3 2xl:columns-4 min-[1800px]:columns-5"
              : "flex flex-col gap-2",
            isDropTarget && "bg-[var(--jade-glow)] ring-1 ring-jade-dim"
          )}
          ref={dropRef}
        >
          {resources.map((resource, index) => (
            <ResourceCard
              className={viewMode === "masonry" ? "mb-2 [break-inside:avoid]" : undefined}
              disabled={disabled}
              index={index}
              isActive={selectedResourceId === resource.id}
              isSelected={selectedResourceIds.has(resource.id)}
              isSignedIn={isSignedIn}
              canDeleteResource={
                isVaultOwner ||
                Boolean(isVaultEditor && resource.createdBy && resource.createdBy === currentUserId)
              }
              canEditResource={
                !isResourceResolving(resource.metadataStatus) &&
                (isVaultOwner ||
                  Boolean(isVaultEditor && resource.createdBy && resource.createdBy === currentUserId))
              }
              isVaultOwner={isVaultOwner}
              mediaVisible={mediaVisible}
              key={resource.id}
              onActivate={() => onActivateResource(resource.id)}
              onClearAnnotation={() => onClearResourceAnnotation(resource.id)}
              onCreateTransferTargetSpace={onCreateTransferTargetSpace}
              onDelete={() => onDeleteResource(resource.id)}
              onLoadTransferTargets={onLoadTransferTargets}
              onOpenDetails={() => onSelectResource(resource.id)}
              onResolveMetadata={() => onResolveResourceMetadata(resource.id)}
              onToggleReadLater={() => onToggleResourceReadLater(resource.id)}
              onToggleSelected={(selected) =>
                onToggleResourceSelected(resource.id, selected)
              }
              onToggleStar={() => onToggleResourceStar(resource.id)}
              onTransferResource={onTransferResource}
              onUpdateAnnotation={(_, patch) => onUpdateResourceAnnotation(resource.id, patch)}
              resource={resource}
              showSelectionControl={selectionMode}
              spaceId={space.id}
              spaceName={space.name}
              transferFocusSpaceId={transferFocusSpaceId}
              transferTargets={transferTargets}
              vaultId={vaultId}
              vaultName={vaultName}
              viewMode={viewMode}
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

function SpaceTransferDialog({
  disabled,
  onLoadTargets,
  onMove,
  sourceVaultId,
  spaceName,
  targets,
}: {
  disabled: boolean
  onLoadTargets: () => Promise<void>
  onMove: (targetVaultId: string) => Promise<void>
  sourceVaultId: string
  spaceName: string
  targets: ResourceTransferTargetVault[]
}) {
  const [open, setOpen] = useState(false)
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [movingTargetId, setMovingTargetId] = useState("")
  const availableTargets = targets.filter((target) => target.id !== sourceVaultId)

  async function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen || targets.length > 0) return

    setLoadingTargets(true)
    try {
      await onLoadTargets()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "目标 Vault 加载失败。")
    } finally {
      setLoadingTargets(false)
    }
  }

  async function handleMove(targetVaultId: string) {
    if (movingTargetId) return

    setMovingTargetId(targetVaultId)
    try {
      setOpen(false)
      await onMove(targetVaultId)
    } catch {
      // The dashboard reports the API error.
    } finally {
      setMovingTargetId("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => void handleOpenChange(value)}>
      <Button
        aria-label="移动 Space 到其他 Vault"
        disabled={disabled}
        onClick={() => void handleOpenChange(true)}
        size="icon-sm"
        title="移动到其他 Vault"
        type="button"
        variant="ghost"
      >
        <FolderInput />
      </Button>
      <DialogContent className="max-h-[min(620px,calc(100dvh-2rem))] gap-0 overflow-hidden border-line bg-ink-850 p-0 text-fg sm:max-w-[460px]">
        <DialogHeader className="border-b border-line px-4 py-3">
          <DialogTitle className="font-display">移动 Space</DialogTitle>
          <DialogDescription className="truncate text-fg-dim">
            {spaceName}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(440px,calc(100dvh-12rem))] overflow-y-auto p-2">
          {loadingTargets ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-fg-dim">
              <LoaderCircle className="size-4 animate-spin text-jade" />
              正在加载 Vault...
            </div>
          ) : availableTargets.length > 0 ? (
            <div className="flex flex-col gap-1">
              {availableTargets.map((target) => {
                const moving = movingTargetId === target.id

                return (
                  <button
                    className="flex min-h-11 w-full items-center gap-3 rounded-input px-3 py-2 text-left transition hover:bg-ink-800 disabled:pointer-events-none disabled:opacity-60"
                    disabled={Boolean(movingTargetId)}
                    key={target.id}
                    onClick={() => void handleMove(target.id)}
                    type="button"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-input border border-line-soft bg-ink-900 text-jade">
                      {moving ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <FolderInput className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-fg">
                        {target.title}
                      </span>
                      <span className="mono block text-[10px] text-fg-dim">
                        {target.spaces.length} Spaces
                      </span>
                    </span>
                    <span className="text-xs text-jade">{moving ? "移动中" : "移动"}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex min-h-32 items-center justify-center rounded-input border border-dashed border-line px-4 text-center text-sm text-fg-dim">
              没有其他自己拥有的 Vault
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
        <DropdownMenuTrigger
          render={
          <Button size="icon-sm" variant="ghost" type="button" disabled={disabled}>
            <MoreVertical />
            <span className="sr-only">Space 操作</span>
          </Button>
          }
        />
        <DropdownMenuContent align="end" className="border-line bg-ink-850 text-fg">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil />
            编辑
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
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

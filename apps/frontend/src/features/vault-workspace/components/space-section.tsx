"use client"

import { useDroppable } from "@dnd-kit/react"
import { useSortable } from "@dnd-kit/react/sortable"
import { useState } from "react"
import {
  ChevronDown,
  FolderPlus,
  GripVertical,
  Info,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"

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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { MarkdownContent } from "@/features/vault-workspace/components/markdown-content"
import { ResourceCard } from "@/features/vault-workspace/components/resource-card"
import { SpaceIconPicker } from "@/features/vault-workspace/components/space-icon-picker"
import type { CommentItem } from "@/features/vault-workspace/components/vault-settings-sheet"
import type { Resource, Space } from "@/features/vault-workspace/types"
import { cn } from "@/lib/utils"
import type { ResourceDragData } from "./resource-card"

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
  comments,
  disabled,
  isVaultOwner,
  isSignedIn,
  onAddResource,
  onCommentBodyChange,
  onDeleteSpace,
  onEditSpace,
  onDeleteResource,
  onFocusResourceComments,
  onRequireSignIn,
  onSelectResource,
  onSubmitComment,
  onToggleCollapsed,
  onUpdateIcon,
  resources,
  selectedResourceId,
  space,
  spacePosition,
}: {
  collapsed: boolean
  commentBody: string
  comments: CommentItem[]
  disabled: boolean
  isVaultOwner: boolean
  isSignedIn: boolean
  onAddResource: () => void
  onCommentBodyChange: (value: string) => void
  onDeleteSpace: () => void
  onEditSpace: () => void
  onDeleteResource: (resourceId: string) => void
  onFocusResourceComments: (resourceId: string) => void
  onRequireSignIn: () => void
  onSelectResource: (resourceId: string) => void
  onSubmitComment: () => void
  onToggleCollapsed: () => void
  onUpdateIcon: (icon: string) => void
  resources: Resource[]
  selectedResourceId?: string
  space: Space
  spacePosition: number
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

  return (
    <section
      className={cn(
        "group mb-3 scroll-mt-4 rounded-card border border-line bg-ink-900/35 px-2 pb-2",
        collapsed && "opacity-95"
      )}
      id={space.id}
      ref={ref}
      data-space-section
    >
      <div className="sticky top-0 z-10 mt-2 flex items-center gap-2 rounded-input bg-[linear-gradient(var(--ink-900),var(--ink-900)_70%,transparent)] px-2 py-2">
        {isVaultOwner && (
          <button
            className="grid w-4 cursor-grab place-items-center text-fg-faint opacity-0 transition hover:text-fg-muted group-hover:opacity-100 active:cursor-grabbing disabled:cursor-not-allowed"
            disabled={disabled}
            ref={handleRef}
            type="button"
          >
            <GripVertical />
            <span className="sr-only">拖动排序 Space</span>
          </button>
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
          <SpaceIconPicker
            disabled={disabled || !isVaultOwner}
            onSelect={onUpdateIcon}
            value={space.icon}
          />
          <h2 className="truncate font-display text-[15.5px] font-semibold">{space.name}</h2>
          <span className="mono text-[11px] text-fg-dim">{resources.length}</span>
          {space.description && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="inline-flex size-5 items-center justify-center rounded-sm text-fg-dim transition hover:bg-ink-750 hover:text-jade"
                  type="button"
                >
                  <Info />
                  <span className="sr-only">Space 描述</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-80 border-line bg-ink-850 p-3 text-fg">
                <MarkdownContent value={space.description} />
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="flex gap-1 opacity-0 transition hover:opacity-100 group-hover:opacity-100 md:group-hover:opacity-100">
          {isVaultOwner && (
            <Button size="icon-sm" variant="ghost" onClick={onAddResource} disabled={disabled}>
              <Plus />
              <span className="sr-only">此 Space 添加资源</span>
            </Button>
          )}
          <SpaceActionsMenu
            disabled={disabled || !isVaultOwner}
            onDelete={onDeleteSpace}
            onEdit={onEditSpace}
            resourceCount={resources.length}
            spaceName={space.name}
          />
        </div>
      </div>
      <div className="mx-2 h-px bg-line-soft" />
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
              comments={selectedResourceId === resource.id ? comments : []}
              disabled={disabled}
              index={index}
              isActive={selectedResourceId === resource.id}
              isSignedIn={isSignedIn}
              isVaultOwner={isVaultOwner}
              key={resource.id}
              onCommentBodyChange={onCommentBodyChange}
              onDelete={() => onDeleteResource(resource.id)}
              onFocusComments={() => onFocusResourceComments(resource.id)}
              onRequireSignIn={onRequireSignIn}
              onSelect={() => onSelectResource(resource.id)}
              onSubmitComment={onSubmitComment}
              resource={resource}
              spaceId={space.id}
            />
          ))}
          {resources.length === 0 && (
            isVaultOwner ? (
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

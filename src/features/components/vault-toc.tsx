"use client"

import { useState } from "react"
import {
  ChevronsDownUp,
  ChevronsUpDown,
  LayoutGrid,
  List,
  ListTree,
  Plus,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ResourceTransferDialog } from "@/features/components/resource-card"
import type { VaultResourceViewMode } from "@/features/components/vault-view-mode"
import type { Resource, ResourceTransferTargetVault, Space } from "@/features/types"
import { cn } from "@/lib/utils"

export function VaultToc({
  activeSpaceId,
  disabled,
  isVaultOwner,
  onClearResourceSelection,
  onAddSpace,
  onCreateTransferTargetSpace,
  onJump,
  onLoadTransferTargets,
  onTransferSelectedResources,
  onToggleAllSpaces,
  onViewModeChange,
  resources,
  selectedResourceCount = 0,
  selectedResourceSourceSpaceId = "",
  spaces,
  spacesCollapsed,
  transferFocusSpaceId,
  transferTargets,
  viewMode,
}: {
  activeSpaceId: string
  disabled: boolean
  isVaultOwner: boolean
  onClearResourceSelection: () => void
  onAddSpace: () => void
  onCreateTransferTargetSpace: (vaultId: string) => void
  onJump: (spaceId: string) => void
  onLoadTransferTargets: () => Promise<void>
  onTransferSelectedResources: (input: {
    action: "move" | "copy"
    targetVaultId: string
    targetSpaceId: string
  }) => Promise<void>
  onToggleAllSpaces: () => void
  onViewModeChange: (mode: VaultResourceViewMode) => void
  resources: Resource[]
  selectedResourceCount?: number
  selectedResourceSourceSpaceId?: string
  spaces: Space[]
  spacesCollapsed: boolean
  transferFocusSpaceId?: string
  transferTargets: ResourceTransferTargetVault[]
  viewMode: VaultResourceViewMode
}) {
  function renderOutlineList() {
    return (
      <div className="relative flex flex-col gap-px before:absolute before:bottom-1.5 before:left-2 before:top-1.5 before:w-px before:bg-line">
        {spaces.map((space) => (
          <button
            className={cn(
              "relative flex items-center gap-2 rounded-input py-1.5 pl-[18px] pr-2 text-left text-[12.5px] text-fg-dim transition before:absolute before:left-[5px] before:top-1/2 before:size-[7px] before:-translate-y-1/2 before:rounded-full before:border-2 before:border-ink-850 before:bg-ink-700 hover:bg-ink-800 hover:text-fg",
              activeSpaceId === space.id && "bg-ink-800 text-jade-bright before:bg-jade before:shadow-[0_0_0_3px_var(--jade-glow)]"
            )}
            key={space.id}
            onClick={() => onJump(space.id)}
            type="button"
          >
            <span className="min-w-0 flex-1 truncate">{space.name}</span>
            <span className="mono text-[10px] text-fg-faint">
              {resources.filter((resource) => resource.spaceId === space.id).length}
            </span>
          </button>
        ))}
        {spaces.length === 0 && (
          <div className="rounded-input border border-dashed border-line px-3 py-4 text-center text-[12px] text-fg-dim">
            还没有 Space
          </div>
        )}
      </div>
    )
  }

  function renderAddSpaceButton() {
    if (!isVaultOwner) return null

    return (
      <Button
        className="min-w-0 flex-1 justify-center"
        disabled={disabled}
        onClick={onAddSpace}
        size="sm"
        variant="outline"
      >
        <Plus data-icon="inline-start" />
        Space
      </Button>
    )
  }

  function renderToggleSpacesButton() {
    if (spaces.length === 0) return null

    return (
      <Button
        className="min-w-0 flex-1 justify-center"
        size="sm"
        variant="ghost"
        onClick={onToggleAllSpaces}
        type="button"
      >
        {spacesCollapsed ? (
          <ChevronsUpDown data-icon="inline-start" />
        ) : (
          <ChevronsDownUp data-icon="inline-start" />
        )}
        {spacesCollapsed ? "展开全部" : "收起全部"}
      </Button>
    )
  }

  function renderOutlineActions() {
    if (spaces.length === 0 && !isVaultOwner) return null

    return (
      <>
        <ButtonGroup className="w-full">
          <Button
            aria-label="列表视图"
            className={cn(
              "min-w-0 flex-1 justify-center",
              viewMode === "list" && "border-jade-dim bg-[var(--jade-glow)] text-jade"
            )}
            onClick={() => onViewModeChange("list")}
            size="sm"
            title="列表视图"
            type="button"
            variant="outline"
          >
            <List data-icon="inline-start" />
            列表
          </Button>
          <Button
            aria-label="卡片瀑布流视图"
            className={cn(
              "min-w-0 flex-1 justify-center",
              viewMode === "masonry" && "border-jade-dim bg-[var(--jade-glow)] text-jade"
            )}
            onClick={() => onViewModeChange("masonry")}
            size="sm"
            title="卡片瀑布流视图"
            type="button"
            variant="outline"
          >
            <LayoutGrid data-icon="inline-start" />
            卡片
          </Button>
        </ButtonGroup>
        <div className="flex min-w-0 items-center gap-1">
          {renderToggleSpacesButton()}
          {isVaultOwner && renderAddSpaceButton()}
        </div>
      </>
    )
  }

  function renderBulkResourceActions() {
    if (!isVaultOwner || selectedResourceCount === 0 || !selectedResourceSourceSpaceId) {
      return null
    }

    return (
      <BulkResourceActions
        count={selectedResourceCount}
        disabled={disabled}
        focusedSpaceId={transferFocusSpaceId}
        onClear={onClearResourceSelection}
        onCreateSpace={onCreateTransferTargetSpace}
        onLoadTargets={onLoadTransferTargets}
        onTransfer={onTransferSelectedResources}
        sourceSpaceId={selectedResourceSourceSpaceId}
        targets={transferTargets}
      />
    )
  }

  return (
    <>
      <aside className="pointer-events-none fixed right-4 top-[72px] z-20 hidden w-[188px] flex-col gap-2 lg:flex">
        <nav className="pointer-events-auto max-h-[42vh] overflow-auto rounded-card border border-line bg-ink-850/95 p-2.5 shadow-pop backdrop-blur">
          <div className="mono flex items-center gap-1.5 px-1.5 pb-2 text-[10px] uppercase tracking-[.16em] text-fg-dim">
            Outline
          </div>
          {renderOutlineList()}
        </nav>
        {(spaces.length > 0 || isVaultOwner || selectedResourceCount > 0) && (
          <div className="pointer-events-auto flex flex-col gap-2 rounded-card border border-line bg-ink-850/95 p-2 shadow-pop backdrop-blur">
            {renderOutlineActions()}
            {renderBulkResourceActions()}
          </div>
        )}
      </aside>
      <Popover>
        <PopoverTrigger
          render={
          <Button
            aria-label="打开大纲"
            className="fixed bottom-4 right-4 z-50 gap-1.5 shadow-pop lg:hidden"
            size="sm"
            variant="outline"
            type="button"
          >
            <ListTree data-icon="inline-start" />
            Outline
          </Button>
          }
        />
        <PopoverContent
          align="end"
          className="max-h-[58vh] w-[min(18rem,calc(100vw-2rem))] overflow-auto border-line bg-ink-850 p-2.5 text-fg shadow-pop"
          side="top"
          sideOffset={10}
        >
          <div className="mono flex items-center gap-1.5 px-1.5 pb-2 text-[10px] uppercase tracking-[.16em] text-fg-dim">
            Outline
          </div>
          {renderOutlineList()}
          {(spaces.length > 0 || isVaultOwner || selectedResourceCount > 0) && (
            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-2">
              {renderOutlineActions()}
              {renderBulkResourceActions()}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  )
}

function BulkResourceActions({
  count,
  disabled,
  focusedSpaceId,
  onClear,
  onCreateSpace,
  onLoadTargets,
  onTransfer,
  sourceSpaceId,
  targets,
}: {
  count: number
  disabled: boolean
  focusedSpaceId?: string
  onClear: () => void
  onCreateSpace: (vaultId: string) => void
  onLoadTargets: () => Promise<void>
  onTransfer: (input: {
    action: "move" | "copy"
    targetVaultId: string
    targetSpaceId: string
  }) => Promise<void>
  sourceSpaceId: string
  targets: ResourceTransferTargetVault[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-input border border-jade-dim bg-[var(--jade-glow)] p-1.5">
      <div className="mono mb-1.5 truncate px-1 text-[10px] text-jade">
        已选 {count} 个 Resource
      </div>
      <div className="flex min-w-0 items-center gap-1">
        <ResourceTransferDialog
          disabled={disabled}
          focusedSpaceId={focusedSpaceId}
          onCreateSpace={onCreateSpace}
          onLoadTargets={onLoadTargets}
          onOpenChange={setOpen}
          onTransfer={onTransfer}
          open={open}
          resourceTitle={`已选择 ${count} 个 Resource`}
          showTriggerLabel
          sourceSpaceId={sourceSpaceId}
          targets={targets}
          triggerClassName="min-w-0 flex-1 justify-center rounded-sm border-jade-dim bg-ink-900/70 text-jade hover:bg-ink-850 hover:text-jade-bright"
          triggerLabel="移动/复制"
          triggerSize="sm"
        />
        <Button
          aria-label="取消选择 Resource"
          className="size-7 rounded-sm text-fg-dim hover:text-fg [&_svg]:size-3.5"
          onClick={onClear}
          size="icon-sm"
          title="取消选择"
          type="button"
          variant="ghost"
        >
          <X />
        </Button>
      </div>
    </div>
  )
}

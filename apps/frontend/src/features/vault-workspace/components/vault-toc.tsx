"use client"

import { ListTree, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Resource, Space } from "@/features/vault-workspace/types"
import { cn } from "@/lib/utils"

export function VaultToc({
  activeSpaceId,
  disabled,
  isVaultOwner,
  onAddSpace,
  onJump,
  resources,
  spaces,
}: {
  activeSpaceId: string
  disabled: boolean
  isVaultOwner: boolean
  onAddSpace: () => void
  onJump: (spaceId: string) => void
  resources: Resource[]
  spaces: Space[]
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
      <Button className="w-full justify-center" size="sm" variant="outline" onClick={onAddSpace} disabled={disabled}>
        <Plus data-icon="inline-start" />
        新建 Space
      </Button>
    )
  }

  return (
    <>
      <aside className="pointer-events-none fixed right-4 top-[72px] z-20 hidden w-[188px] flex-col gap-2 2xl:flex">
        <nav className="pointer-events-auto max-h-[42vh] overflow-auto rounded-card border border-line bg-ink-850/95 p-2.5 shadow-pop backdrop-blur">
          <div className="mono flex items-center gap-1.5 px-1.5 pb-2 text-[10px] uppercase tracking-[.16em] text-fg-dim">
            Outline
          </div>
          {renderOutlineList()}
        </nav>
        {isVaultOwner && (
          <div className="pointer-events-auto rounded-card border border-line bg-ink-850/95 p-2 shadow-pop backdrop-blur">
            {renderAddSpaceButton()}
          </div>
        )}
      </aside>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            aria-label="打开大纲"
            className="fixed bottom-4 right-4 z-30 shadow-pop 2xl:hidden"
            size="icon"
            variant="outline"
            type="button"
          >
            <ListTree />
          </Button>
        </PopoverTrigger>
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
          {isVaultOwner && <div className="mt-2 border-t border-line pt-2">{renderAddSpaceButton()}</div>}
        </PopoverContent>
      </Popover>
    </>
  )
}

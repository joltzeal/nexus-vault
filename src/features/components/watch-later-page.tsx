"use client"

import { DragDropProvider } from "@dnd-kit/react"
import { Clock3 } from "lucide-react"
import { useRef, useState } from "react"

import { ResourceCard } from "@/features/components/resource-card"
import { ScrollToTopButton } from "@/features/components/scroll-to-top-button"
import type {
  ReadLaterResourceItem,
  ResourceAnnotationPatch,
} from "@/features/types"

export function WatchLaterPage({
  isSignedIn,
  items,
  mediaVisible,
  onClearResourceAnnotation,
  onToggleReadLater,
  onToggleResourceStar,
  onUpdateResourceAnnotation,
}: {
  isSignedIn: boolean
  items: ReadLaterResourceItem[]
  mediaVisible: boolean
  onClearResourceAnnotation: (resourceId: string) => void
  onToggleReadLater: (resourceId: string) => void
  onToggleResourceStar: (resourceId: string) => void
  onUpdateResourceAnnotation: (resourceId: string, patch: ResourceAnnotationPatch) => void
}) {
  const mainRef = useRef<HTMLElement>(null)
  const [activeResourceId, setActiveResourceId] = useState("")

  return (
    <main className="h-full min-h-0 overflow-auto bg-background" ref={mainRef}>
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-5 px-4 py-5 pb-20 md:px-7">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line-soft pb-4">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.16em] text-fg-dim">
              Watch Later
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-fg">
              稍后查看
            </h1>
            <p className="mt-1 text-sm text-fg-dim">
              临时收起想回头处理的 resource，清单会保存到你的账号。
            </p>
          </div>
          <div className="rounded-input border border-line bg-ink-850 px-3 py-2">
            <p className="mono text-[10px] uppercase tracking-[.14em] text-fg-dim">
              Resource
            </p>
            <p className="mt-0.5 text-lg font-semibold leading-none text-fg">
              {items.length}
            </p>
          </div>
        </header>

        {items.length > 0 ? (
          <DragDropProvider>
            <div className="flex flex-col gap-2">
              {items.map((item, index) => (
                <div className="flex flex-col gap-1.5" key={`${item.vaultId}:${item.resourceId}`}>
                  <div className="flex min-w-0 items-center gap-2 px-1 text-[11px] text-fg-dim">
                    <span className="truncate font-medium text-fg-muted">
                      {item.vaultName}
                    </span>
                    <span>/</span>
                    <span className="truncate">{item.spaceName}</span>
                  </div>
                  <ResourceCard
                    canEditResource={false}
                    disabled
                    index={index}
                    isActive={activeResourceId === item.resourceId}
                    isSignedIn={isSignedIn}
                    isVaultOwner={false}
                    mediaVisible={mediaVisible}
                    onActivate={() => setActiveResourceId(item.resourceId)}
                    onClearAnnotation={onClearResourceAnnotation}
                    onCreateTransferTargetSpace={() => undefined}
                    onDelete={() => undefined}
                    onLoadTransferTargets={() => Promise.resolve()}
                    onOpenDetails={() => setActiveResourceId(item.resourceId)}
                    onToggleReadLater={onToggleReadLater}
                    onToggleStar={() => onToggleResourceStar(item.resourceId)}
                    onTransferResource={() => Promise.resolve()}
                    onUpdateAnnotation={onUpdateResourceAnnotation}
                    resource={item.resource}
                    showStarAction={false}
                    spaceId={item.spaceId}
                    spaceName={item.spaceName}
                    transferTargets={[]}
                    vaultId={item.vaultId}
                    vaultName={item.vaultName}
                  />
                </div>
              ))}
            </div>
          </DragDropProvider>
        ) : (
          <EmptyWatchLaterState />
        )}
      </div>
      <ScrollToTopButton scrollRef={mainRef} />
    </main>
  )
}

function EmptyWatchLaterState() {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-ink-800/35 px-4 py-10 text-center text-sm text-fg-dim">
      <span className="grid size-10 place-items-center rounded-input border border-line bg-ink-850 text-jade">
        <Clock3 />
      </span>
      <span className="font-medium text-fg-muted">还没有稍后查看的 resource</span>
      <span>在任意 resource 卡片上点击 Watch Later 后，会出现在这里。</span>
    </div>
  )
}

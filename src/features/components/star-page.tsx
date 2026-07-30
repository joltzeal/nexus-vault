"use client"

import { DragDropProvider } from "@dnd-kit/react"
import { Star } from "lucide-react"
import { useRef, useState } from "react"

import { ResourceCard } from "@/features/components/resource-card"
import { ScrollToTopButton } from "@/features/components/scroll-to-top-button"
import type {
  Resource,
  StarredResourceItem,
} from "@/features/types"
import { normalizeResourceMetadata } from "@/domain/resources/metadata"

export function StarPage({
  isSignedIn,
  mediaVisible,
  onResourceUnstar,
  resourceItems,
}: {
  isSignedIn: boolean
  mediaVisible: boolean
  onResourceUnstar: (sourceResourceId: string) => void
  resourceItems: StarredResourceItem[]
}) {
  const mainRef = useRef<HTMLElement>(null)
  const [activeResourceId, setActiveResourceId] = useState("")

  return (
    <main className="h-full min-h-0 overflow-auto bg-background" ref={mainRef}>
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-5 px-4 py-5 pb-20 md:px-7">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line-soft pb-4">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.16em] text-fg-dim">Star</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-fg">Resource 收藏</h1>
            <p className="mt-1 text-sm text-fg-dim">
              这里只展示你收藏的 resource；收藏的 vault 会保留在左侧 Starred vaults 分组。
            </p>
          </div>
          <div className="rounded-input border border-line bg-ink-850 px-3 py-2">
            <p className="mono text-[10px] uppercase tracking-[.14em] text-fg-dim">Resource</p>
            <p className="mt-0.5 text-lg font-semibold leading-none text-fg">
              {resourceItems.length}
            </p>
          </div>
        </header>

        {resourceItems.length > 0 ? (
          <DragDropProvider>
            <div className="flex flex-col gap-2">
              {resourceItems.map((item, index) => {
                const resource = toResource(item)

                return (
                  <ResourceCard
                    key={item.id}
                    canEditResource={false}
                    disabled
                    index={index}
                    isActive={activeResourceId === item.sourceResourceId}
                    isSignedIn={isSignedIn}
                    isVaultOwner={false}
                    mediaVisible={mediaVisible}
                    onActivate={() => setActiveResourceId(item.sourceResourceId)}
                    onCreateTransferTargetSpace={() => undefined}
                    onDelete={() => undefined}
                    onLoadTransferTargets={() => Promise.resolve()}
                    onOpenDetails={() => setActiveResourceId(item.sourceResourceId)}
                    onToggleStar={() => onResourceUnstar(item.sourceResourceId)}
                    onTransferResource={() => Promise.resolve()}
                    resource={resource}
                    showAnnotationActions={false}
                    showReadLaterAction={false}
                    spaceId={item.sourceSpaceId ?? "starred-resources"}
                    spaceName={item.sourceSpaceName ?? ""}
                    transferTargets={[]}
                    vaultId={item.sourceVaultId}
                    vaultName={item.sourceVaultTitle ?? ""}
                  />
                )
              })}
            </div>
          </DragDropProvider>
        ) : (
          <EmptyStarState />
        )}
      </div>
      <ScrollToTopButton scrollRef={mainRef} />
    </main>
  )
}

function EmptyStarState() {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-ink-800/35 px-4 py-10 text-center text-sm text-fg-dim">
      <span className="grid size-10 place-items-center rounded-input border border-line bg-ink-850 text-jade">
        <Star />
      </span>
      <span className="font-medium text-fg-muted">还没有收藏 resource</span>
      <span>在任意 resource 卡片上点击 Star 后，会出现在这里。</span>
    </div>
  )
}

function toResource(item: StarredResourceItem): Resource {
  const metadata = normalizeResourceMetadata(item.metadataDataJson)

  return {
    id: item.sourceResourceId,
    spaceId: item.sourceSpaceId ?? "",
    title: item.title,
    type: item.type,
    url: item.url,
    description: item.description,
    metadataStatus: item.metadataStatus,
    metadata: item.metadataProvider
      ? {
          provider: item.metadataProvider,
          data: metadata,
          errorMessage: item.metadataErrorMessage,
        }
      : null,
    isStarred: true,
    position: 0,
    createdAt: item.sourceCreatedAt ?? item.createdAt,
  }
}

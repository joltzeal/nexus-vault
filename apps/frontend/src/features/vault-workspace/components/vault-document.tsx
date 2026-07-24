"use client"

import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react"
import { isSortableOperation } from "@dnd-kit/react/sortable"
import { Database, FolderPlus, LoaderCircle, Plus } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { VaultHeader } from "@/features/vault-workspace/components/vault-header"
import { SpaceSection, type BoardDragData } from "@/features/vault-workspace/components/space-section"
import { VaultToc } from "@/features/vault-workspace/components/vault-toc"
import type {
  CommentItem,
  Resource,
  ResourceSet,
  ResourceTransferTargetVault,
} from "@/features/vault-workspace/types"
import { getSortedSpaces, groupResourcesBySpace } from "./view-models"

export function VaultDocument({
  activeSet,
  canAddResource,
  collaboratorsCount,
  commentBody,
  commentsByResourceId,
  currentUserId,
  isSignedIn,
  isVaultEditor,
  isVaultLoading,
  isVaultOwner,
  isShareMode,
  mediaVisible,
  onAddResource,
  onAddResourceToSpace,
  onAddSpace,
  onActivateResource,
  onCreateTransferTargetSpace,
  onCreateVault,
  onCommentBodyChange,
  onDeleteResource,
  onDeleteSpace,
  onDeleteVault,
  onEditVault,
  onEditSpace,
  onForkVault,
  onFocusResourceComments,
  onLoadTransferTargets,
  onMoveResource,
  onOpenSettings,
  onReorderSpace,
  onSelectResource,
  onSubmitComment,
  onToggleMediaVisibility,
  onToggleResourceStar,
  onToggleStar,
  onTransferResource,
  onUpdateSpaceIcon,
  pendingSubmissionCount,
  selectedResourceId,
  shareSubmissionSlot,
  transferFocusSpaceId,
  transferTargets,
}: {
  activeSet?: ResourceSet
  canAddResource: boolean
  collaboratorsCount: number
  commentBody: string
  commentsByResourceId: Record<string, CommentItem[]>
  currentUserId?: string
  isSignedIn: boolean
  isVaultEditor: boolean
  isVaultLoading: boolean
  isVaultOwner: boolean
  isShareMode: boolean
  mediaVisible: boolean
  onAddResource: () => void
  onAddResourceToSpace: (spaceId: string) => void
  onAddSpace: () => void
  onActivateResource: (resourceId: string) => void
  onCreateTransferTargetSpace: (vaultId: string) => void
  onCreateVault: () => void
  onCommentBodyChange: (value: string) => void
  onDeleteResource: (resourceId: string) => void
  onDeleteSpace: (spaceId: string) => void
  onDeleteVault: () => void
  onEditVault: () => void
  onEditSpace: (space: ResourceSet["spaces"][number]) => void
  onForkVault: () => void
  onFocusResourceComments: (resourceId: string) => void
  onLoadTransferTargets: () => Promise<void>
  onMoveResource: (input: {
    resourceId: string
    sourceSpaceId: string
    targetSpaceId: string
    position: number
  }) => void
  onOpenSettings: (tab: "share" | "members" | "submissions") => void
  onReorderSpace: (input: { spaceId: string; position: number }) => void
  onSelectResource: (resourceId: string) => void
  onSubmitComment: () => void
  onToggleMediaVisibility: (visible: boolean) => void
  onToggleResourceStar: (resourceId: string) => void
  onToggleStar: () => void
  onTransferResource: (input: {
    action: "move" | "copy"
    resourceId: string
    targetVaultId: string
    targetSpaceId: string
  }) => Promise<void>
  onUpdateSpaceIcon: (spaceId: string, icon: string) => void
  pendingSubmissionCount: number
  selectedResourceId?: string
  shareSubmissionSlot?: ReactNode
  transferFocusSpaceId?: string
  transferTargets: ResourceTransferTargetVault[]
}) {
  const mainRef = useRef<HTMLDivElement>(null)
  const [activeSpaceId, setActiveSpaceId] = useState("")
  const [collapsedSpaceIds, setCollapsedSpaceIds] = useState<Set<string>>(new Set())
  const spaces = useMemo(() => getSortedSpaces(activeSet), [activeSet])
  const allSpacesCollapsed =
    spaces.length > 0 && spaces.every((space) => collapsedSpaceIds.has(space.id))
  const groupedResources = useMemo(
    () => groupResourcesBySpace(activeSet?.resources ?? [], spaces),
    [activeSet?.resources, spaces]
  )

  useEffect(() => {
    setActiveSpaceId((current) => current || spaces[0]?.id || "")
  }, [spaces])

  useEffect(() => {
    const root = mainRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible?.target.id) setActiveSpaceId(visible.target.id)
      },
      { root, rootMargin: "-20% 0px -70% 0px", threshold: [0, 1] }
    )

    for (const space of spaces) {
      const element = root.querySelector<HTMLElement>(`#${CSS.escape(space.id)}`)
      if (element) observer.observe(element)
    }

    return () => observer.disconnect()
  }, [spaces])

  function handleDragEnd(event: DragEndEvent) {
    if (event.canceled || !activeSet) return

    const source = event.operation.source?.data as BoardDragData | undefined
    if (!source) return

    if (!isSortableOperation(event.operation)) {
      const target = event.operation.target?.data as BoardDragData | undefined
      if (source.kind === "resource" && target?.kind === "space-drop") {
        const targetResources = groupedResources.get(target.spaceId) ?? []
        onMoveResource({
          resourceId: source.resourceId,
          sourceSpaceId: source.sourceSpaceId,
          targetSpaceId: target.spaceId,
          position: targetResources.length,
        })
      }
      return
    }

    const sortableSource = event.operation.source?.sortable
    if (!sortableSource) return
    const initialIndex = sortableSource.initialIndex
    const nextIndex = sortableSource.index

    if (source.kind === "space") {
      if (initialIndex === nextIndex) return
      if (sortableSource.initialGroup !== "spaces" || sortableSource.group !== "spaces") return
      onReorderSpace({ spaceId: source.spaceId, position: nextIndex })
      return
    }

    if (source.kind !== "resource") return

    const targetSpaceId = String(sortableSource.group ?? source.sourceSpaceId)
    if (source.sourceSpaceId === targetSpaceId && initialIndex === nextIndex) return
    onMoveResource({
      resourceId: source.resourceId,
      sourceSpaceId: source.sourceSpaceId,
      targetSpaceId,
      position: nextIndex,
    })
  }

  function toggleAllSpaces() {
    setCollapsedSpaceIds((current) => {
      const shouldExpandAll =
        spaces.length > 0 && spaces.every((space) => current.has(space.id))
      return shouldExpandAll ? new Set() : new Set(spaces.map((space) => space.id))
    })
  }

  function jumpToSpace(spaceId: string) {
    const root = mainRef.current
    const element = root?.querySelector<HTMLElement>(`#${CSS.escape(spaceId)}`)
    if (!root || !element) return
    root.scrollTo({ top: element.offsetTop - 8, behavior: "smooth" })
    setActiveSpaceId(spaceId)
  }

  return (
    <>
      <main className="h-full min-h-0 overflow-auto scroll-smooth" ref={mainRef}>
        <div className="mx-auto w-full max-w-[1120px] px-4 py-5 pb-20 md:px-7 2xl:pr-[236px]">
          <VaultHeader
            collaboratorsCount={collaboratorsCount}
            disabled={!isSignedIn}
            canAddResource={canAddResource}
            isVaultOwner={isVaultOwner}
            isShareMode={isShareMode}
            mediaVisible={mediaVisible}
            onAddResource={onAddResource}
            onCreateSpace={onAddSpace}
            onDeleteVault={onDeleteVault}
            onEditVault={onEditVault}
            onForkVault={onForkVault}
            onOpenSettings={onOpenSettings}
            onToggleMediaVisibility={onToggleMediaVisibility}
            onToggleStar={onToggleStar}
            pendingSubmissionCount={pendingSubmissionCount}
            set={activeSet}
          />
          {shareSubmissionSlot}
          {activeSet && isVaultLoading ? (
            <div className="mt-4 flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-card border border-line bg-ink-800/45 text-fg-dim">
              <LoaderCircle className="size-5 animate-spin text-jade" />
              <span className="text-sm">正在加载 Vault...</span>
            </div>
          ) : activeSet ? (
            <DragDropProvider onDragEnd={handleDragEnd}>
              <section className="mt-3.5">
                {spaces.map((space, index) => (
                  <SpaceSection
                    collapsed={collapsedSpaceIds.has(space.id)}
                    commentBody={commentBody}
              commentsByResourceId={commentsByResourceId}
                    disabled={!isSignedIn}
                    canAddResource={canAddResource}
                    currentUserId={currentUserId}
                    isVaultEditor={isVaultEditor}
                    isVaultOwner={isVaultOwner}
                    isSignedIn={isSignedIn}
                    mediaVisible={mediaVisible}
                    key={space.id}
                    onAddResource={() => onAddResourceToSpace(space.id)}
                    onActivateResource={onActivateResource}
                    onCommentBodyChange={onCommentBodyChange}
                    onCreateTransferTargetSpace={onCreateTransferTargetSpace}
                    onDeleteSpace={() => onDeleteSpace(space.id)}
                    onEditSpace={() => onEditSpace(space)}
                    onDeleteResource={onDeleteResource}
                    onFocusResourceComments={onFocusResourceComments}
                    onLoadTransferTargets={onLoadTransferTargets}
                    onSelectResource={onSelectResource}
                    onSubmitComment={onSubmitComment}
                    onToggleResourceStar={onToggleResourceStar}
                    onTransferResource={onTransferResource}
                    onToggleCollapsed={() =>
                      setCollapsedSpaceIds((current) => {
                        const next = new Set(current)
                        if (next.has(space.id)) next.delete(space.id)
                        else next.add(space.id)
                        return next
                      })
                    }
                    onUpdateIcon={(icon) => onUpdateSpaceIcon(space.id, icon)}
                    resources={groupedResources.get(space.id) ?? []}
                    selectedResourceId={selectedResourceId}
                    space={space}
                    spacePosition={index}
                    transferFocusSpaceId={transferFocusSpaceId}
                    transferTargets={transferTargets}
                  />
                ))}
                {spaces.length === 0 && (
                  isVaultOwner ? (
                    <button
                      className="mt-4 flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-ink-800/35 p-4 text-center text-fg-dim transition hover:border-jade-dim hover:text-fg disabled:opacity-50"
                      disabled={!isSignedIn}
                      onClick={onAddSpace}
                      type="button"
                    >
                      <FolderPlus />
                      <span className="text-sm font-semibold">添加 Space</span>
                    </button>
                  ) : (
                    <div className="mt-4 flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-ink-800/35 p-4 text-center text-fg-dim">
                      <FolderPlus />
                      <span className="text-sm font-semibold">该 Vault 还没有 Space</span>
                    </div>
                  )
                )}
              </section>
            </DragDropProvider>
          ) : (
            <div className="mt-8 rounded-card border border-line bg-ink-800 p-6 text-center">
              <div className="mx-auto grid size-10 place-items-center rounded-card border border-line-soft bg-ink-850 text-jade">
                <Database className="size-5" />
              </div>
              <p className="mt-3 font-display text-lg font-semibold">还没有 Vault</p>
              <p className="mt-1 text-sm text-fg-muted">创建第一个 Vault，开始整理资源。</p>
              <Button className="mt-4" onClick={onCreateVault} disabled={!isSignedIn}>
                <Plus data-icon="inline-start" />
                创建 Vault
              </Button>
            </div>
          )}
        </div>
      </main>
      <VaultToc
        activeSpaceId={activeSpaceId}
        disabled={!isSignedIn || !activeSet || isVaultLoading}
        onAddSpace={onAddSpace}
        onJump={jumpToSpace}
        onToggleAllSpaces={toggleAllSpaces}
        resources={isVaultLoading ? [] : activeSet?.resources ?? []}
        isVaultOwner={isVaultOwner}
        spaces={isVaultLoading ? [] : spaces}
        spacesCollapsed={allSpacesCollapsed}
      />
    </>
  )
}

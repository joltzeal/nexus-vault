"use client"

import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react"
import { isSortableOperation } from "@dnd-kit/react/sortable"
import { Database, FolderPlus, LoaderCircle, Plus } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { ScrollToTopButton } from "@/features/components/scroll-to-top-button"
import { VaultHeader } from "@/features/components/vault-header"
import { SpaceSection, type BoardDragData } from "@/features/components/space-section"
import { VaultToc } from "@/features/components/vault-toc"
import type { VaultResourceViewMode } from "@/features/components/vault-view-mode"
import type {
  ResourceAnnotationPatch,
  ResourceSet,
  ResourceTransferTargetVault,
} from "@/features/types"
import { getSortedSpaces, groupResourcesBySpace } from "./view-models"

export type VaultDocumentSearchTarget = {
  requestId: number
  vaultId: string
  spaceId: string
  resourceId?: string
}

export function VaultDocument({
  activeSet,
  canAddResource,
  collaboratorsCount,
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
  onClearResourceAnnotation,
  onDeleteResource,
  onDeleteSpace,
  onDeleteVault,
  onEditVault,
  onEditSpace,
  onForkVault,
  onLoadTransferTargets,
  onMoveResource,
  onMoveSpace,
  onOpenSettings,
  onReorderSpace,
  onResolveResourceMetadata,
  onSelectResource,
  onToggleMediaVisibility,
  onToggleResourceReadLater,
  onToggleResourceStar,
  onToggleStar,
  onTransferResource,
  onTransferResources,
  onUpdateResourceAnnotation,
  onUpdateSpaceIcon,
  pendingSubmissionCount,
  selectedResourceId,
  searchTarget,
  shareSubmissionSlot,
  transferFocusSpaceId,
  transferTargets,
}: {
  activeSet?: ResourceSet
  canAddResource: boolean
  collaboratorsCount: number
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
  onClearResourceAnnotation: (resourceId: string) => void
  onDeleteResource: (resourceId: string) => void
  onDeleteSpace: (spaceId: string) => void
  onDeleteVault: () => void
  onEditVault: () => void
  onEditSpace: (space: ResourceSet["spaces"][number]) => void
  onForkVault: () => void
  onLoadTransferTargets: () => Promise<void>
  onMoveResource: (input: {
    resourceId: string
    sourceSpaceId: string
    targetSpaceId: string
    position: number
  }) => void
  onMoveSpace: (spaceId: string, targetVaultId: string) => Promise<void>
  onOpenSettings: (tab: "share" | "members" | "submissions") => void
  onReorderSpace: (input: { spaceId: string; position: number }) => void
  onResolveResourceMetadata: (resourceId: string) => void
  onSelectResource: (resourceId: string) => void
  onToggleMediaVisibility: (visible: boolean) => void
  onToggleResourceReadLater: (resourceId: string) => void
  onToggleResourceStar: (resourceId: string) => void
  onToggleStar: () => void
  onTransferResource: (input: {
    action: "move" | "copy"
    resourceId: string
    targetVaultId: string
    targetSpaceId: string
  }) => Promise<void>
  onTransferResources: (input: {
    action: "move" | "copy"
    resourceIds: string[]
    targetVaultId: string
    targetSpaceId: string
  }) => Promise<void>
  onUpdateResourceAnnotation: (resourceId: string, patch: ResourceAnnotationPatch) => void
  onUpdateSpaceIcon: (spaceId: string, icon: string) => void
  pendingSubmissionCount: number
  selectedResourceId?: string
  searchTarget?: VaultDocumentSearchTarget
  shareSubmissionSlot?: ReactNode
  transferFocusSpaceId?: string
  transferTargets: ResourceTransferTargetVault[]
}) {
  const mainRef = useRef<HTMLElement>(null)
  const handledSearchRequestId = useRef(0)
  const [activeSpaceId, setActiveSpaceId] = useState("")
  const [collapsedSpaceIds, setCollapsedSpaceIds] = useState<Set<string>>(new Set())
  const [selectionSpaceId, setSelectionSpaceId] = useState("")
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<VaultResourceViewMode>("list")
  const spaces = useMemo(() => getSortedSpaces(activeSet), [activeSet])
  const allSpacesCollapsed =
    spaces.length > 0 && spaces.every((space) => collapsedSpaceIds.has(space.id))
  const groupedResources = useMemo(
    () => groupResourcesBySpace(activeSet?.resources ?? [], spaces),
    [activeSet?.resources, spaces]
  )
  const selectedResources = useMemo(
    () =>
      (activeSet?.resources ?? []).filter((resource) =>
        selectedResourceIds.has(resource.id)
      ),
    [activeSet?.resources, selectedResourceIds]
  )
  const selectedResourceSourceSpaceId =
    selectionSpaceId || selectedResources[0]?.spaceId || ""

  useEffect(() => {
    setActiveSpaceId((current) => current || spaces[0]?.id || "")
  }, [spaces])

  useEffect(() => {
    setSelectedResourceIds((current) => {
      if (current.size === 0) return current

      const availableIds = new Set((activeSet?.resources ?? []).map((resource) => resource.id))
      const next = new Set(
        [...current].filter((resourceId) => availableIds.has(resourceId))
      )

      return next.size === current.size ? current : next
    })

    if (selectionSpaceId && !spaces.some((space) => space.id === selectionSpaceId)) {
      setSelectionSpaceId("")
    }
  }, [activeSet?.resources, selectionSpaceId, spaces])

  useEffect(() => {
    if (
      !searchTarget ||
      isVaultLoading ||
      searchTarget.vaultId !== activeSet?.id
    ) return

    setActiveSpaceId(searchTarget.spaceId)
    if (collapsedSpaceIds.has(searchTarget.spaceId)) {
      setCollapsedSpaceIds((current) => {
        const next = new Set(current)
        next.delete(searchTarget.spaceId)
        return next
      })
      return
    }
    if (handledSearchRequestId.current === searchTarget.requestId) return

    const animationFrame = window.requestAnimationFrame(() => {
      const targetId = searchTarget.resourceId
        ? `resource-${searchTarget.resourceId}`
        : searchTarget.spaceId
      const element = mainRef.current?.querySelector<HTMLElement>(
        `#${CSS.escape(targetId)}`,
      )
      if (!element) return

      handledSearchRequestId.current = searchTarget.requestId
      element.scrollIntoView({ behavior: "smooth", block: "center" })
      element.animate(
        [
          {
            boxShadow: "0 0 0 2px var(--jade), 0 0 0 8px var(--jade-glow)",
          },
          { boxShadow: "0 0 0 0 transparent" },
        ],
        { duration: 1400, easing: "ease-out" },
      )
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [activeSet?.id, collapsedSpaceIds, isVaultLoading, searchTarget])

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

  function toggleResourceSelectionMode(spaceId: string) {
    const shouldExit = selectionSpaceId === spaceId
    setSelectedResourceIds(new Set())
    setSelectionSpaceId(shouldExit ? "" : spaceId)
  }

  function toggleSelectedResource(resourceId: string, selected: boolean) {
    setSelectedResourceIds((current) => {
      const next = new Set(current)
      if (selected) next.add(resourceId)
      else next.delete(resourceId)
      return next
    })
  }

  function clearResourceSelection() {
    setSelectedResourceIds(new Set())
    setSelectionSpaceId("")
  }

  async function transferSelectedResources(input: {
    action: "move" | "copy"
    targetVaultId: string
    targetSpaceId: string
  }) {
    if (selectedResources.length === 0) return

    await onTransferResources({
      ...input,
      resourceIds: selectedResources.map((resource) => resource.id),
    })
    clearResourceSelection()
  }

  return (
    <>
      <main className="h-full min-h-0 overflow-auto scroll-smooth" ref={mainRef}>
        <div className="w-full px-4 py-5 pb-20 md:px-7 lg:pr-[236px]">
          <div className="mx-auto w-full max-w-[1280px]">
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
                      onClearResourceAnnotation={onClearResourceAnnotation}
                      onCreateTransferTargetSpace={onCreateTransferTargetSpace}
                      onDeleteSpace={() => onDeleteSpace(space.id)}
                      onEditSpace={() => onEditSpace(space)}
                      onDeleteResource={onDeleteResource}
                      onLoadTransferTargets={onLoadTransferTargets}
                      onMoveSpace={(targetVaultId) => onMoveSpace(space.id, targetVaultId)}
                      onResolveResourceMetadata={onResolveResourceMetadata}
                      onSelectResource={onSelectResource}
                      onToggleResourceReadLater={onToggleResourceReadLater}
                      onToggleResourceStar={onToggleResourceStar}
                      onToggleResourceSelected={toggleSelectedResource}
                      onToggleSelectionMode={() => toggleResourceSelectionMode(space.id)}
                      onTransferResource={onTransferResource}
                      onUpdateResourceAnnotation={onUpdateResourceAnnotation}
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
                      selectedResourceIds={selectedResourceIds}
                      selectionMode={selectionSpaceId === space.id}
                      space={space}
                      spacePosition={index}
                      transferFocusSpaceId={transferFocusSpaceId}
                      transferTargets={transferTargets}
                      vaultId={activeSet.id}
                      vaultName={activeSet.name}
                      viewMode={viewMode}
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
        </div>
      </main>
      <ScrollToTopButton
        className="bottom-16 lg:bottom-4"
        scrollRef={mainRef}
      />
      <VaultToc
        activeSpaceId={activeSpaceId}
        disabled={!isSignedIn || !activeSet || isVaultLoading}
        onClearResourceSelection={clearResourceSelection}
        onAddSpace={onAddSpace}
        onCreateTransferTargetSpace={onCreateTransferTargetSpace}
        onJump={jumpToSpace}
        onLoadTransferTargets={onLoadTransferTargets}
        onTransferSelectedResources={transferSelectedResources}
        onToggleAllSpaces={toggleAllSpaces}
        onViewModeChange={setViewMode}
        resources={isVaultLoading ? [] : activeSet?.resources ?? []}
        selectedResourceCount={selectedResources.length}
        selectedResourceSourceSpaceId={selectedResourceSourceSpaceId}
        isVaultOwner={isVaultOwner}
        spaces={isVaultLoading ? [] : spaces}
        spacesCollapsed={allSpacesCollapsed}
        transferFocusSpaceId={transferFocusSpaceId}
        transferTargets={transferTargets}
        viewMode={viewMode}
      />
    </>
  )
}

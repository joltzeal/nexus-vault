"use client"

import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react"
import { isSortableOperation } from "@dnd-kit/react/sortable"
import { FolderPlus } from "lucide-react"
import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { VaultHeader } from "@/features/vault-workspace/components/vault-header"
import { SpaceSection, type BoardDragData } from "@/features/vault-workspace/components/space-section"
import { VaultToc } from "@/features/vault-workspace/components/vault-toc"
import type { CommentItem } from "@/features/vault-workspace/components/vault-settings-sheet"
import type { Resource, ResourceSet } from "@/features/vault-workspace/types"
import { getSortedSpaces, groupResourcesBySpace } from "./view-models"

export function VaultDocument({
  activeSet,
  collaboratorsCount,
  commentBody,
  comments,
  isSignedIn,
  isVaultOwner,
  onAddResource,
  onAddResourceToSpace,
  onAddSpace,
  onCommentBodyChange,
  onDeleteResource,
  onDeleteSpace,
  onEditSpace,
  onForkVault,
  onFocusResourceComments,
  onRequireSignIn,
  onMoveResource,
  onOpenSettings,
  onReorderSpace,
  onSelectResource,
  onSubmitComment,
  onToggleStar,
  onUpdateSpaceIcon,
  pendingSubmissionCount,
  selectedResourceId,
  shareSubmissionSlot,
}: {
  activeSet?: ResourceSet
  collaboratorsCount: number
  commentBody: string
  comments: CommentItem[]
  isSignedIn: boolean
  isVaultOwner: boolean
  onAddResource: () => void
  onAddResourceToSpace: (spaceId: string) => void
  onAddSpace: () => void
  onCommentBodyChange: (value: string) => void
  onDeleteResource: (resourceId: string) => void
  onDeleteSpace: (spaceId: string) => void
  onEditSpace: (space: ResourceSet["spaces"][number]) => void
  onForkVault: () => void
  onFocusResourceComments: (resourceId: string) => void
  onRequireSignIn: () => void
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
  onToggleStar: () => void
  onUpdateSpaceIcon: (spaceId: string, icon: string) => void
  pendingSubmissionCount: number
  selectedResourceId?: string
  shareSubmissionSlot?: ReactNode
}) {
  const mainRef = useRef<HTMLDivElement>(null)
  const [activeSpaceId, setActiveSpaceId] = useState("")
  const [collapsedSpaceIds, setCollapsedSpaceIds] = useState<Set<string>>(new Set())
  const spaces = useMemo(() => getSortedSpaces(activeSet), [activeSet])
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
            isVaultOwner={isVaultOwner}
            onAddResource={onAddResource}
            onCreateSpace={onAddSpace}
            onForkVault={onForkVault}
            onOpenSettings={onOpenSettings}
            onToggleStar={onToggleStar}
            pendingSubmissionCount={pendingSubmissionCount}
            set={activeSet}
          />
          {shareSubmissionSlot}
          {activeSet ? (
            <DragDropProvider onDragEnd={handleDragEnd}>
              <section className="mt-3.5">
                {spaces.map((space, index) => (
                  <SpaceSection
                    collapsed={collapsedSpaceIds.has(space.id)}
                    commentBody={commentBody}
                    comments={comments}
                    disabled={!isSignedIn}
                    isVaultOwner={isVaultOwner}
                    isSignedIn={isSignedIn}
                    key={space.id}
                    onAddResource={() => onAddResourceToSpace(space.id)}
                    onCommentBodyChange={onCommentBodyChange}
                    onDeleteSpace={() => onDeleteSpace(space.id)}
                    onEditSpace={() => onEditSpace(space)}
                    onDeleteResource={onDeleteResource}
                    onFocusResourceComments={onFocusResourceComments}
                    onRequireSignIn={onRequireSignIn}
                    onSelectResource={onSelectResource}
                    onSubmitComment={onSubmitComment}
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
              <p className="font-display text-lg font-semibold">还没有 Vault</p>
              <p className="mt-1 text-sm text-fg-muted">登录后创建第一个 vault，资源会写入本地 D1。</p>
              <Button className="mt-4" onClick={onAddSpace} disabled={!isSignedIn}>
                <FolderPlus data-icon="inline-start" />
                新建 Space
              </Button>
            </div>
          )}
        </div>
      </main>
      <VaultToc
        activeSpaceId={activeSpaceId}
        disabled={!isSignedIn || !activeSet}
        onAddSpace={onAddSpace}
        onJump={jumpToSpace}
        resources={activeSet?.resources ?? []}
        isVaultOwner={isVaultOwner}
        spaces={spaces}
      />
    </>
  )
}

"use client"

import { CircleCheck, Columns3, List, LoaderCircle, TriangleAlert } from "lucide-react"
import { useState } from "react"

import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

import { resourceCardShowcaseFixtures } from "./resource-cards/fixtures"
import {
  ResourceCardActions,
  ResourceCardCommentButton,
  ResourceCardCommentEditor,
} from "./resource-cards/resource-card-actions"
import { ResourcePreviewCard } from "./resource-cards/resource-preview-card"
import type {
  ResourceCardViewMode,
  ResourcePreviewRenderState,
} from "./resource-cards/types"

export function ResourceCardShowcase() {
  const [viewMode, setViewMode] = useState<ResourceCardViewMode>("list")
  const [state, setState] = useState<ResourcePreviewRenderState>("ready")

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="mono text-[10px] font-semibold uppercase text-jade">UI REVIEW</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-fg">Resource Cards</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              aria-label="资源卡片布局"
              onValueChange={(value) => {
                const next = getSingleValue(value)
                if (next === "list" || next === "masonry") setViewMode(next)
              }}
              size="sm"
              spacing={0}
              value={[viewMode]}
              variant="outline"
            >
              <ToggleGroupItem aria-label="列表视图" value="list">
                <List data-icon="inline-start" />
                列表
              </ToggleGroupItem>
              <ToggleGroupItem aria-label="瀑布流视图" value="masonry">
                <Columns3 data-icon="inline-start" />
                瀑布流
              </ToggleGroupItem>
            </ToggleGroup>

            <ToggleGroup
              aria-label="资源卡片状态"
              onValueChange={(value) => {
                const next = getSingleValue(value)
                if (next === "ready" || next === "loading" || next === "failed") {
                  setState(next)
                }
              }}
              size="sm"
              spacing={0}
              value={[state]}
              variant="outline"
            >
              <ToggleGroupItem aria-label="完整状态" value="ready">
                <CircleCheck data-icon="inline-start" />
                完整
              </ToggleGroupItem>
              <ToggleGroupItem aria-label="加载状态" value="loading">
                <LoaderCircle data-icon="inline-start" />
                加载
              </ToggleGroupItem>
              <ToggleGroupItem aria-label="失败状态" value="failed">
                <TriangleAlert data-icon="inline-start" />
                失败
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </header>

        <Separator className="bg-line" />

        <section
          aria-label="资源卡片预览列表"
          className={cn(
            viewMode === "list"
              ? "flex flex-col gap-2"
              : "columns-1 gap-2 sm:columns-2 xl:columns-3"
          )}
        >
          {resourceCardShowcaseFixtures.map((fixture) => (
            <ShowcaseResourceCard
              failedPreview={fixture.failed}
              key={fixture.label}
              preview={fixture.ready}
              state={state}
              viewMode={viewMode}
            />
          ))}
        </section>
      </div>
    </main>
  )
}

function ShowcaseResourceCard({
  failedPreview,
  preview,
  state,
  viewMode,
}: {
  failedPreview: (typeof resourceCardShowcaseFixtures)[number]["failed"]
  preview: (typeof resourceCardShowcaseFixtures)[number]["ready"]
  state: ResourcePreviewRenderState
  viewMode: ResourceCardViewMode
}) {
  const [comment, setComment] = useState("")
  const [commentEditorOpen, setCommentEditorOpen] = useState(false)
  const [isChecked, setIsChecked] = useState(false)
  const [isReadLater, setIsReadLater] = useState(false)
  const [isStarred, setIsStarred] = useState(false)
  const [rating, setRating] = useState(0)

  return (
    <ResourcePreviewCard
      actions={
        <ResourceCardActions
          comment={comment}
          disabled={state === "loading"}
          isChecked={isChecked}
          isReadLater={isReadLater}
          isStarred={isStarred}
          onClearAnnotation={() => {
            setComment("")
            setRating(0)
          }}
          onRatingChange={setRating}
          onSaveComment={setComment}
          onToggleChecked={() => setIsChecked((value) => !value)}
          onToggleReadLater={() => setIsReadLater((value) => !value)}
          onToggleStar={() => setIsStarred((value) => !value)}
          rating={rating}
          section="annotation"
        />
      }
      annotation={comment || undefined}
      commentAction={
        <ResourceCardCommentButton
          disabled={state === "loading"}
          onClick={() => setCommentEditorOpen((open) => !open)}
        />
      }
      commentEditor={commentEditorOpen ? (
        <ResourceCardCommentEditor
          onCancel={() => setCommentEditorOpen(false)}
          onChange={setComment}
          onSave={() => {
            setComment((value) => value.trim())
            setCommentEditorOpen(false)
          }}
          value={comment}
        />
      ) : undefined}
      footerActions={
        <ResourceCardActions
          disabled={state === "loading"}
          onDelete={() => undefined}
          onMove={() => undefined}
          onRetryMetadata={() => undefined}
          section="management"
        />
      }
      preview={state === "failed" ? failedPreview : preview}
      state={state}
      viewMode={viewMode}
    />
  )
}

function getSingleValue(value: unknown) {
  if (!Array.isArray(value)) return undefined
  return typeof value[0] === "string" ? value[0] : undefined
}

"use client"

import { Check, Copy, Download, Inbox, Shield, Trash2, Upload, Users, X } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { normalizeResourceMetadata } from "@/domain/resources/metadata"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ResourceMediaGallery } from "@/features/components/resource-media-gallery"
import type { Resource, ResourceSubmissionItem, Space, Visibility } from "@/features/types"
import { cn } from "@/lib/utils"
import {
  getDisplayResourceTitle,
  getInitials,
  getResourceMedia,
  getVisibilityCopy,
} from "./view-models"

export type SettingsTab = "share" | "members" | "submissions"

export type ShareSettings = {
  id?: string
  visibility: Visibility
  slug?: string
}

export type CollaboratorItem = {
  id: string
  userId: string
  email: string
  name?: string | null
  role: "editor"
  createdAt: string
}

export type NotificationItem = {
  id: string
  vaultId?: string | null
  type: string
  title: string
  body: string
  readAt?: string | null
  createdAt: string
}

export type StarredVaultItem = {
  id: string
  title: string
  description: string
  visibility: Visibility
  starCount: number
  forkCount: number
  createdAt: string
}

export function VaultSettingsSheet({
  activeTab,
  canDeleteVault,
  collectionEnabled,
  collaborators,
  isBusy,
  isImporting,
  nsfwEnabled,
  onCollectionEnabledChange,
  onNsfwEnabledChange,
  onOpenChange,
  onRemoveCollaborator,
  onSubmitShare,
  onApproveSubmission,
  onRejectSubmission,
  onTabChange,
  onDeleteVault,
  onExportVault,
  onImportVault,
  onVisibilityChange,
  open,
  ownerName,
  password,
  setPassword,
  share,
  spaces,
  submissions,
}: {
  activeTab: SettingsTab
  canDeleteVault: boolean
  collectionEnabled: boolean
  collaborators: CollaboratorItem[]
  isBusy: boolean
  isImporting: boolean
  nsfwEnabled: boolean
  onCollectionEnabledChange: (enabled: boolean) => void
  onNsfwEnabledChange: (enabled: boolean) => void
  onOpenChange: (open: boolean) => void
  onRemoveCollaborator: (collaboratorId: string) => void
  onSubmitShare: () => void
  onApproveSubmission: (submissionId: string, spaceId?: string) => void
  onRejectSubmission: (submissionId: string) => void
  onTabChange: (tab: SettingsTab) => void
  onDeleteVault: () => void
  onExportVault: () => void
  onImportVault: (file: File) => void
  onVisibilityChange: (visibility: Visibility) => void
  open: boolean
  ownerName: string
  password: string
  setPassword: (value: string) => void
  share: ShareSettings
  spaces: Space[]
  submissions: ResourceSubmissionItem[]
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[380px] gap-0 border-line bg-ink-850 p-0 text-fg sm:max-w-[380px]">
        <SheetHeader className="border-b border-line px-[18px] py-4">
          <SheetTitle className="font-display">
            {activeTab === "share"
              ? "分享 Vault"
              : activeTab === "members"
                ? "协作"
                : "收集"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            管理当前 vault 的分享、协作与资源收集。
          </SheetDescription>
        </SheetHeader>
        <Tabs
          value={activeTab}
          onValueChange={(value) => onTabChange(value as SettingsTab)}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <TabsList variant="line" className="h-9 w-full justify-start rounded-none border-b border-line px-3 pt-1">
            <TabsTrigger value="share">
              <Shield data-icon="inline-start" />
              分享
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users data-icon="inline-start" />
              协作
            </TabsTrigger>
            <TabsTrigger value="submissions">
              <Inbox data-icon="inline-start" />
              收集
              {submissions.length > 0 && (
                <span className="mono rounded-chip bg-jade px-1 text-[9px] font-semibold text-[#04140f]">
                  {submissions.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="share" className="min-h-0 overflow-auto px-[18px] py-4">
            <SharePanel
              canDeleteVault={canDeleteVault}
              isBusy={isBusy}
              isImporting={isImporting}
              nsfwEnabled={nsfwEnabled}
              onDeleteVault={onDeleteVault}
              onExportVault={onExportVault}
              onImportVault={onImportVault}
              onNsfwEnabledChange={onNsfwEnabledChange}
              onSubmit={onSubmitShare}
              onVisibilityChange={onVisibilityChange}
              password={password}
              setPassword={setPassword}
              share={share}
            />
          </TabsContent>
          <TabsContent value="members" className="min-h-0 overflow-auto px-[18px] py-4">
            <MembersPanel
              isBusy={isBusy}
              items={collaborators}
              onRemove={onRemoveCollaborator}
              ownerName={ownerName}
            />
          </TabsContent>
          <TabsContent value="submissions" className="min-h-0 overflow-auto px-[18px] py-4">
            <SubmissionsPanel
              collectionEnabled={collectionEnabled}
              isBusy={isBusy}
              items={submissions}
              onApprove={onApproveSubmission}
              onCollectionEnabledChange={onCollectionEnabledChange}
              onReject={onRejectSubmission}
              spaces={spaces}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function SharePanel({
  canDeleteVault,
  isBusy,
  isImporting,
  nsfwEnabled,
  onDeleteVault,
  onExportVault,
  onImportVault,
  onNsfwEnabledChange,
  onSubmit,
  onVisibilityChange,
  password,
  setPassword,
  share,
}: {
  canDeleteVault: boolean
  isBusy: boolean
  isImporting: boolean
  nsfwEnabled: boolean
  onDeleteVault: () => void
  onExportVault: () => void
  onImportVault: (file: File) => void
  onNsfwEnabledChange: (enabled: boolean) => void
  onSubmit: () => void
  onVisibilityChange: (visibility: Visibility) => void
  password: string
  setPassword: (value: string) => void
  share: ShareSettings
}) {
  const [copyLabel, setCopyLabel] = useState("复制")
  const importInputRef = useRef<HTMLInputElement>(null)
  const sharePath = share.slug ? `/s/${share.slug}` : ""
  const shareUrl = useMemo(() => {
    if (!sharePath) return ""
    if (typeof window === "undefined") return sharePath
    return `${window.location.origin}${sharePath}`
  }, [sharePath])

  async function handleCopyShareUrl() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopyLabel("已复制")
    window.setTimeout(() => setCopyLabel("复制"), 1200)
  }

  const shareUrlVisible = share.visibility === "public" || share.visibility === "password"

  return (
    <section className="flex flex-col gap-5">
      <div>
        <div className="mono mb-2 text-[10px] uppercase tracking-[.14em] text-fg-dim">可见性</div>
        <div className="flex flex-col gap-2">
          {(["public", "password", "private"] as Visibility[]).map((visibility) => (
            <button
              className={cn(
                "flex items-center gap-3 rounded-card border border-line bg-ink-800 px-3 py-3 text-left transition hover:border-ink-700",
                share.visibility === visibility && "border-jade-dim bg-[var(--jade-glow)]"
              )}
              key={visibility}
              onClick={() => onVisibilityChange(visibility)}
              type="button"
            >
              <span className="grid size-8 place-items-center rounded-chip bg-ink-900 text-fg-dim">
                <Shield />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-sm">{getVisibilityCopy(visibility)}</b>
                <span className="block text-xs text-fg-dim">
                  {visibility === "public"
                    ? "任何人可通过分享链接查看"
                    : visibility === "password"
                      ? "访问者需要输入密码"
                      : "仅 Owner/Editor 可见"}
                </span>
              </span>
              <span className={cn("size-4 rounded-chip border border-line", share.visibility === visibility && "border-jade bg-[radial-gradient(circle,var(--jade)_38%,transparent_42%)]")} />
            </button>
          ))}
        </div>
      </div>

      {share.visibility === "password" && (
        <Field>
          <FieldLabel htmlFor="share-password">访问密码</FieldLabel>
          <Input
            autoComplete="new-password"
            id="share-password"
            name="nv-share-access-password"
            placeholder="保存前会在浏览器中 SHA-256 hash"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
      )}

      {shareUrlVisible && (
        <div>
          <div className="mono mb-2 text-[10px] uppercase tracking-[.14em] text-fg-dim">分享链接</div>
          <div className="flex items-center gap-2">
            <div className="mono flex min-h-9 min-w-0 flex-1 items-center truncate rounded-input border border-line bg-ink-900 px-2.5 py-2 text-xs text-fg-muted">
              {shareUrl || "保存分享设置后生成短链"}
            </div>
            <Button size="sm" variant="outline" onClick={handleCopyShareUrl} disabled={!shareUrl} className="min-h-9">
              <Copy data-icon="inline-start" />
              {copyLabel}
            </Button>
          </div>
        </div>
      )}

      <Button onClick={onSubmit} disabled={isBusy || (share.visibility === "password" && !password.trim())}>
        保存分享设置
      </Button>

      <div className="rounded-card border border-line bg-ink-800 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">NSFW 模式</h3>
            <p className="mt-1 text-xs leading-5 text-fg-muted">
              开启后，这个 Vault 默认隐藏所有媒体资源；访问者仍可在当前页面手动显示。
            </p>
          </div>
          <Switch
            checked={nsfwEnabled}
            disabled={isBusy}
            onCheckedChange={onNsfwEnabledChange}
          />
        </div>
      </div>

      <div className="rounded-card border border-line bg-ink-800 p-3">
        <div>
          <h3 className="text-sm font-semibold">导入 / 导出</h3>
          <p className="mt-1 text-xs leading-5 text-fg-muted">
            导出当前 Vault 的 Space、资源、metadata 和评论；导入 JSON 会创建一个新的 Vault。
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            disabled={isBusy}
            onClick={onExportVault}
            type="button"
            variant="outline"
          >
            <Download data-icon="inline-start" />
            导出 JSON
          </Button>
          <Button
            aria-busy={isImporting}
            disabled={isBusy}
            onClick={() => importInputRef.current?.click()}
            type="button"
            variant="outline"
          >
            {isImporting ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Upload data-icon="inline-start" />
            )}
            {isImporting ? "导入中" : "导入 JSON"}
          </Button>
        </div>
        <input
          ref={importInputRef}
          accept="application/json,.json"
          className="hidden"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) onImportVault(file)
          }}
        />
      </div>

      {canDeleteVault && (
        <div className="rounded-card border border-destructive/30 bg-destructive/10 p-3">
          <div className="flex items-start gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-chip bg-destructive/10 text-destructive">
              <Trash2 />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-destructive">删除 Vault</h3>
              <p className="mt-1 text-xs leading-5 text-fg-muted">
                删除后会归档这个 vault，并从当前列表移除。
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger
              render={
              <Button className="mt-3 w-full" variant="destructive" disabled={isBusy}>
                <Trash2 data-icon="inline-start" />
                删除当前 Vault
              </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>删除这个 Vault?</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作会归档当前 vault，资源、space、分享入口和协作入口都将无法继续使用。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onDeleteVault}>
                  删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </section>
  )
}

function MembersPanel({
  isBusy,
  items,
  onRemove,
  ownerName,
}: {
  isBusy: boolean
  items: CollaboratorItem[]
  onRemove: (collaboratorId: string) => void
  ownerName: string
}) {
  return (
    <section className="flex flex-col gap-5">
      <div>
        <div className="mono mb-2 text-[10px] uppercase tracking-[.14em] text-fg-dim">
          Owner
        </div>
        <div className="flex items-center gap-3 rounded-card border border-line bg-ink-800 px-3 py-2">
          <div className="grid size-8 place-items-center rounded-chip border border-jade-dim bg-[var(--jade-glow)] text-xs font-semibold text-jade">
            {getInitials(ownerName)}
          </div>
          <div className="min-w-0 flex-1">
            <b className="block truncate text-sm">{ownerName || "Owner"}</b>
          </div>
          <span className="mono rounded-input border border-jade-dim px-2 py-1 text-[11px] text-jade">
            Owner
          </span>
        </div>
      </div>

      <div>
        <div className="mono mb-2 text-[10px] uppercase tracking-[.14em] text-fg-dim">
          Editor · {items.length}
        </div>
        <div className="flex flex-col gap-2">
          {items.map((item, index) => (
            <div className="flex items-center gap-3 rounded-card border border-line bg-ink-800 px-3 py-2" key={item.id}>
              <div className={`grid size-8 place-items-center rounded-chip border border-line text-xs font-semibold ${memberAvatarClass(index)}`}>
                {getInitials(item.name || "Editor")}
              </div>
              <div className="min-w-0 flex-1">
                <b className="block truncate text-sm">{item.name || "Editor"}</b>
              </div>
              <span className="mono rounded-input border border-line px-2 py-1 text-[11px] text-fg-muted">
                Editor
              </span>
              <Button
                aria-label="移除 Editor"
                disabled={isBusy}
                onClick={() => onRemove(item.id)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {items.length === 0 && (
            <div className="rounded-card border border-line bg-ink-800 p-4 text-sm text-fg-dim">
              No editors yet.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function memberAvatarClass(index: number) {
  const classes = [
    "bg-linear-to-br from-[#3a5a6e] to-[#243846]",
    "bg-linear-to-br from-[#5a4a6e] to-[#2e2440]",
    "bg-linear-to-br from-[#6e5a3a] to-[#403624]",
    "bg-linear-to-br from-[#3a6e5c] to-[#244038]",
  ]
  return classes[index % classes.length]
}

function SubmissionsPanel({
  collectionEnabled,
  isBusy,
  items,
  onApprove,
  onCollectionEnabledChange,
  onReject,
  spaces,
}: {
  collectionEnabled: boolean
  isBusy: boolean
  items: ResourceSubmissionItem[]
  onApprove: (submissionId: string, spaceId?: string) => void
  onCollectionEnabledChange: (enabled: boolean) => void
  onReject: (submissionId: string) => void
  spaces: Space[]
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="rounded-card border border-line bg-ink-800 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">公开收集</h3>
            <p className="mt-1 text-xs leading-5 text-fg-muted">
              开启后，公开或密码分享页中的访问者可以提交资源，提交后仍需审核。
            </p>
          </div>
          <Switch
            checked={collectionEnabled}
            disabled={isBusy}
            onCheckedChange={onCollectionEnabledChange}
          />
        </div>
      </div>

      {items.map((item) => {
        const targetSpace = spaces.find((space) => space.id === item.spaceId)
        const metadata = normalizeResourceMetadata(item.metadataJson)
        const previewResource: Resource = {
          id: item.id,
          spaceId: item.spaceId ?? "",
          title: item.title,
          type: item.type,
          url: item.url,
          description: item.description,
          metadataStatus: metadata ? "completed" : "pending",
          metadata: metadata
            ? {
                provider: item.type,
                data: metadata,
              }
            : null,
          position: 0,
          createdAt: item.createdAt,
        }
        const title = getDisplayResourceTitle(previewResource)
        const media = getResourceMedia(previewResource)

        return (
          <article className="rounded-card border border-line bg-ink-800 p-3" key={item.id}>
            <div className="flex items-start gap-3">
              <div className="grid size-8 shrink-0 place-items-center rounded-chip border border-line bg-ink-900 text-xs font-semibold text-jade">
                {item.type.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold">{title}</h3>
                <p className="mono mt-1 truncate text-[11px] text-fg-dim">{item.url}</p>
                {item.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-fg-muted">{item.description}</p>
                )}
              </div>
            </div>
            {media.length > 0 && (
              <div className="mt-3">
                <ResourceMediaGallery media={media} title={title} />
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-dim">
              <span className="mono rounded-chip border border-line bg-ink-900 px-1.5 py-0.5">
                {targetSpace?.name ?? "默认 Space"}
              </span>
              {item.submitterName && (
                <span className="mono rounded-chip border border-line bg-ink-900 px-1.5 py-0.5">
                  {item.submitterName} 提交的
                </span>
              )}
              <span className="mono rounded-chip border border-line bg-ink-900 px-1.5 py-0.5">
                {formatSubmissionTime(item.createdAt)}
              </span>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReject(item.id)}
                disabled={isBusy}
              >
                <X data-icon="inline-start" />
                拒绝
              </Button>
              <Button
                size="sm"
                onClick={() => onApprove(item.id, item.spaceId ?? undefined)}
                disabled={isBusy}
              >
                <Check data-icon="inline-start" />
                通过
              </Button>
            </div>
          </article>
        )
      })}
      {items.length === 0 && (
        <div className="rounded-card border border-line bg-ink-800 p-5 text-center text-sm text-fg-dim">
          暂无收集提交。
        </div>
      )}
    </section>
  )
}

function formatSubmissionTime(value: string) {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return value
  const minutes = Math.max(1, Math.round((Date.now() - time) / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

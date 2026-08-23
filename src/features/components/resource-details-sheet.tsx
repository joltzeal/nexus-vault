"use client"

import { ExternalLink, GripVertical, ImagePlus, Save, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { Sortable, SortableItem, SortableItemHandle } from "@/components/reui/sortable"
import { ResourceFileTree } from "@/features/components/resource-file-tree"
import type { MetadataStatus, Resource, ResourceType, Space } from "@/features/types"
import { formatBytes, formatResourceType } from "@/features/formatters"
import { toast } from "@/lib/toast"
import { getResourceDisplayUrl, getResourceMeta, getResourceTitle } from "./view-models"

export type ResourceDetailsForm = {
  title: string
  description: string
  url: string
  referer: string
  spaceId: string
}
export type LocalMediaEditInput = { files: File[]; order: string[] }
type LocalMediaEditItem = { id: string; file?: File; name: string; src: string; kind: "image" | "video" | "audio" | "archive"; size: number }

export function ResourceDetailsSheet({
  canEdit,
  isBusy,
  onOpenChange,
  onSave,
  onSaveLocalMedia,
  open,
  resource,
  spaces,
}: {
  canEdit: boolean
  isBusy: boolean
  onOpenChange: (open: boolean) => void
  onSave: (form: ResourceDetailsForm) => void
  onSaveLocalMedia?: (form: ResourceDetailsForm, input: LocalMediaEditInput) => void
  open: boolean
  resource?: Resource
  spaces: Space[]
}) {
  const [form, setForm] = useState<ResourceDetailsForm>({
    title: "",
    description: "",
    url: "",
    referer: "",
    spaceId: "",
  })
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const [mediaItems, setMediaItems] = useState<LocalMediaEditItem[]>([])
  const [initialMediaIds, setInitialMediaIds] = useState<string[]>([])
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const meta = resource ? getResourceMeta(resource) : null
  const metadata = resource?.metadata?.data
  const magnetFileTree = resource?.type === "magnet" ? metadata?.tree ?? [] : []
  const displayUrl = resource ? getResourceDisplayUrl(resource) : ""
  const isLocalMediaResource = resource?.type === "local_media"
  const sizeLabel = formatKnownBytes(metadata?.size)
  const typeLabel = resource
    ? formatMetadataFileType(metadata?.fileType) ||
      RESOURCE_TYPE_LABELS[resource.type] ||
      formatResourceType(resource.type)
    : ""
  const fileCount = metadata?.fileCount ?? meta?.fileCount
  const createdAt = meta?.createdAt
  const pendingMediaUploadCount = mediaItems.filter((item) => item.file).length
  const hasChanges = useMemo(() => {
    if (!resource) return false

    return (
      form.title.trim() !== resource.title ||
      form.description.trim() !== resource.description ||
      (!isLocalMediaResource && form.url.trim() !== displayUrl) ||
      form.referer.trim() !== (resource.referer ?? "") ||
      form.spaceId !== resource.spaceId ||
      (isLocalMediaResource && mediaItems.map((item) => item.id).join("\n") !== initialMediaIds.join("\n"))
    )
  }, [displayUrl, form, initialMediaIds, isLocalMediaResource, mediaItems, resource])

  useEffect(() => {
    if (!resource) return
    setForm({
      title: resource.title,
      description: resource.description,
      url: getResourceDisplayUrl(resource),
      referer: resource.referer ?? "",
      spaceId: resource.spaceId,
    })
    const initialMedia = getLocalMediaItems(resource)
    setMediaItems(initialMedia)
    setInitialMediaIds(initialMedia.map((item) => item.id))
    setDiscardConfirmOpen(false)
  }, [resource])

  function addMedia(files: FileList | File[]) {
    const next = Array.from(files).flatMap((file) => {
      const kind = getLocalMediaKind(file)
      return kind ? [{ id: `new:${crypto.randomUUID()}`, file, name: file.name, src: URL.createObjectURL(file), kind, size: file.size }] : []
    })
    setMediaItems((current) => [...current, ...next])
    if (next.length > 0) {
      toast.info(`已添加 ${next.length} 个文件`, {
        description: "保存修改后将在后台上传。",
      })
    }
  }

  function removeMedia(item: LocalMediaEditItem) {
    if (item.file && item.src.startsWith("blob:")) URL.revokeObjectURL(item.src)
    setMediaItems((current) => current.filter((value) => value.id !== item.id))
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen || !canEdit || isBusy || !hasChanges) {
      onOpenChange(nextOpen)
      return
    }

    setDiscardConfirmOpen(true)
  }

  return (
    <>
      <Sheet open={open && Boolean(resource)} onOpenChange={handleOpenChange}>
        <SheetContent className="w-[calc(100vw-1rem)] gap-0 border-line bg-ink-850 p-0 text-fg sm:w-[760px] sm:max-w-[calc(100vw-2rem)]">
          <SheetHeader className="border-b border-line px-[18px] py-4">
            <SheetTitle className="whitespace-normal break-words pr-8 font-display leading-snug">
              {resource ? getResourceTitle(resource) : "Resource"}
            </SheetTitle>
            <SheetDescription>
              {resource ? formatResourceType(resource.type) : "资源详情"}
            </SheetDescription>
          </SheetHeader>

          {resource && (
            <div className="min-h-0 flex-1 overflow-auto px-[18px] py-4">
              <section className="rounded-card border border-line bg-ink-800 p-3">
                <div className="mono mb-2 text-[10px] uppercase tracking-[.14em] text-fg-dim">
                  信息
                </div>
                <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-xs">
                  <dt className="text-fg-dim">状态</dt>
                  <dd>
                    <span className="text-fg-muted">
                      {METADATA_STATUS_LABELS[resource.metadataStatus]}
                    </span>
                  </dd>
                  <dt className="text-fg-dim">类型</dt>
                  <dd>
                    <span className="text-fg-muted">
                      {typeLabel}
                    </span>
                  </dd>
                  {sizeLabel && (
                    <>
                      <dt className="text-fg-dim">大小</dt>
                      <dd>{sizeLabel}</dd>
                    </>
                  )}
                  {typeof fileCount === "number" && fileCount > 0 && (
                    <>
                      <dt className="text-fg-dim">文件数</dt>
                      <dd>{fileCount}</dd>
                    </>
                  )}
                  {createdAt && (
                    <>
                      <dt className="text-fg-dim">创建时间</dt>
                      <dd>{createdAt}</dd>
                    </>
                  )}
                </dl>
                {meta?.errorMessage && (
                  <p className="mt-3 rounded-input border border-rose/30 bg-rose/10 px-2.5 py-2 text-xs text-rose">
                    {meta.errorMessage}
                  </p>
                )}
              </section>

              {magnetFileTree.length > 0 && (
                <section className="mt-4 overflow-hidden rounded-card border border-line bg-ink-800">
                  <div className="flex h-9 items-center justify-between border-b border-line px-3">
                    <span className="mono text-[10px] uppercase tracking-[.14em] text-fg-dim">
                      文件目录
                    </span>
                    {typeof fileCount === "number" && (
                      <Badge className="h-4 px-1.5 text-[9px] font-normal" variant="secondary">
                        {fileCount} files
                      </Badge>
                    )}
                  </div>
                  <div className="max-h-[min(50vh,32rem)] overflow-y-auto overscroll-contain p-1">
                    <ResourceFileTree tree={magnetFileTree} />
                  </div>
                </section>
              )}

              <FieldGroup className="mt-4">
                {isLocalMediaResource && (
                  <Field>
                    <FieldLabel>媒体文件</FieldLabel>
                    <input ref={mediaInputRef} className="sr-only" multiple type="file" accept="image/*,video/*,audio/*,.zip,.rar,.7z,.tar,.gz" onChange={(event) => { addMedia(event.target.files ?? []); event.target.value = "" }} />
                    <Sortable value={mediaItems} onValueChange={setMediaItems} getItemValue={(item) => item.id} strategy="grid" className="grid grid-cols-3 gap-2">
                      {mediaItems.map((item) => (
                        <SortableItem key={item.id} value={item.id} disabled={isBusy}>
                          <div className="relative overflow-hidden rounded-input border border-line-soft bg-ink-900">
                            {item.kind === "image" ? <img alt="" className="aspect-video w-full object-cover" src={item.src} /> : item.kind === "video" ? <video className="aspect-video w-full object-cover" muted preload="metadata" src={item.src} /> : <div className="flex aspect-video items-center justify-center text-xs text-fg-dim">{item.kind.toUpperCase()}</div>}
                            <div className="absolute left-1 top-1 flex gap-1"><SortableItemHandle><Button size="icon" variant="ghost" type="button" className="size-6 bg-ink-950/80" disabled={isBusy}><GripVertical className="size-3" /></Button></SortableItemHandle><Button size="icon" variant="ghost" type="button" className="size-6 bg-ink-950/80" disabled={isBusy} onClick={() => removeMedia(item)}><X className="size-3" /></Button></div>
                            <p className="truncate border-t border-line-soft px-2 py-1 text-[11px] text-fg-muted">{item.name}</p>
                          </div>
                        </SortableItem>
                      ))}
                    </Sortable>
                    <Button
                      className="min-h-20 w-full flex-col gap-1.5 border-dashed bg-ink-900/55 text-fg-muted hover:border-jade-dim hover:bg-jade/10 hover:text-jade"
                      disabled={isBusy}
                      onClick={() => mediaInputRef.current?.click()}
                      type="button"
                      variant="outline"
                    >
                      <span className="grid size-7 place-items-center rounded-full border border-line-soft bg-ink-850">
                        <ImagePlus className="size-3.5" />
                      </span>
                      <span className="text-xs">添加文件</span>
                    </Button>
                    {pendingMediaUploadCount > 0 && (
                      <p className="text-xs text-fg-muted">
                        {pendingMediaUploadCount} 个新文件待上传，保存后将在后台处理。
                      </p>
                    )}
                  </Field>
                )}
                {!isLocalMediaResource && (
                  <Field>
                    <FieldLabel htmlFor="resource-detail-url">链接（必填）</FieldLabel>
                    <div className="grid grid-cols-[minmax(0,1fr)_36px] items-center gap-2">
                      <Input
                        className="h-9 min-w-0 bg-ink-900 font-mono text-xs"
                        disabled={!canEdit || isBusy}
                        id="resource-detail-url"
                        value={form.url}
                        onChange={(event) => setForm((value) => ({ ...value, url: event.target.value }))}
                      />
                      <Button
                        className="size-9 px-0"
                        size="sm"
                        variant="outline"
                        render={
                          <a href={form.url.trim() || displayUrl} rel="noreferrer" target="_blank" />
                        }
                      >
                        <ExternalLink />
                        <span className="sr-only">打开链接</span>
                      </Button>
                    </div>
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="resource-detail-title">标题</FieldLabel>
                  <Textarea
                    className="min-h-16 resize-y bg-ink-900 text-sm"
                    disabled={!canEdit || isBusy}
                    id="resource-detail-title"
                    value={form.title}
                    onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="resource-detail-referer">Referer</FieldLabel>
                  <Input
                    className="h-9 bg-ink-900 text-sm"
                    disabled={!canEdit || isBusy}
                    id="resource-detail-referer"
                    value={form.referer}
                    onChange={(event) =>
                      setForm((value) => ({ ...value, referer: event.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel>Space</FieldLabel>
                  <Select
                    disabled={!canEdit || isBusy}
                    value={form.spaceId}
                    onValueChange={(spaceId) =>
                      setForm((value) => ({ ...value, spaceId: spaceId ?? "" }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择 Space" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {spaces.map((space) => (
                          <SelectItem key={space.id} value={space.id}>
                            {space.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="resource-detail-description">描述</FieldLabel>
                  <Textarea
                    className="min-h-24 resize-none bg-ink-900 text-sm"
                    disabled={!canEdit || isBusy}
                    id="resource-detail-description"
                    value={form.description}
                    onChange={(event) =>
                      setForm((value) => ({ ...value, description: event.target.value }))
                    }
                  />
                </Field>
              </FieldGroup>
            </div>
          )}

          <SheetFooter className="border-t border-line px-[18px] py-3">
            <Button
              disabled={
                !resource ||
                !canEdit ||
                isBusy ||
                !hasChanges ||
                !form.title.trim() ||
                (!isLocalMediaResource && !form.url.trim())
              }
              onClick={() => {
                const nextForm = {
                  title: form.title.trim(),
                  description: form.description.trim(),
                  url: form.url.trim(),
                  referer: form.referer.trim(),
                  spaceId: form.spaceId,
                }
                if (!isLocalMediaResource) return onSave(nextForm)
                const files = mediaItems.flatMap((item) => item.file ? [item.file] : [])
                let newFileIndex = 0
                const order = mediaItems.map((item) =>
                  item.file ? `new:${newFileIndex++}` : item.id
                )
                onSaveLocalMedia?.(nextForm, { files, order })
              }}
            >
              <Save data-icon="inline-start" />
              保存修改
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <AlertDialogContent className="border-line bg-ink-850 text-fg">
          <AlertDialogHeader>
            <AlertDialogTitle>放弃未保存的修改?</AlertDialogTitle>
            <AlertDialogDescription>
              当前 resource 详情中还有未保存内容，关闭后这些修改不会保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDiscardConfirmOpen(false)
                onOpenChange(false)
              }}
            >
              放弃修改
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

const METADATA_STATUS_LABELS: Record<MetadataStatus, string> = {
  pending: "待处理",
  processing: "处理中",
  completed: "已完成",
  failed: "处理失败",
}

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  magnet: "磁力链接",
  twitter: "X/Twitter",
  telegram: "Telegram",
  douyin: "抖音",
  wechat_mp: "微信公众号",
  baidu_pan: "百度网盘",
  pan_115: "115 盘",
  pan_123: "123 云盘",
  quark_pan: "夸克网盘",
  uc_pan: "UC 网盘",
  xunlei_pan: "迅雷网盘",
  pikpak: "PikPak",
  onedrive: "OneDrive",
  google_drive: "Google Drive",
  dropbox: "Dropbox",
  alist: "AList",
  ftp: "FTP",
  http: "Website",
  youtube: "YouTube",
  local_media: "本地媒体",
  other: "其他",
}

const METADATA_FILE_TYPE_LABELS: Record<string, string> = {
  archive: "Archive",
  audio: "Audio",
  document: "Document",
  file: "File",
  folder: "Folder",
  image: "Image",
  link: "Link",
  magnet: "Magnet",
  other: "Other",
  subtitle: "Subtitle",
  text: "Text",
  torrent: "Torrent",
  unknown: "Unknown",
  video: "Video",
}

function formatKnownBytes(value?: number | null) {
  if (typeof value !== "number" || value <= 0) return ""
  return formatBytes(value)
}

function formatMetadataFileType(value?: string | null) {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return ""

  return METADATA_FILE_TYPE_LABELS[normalized] ?? toTitleCase(normalized)
}

function toTitleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function getLocalMediaItems(resource: Resource): LocalMediaEditItem[] {
  const media = resource.metadata?.data?.media
  if (!Array.isArray(media)) return []
  return media.flatMap((item) => {
    const metadata = item.metadata
    const objectKey = typeof metadata?.objectKey === "string" ? metadata.objectKey : ""
    const kind = item.kind === "image" || item.kind === "video" || item.kind === "audio" ? item.kind : "archive"
    if (!objectKey || !item.url) return []
    return [{ id: objectKey, name: item.fileName ?? "media", src: item.url, kind, size: item.size ?? 0 }]
  })
}

function getLocalMediaKind(file: File): LocalMediaEditItem["kind"] | null {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"
  if (file.type.startsWith("audio/")) return "audio"
  return /\.(zip|rar|7z|tar|gz)$/i.test(file.name) ? "archive" : null
}

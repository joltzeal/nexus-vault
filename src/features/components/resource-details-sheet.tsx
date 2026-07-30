"use client"

import { ExternalLink, Save } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
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
import type { MetadataStatus, Resource, ResourceType, Space } from "@/features/types"
import { formatBytes, formatResourceType } from "@/features/formatters"
import { getResourceDisplayUrl, getResourceMeta, getResourceTitle } from "./view-models"

export type ResourceDetailsForm = {
  title: string
  description: string
  url: string
  spaceId: string
}

export function ResourceDetailsSheet({
  canEdit,
  isBusy,
  onOpenChange,
  onSave,
  open,
  resource,
  spaces,
}: {
  canEdit: boolean
  isBusy: boolean
  onOpenChange: (open: boolean) => void
  onSave: (form: ResourceDetailsForm) => void
  open: boolean
  resource?: Resource
  spaces: Space[]
}) {
  const [form, setForm] = useState<ResourceDetailsForm>({
    title: "",
    description: "",
    url: "",
    spaceId: "",
  })
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false)
  const meta = resource ? getResourceMeta(resource) : null
  const metadata = resource?.metadata?.data
  const displayUrl = resource ? getResourceDisplayUrl(resource) : ""
  const sizeLabel = formatKnownBytes(metadata?.size)
  const typeLabel = resource
    ? formatMetadataFileType(metadata?.fileType) ||
      RESOURCE_TYPE_LABELS[resource.type] ||
      formatResourceType(resource.type)
    : ""
  const fileCount = metadata?.fileCount ?? meta?.fileCount
  const createdAt = meta?.createdAt
  const hasChanges = useMemo(() => {
    if (!resource) return false

    return (
      form.title.trim() !== resource.title ||
      form.description.trim() !== resource.description ||
      form.url.trim() !== displayUrl ||
      form.spaceId !== resource.spaceId
    )
  }, [displayUrl, form, resource])

  useEffect(() => {
    if (!resource) return
    setForm({
      title: resource.title,
      description: resource.description,
      url: getResourceDisplayUrl(resource),
      spaceId: resource.spaceId,
    })
    setDiscardConfirmOpen(false)
  }, [resource])

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
        <SheetContent className="w-[420px] gap-0 border-line bg-ink-850 p-0 text-fg sm:max-w-[420px]">
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

              <FieldGroup className="mt-4">
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
              disabled={!resource || !canEdit || isBusy || !hasChanges || !form.title.trim() || !form.url.trim()}
              onClick={() =>
                onSave({
                  title: form.title.trim(),
                  description: form.description.trim(),
                  url: form.url.trim(),
                  spaceId: form.spaceId,
                })
              }
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

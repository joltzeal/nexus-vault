"use client"

import type { DragEvent, FormEvent } from "react"
import { useEffect, useRef, useState } from "react"
import {
  Archive,
  Check,
  FileAudio,
  GripVertical,
  ImagePlus,
  Link2,
  RefreshCcw,
  Upload,
  X,
} from "lucide-react"
import {
  getCloudDriveProviderLabel,
  parseMagnetLink,
  parseCloudDriveLink,
} from "@/domain/resources/input"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Sortable, SortableItem, SortableItemHandle } from "@/components/reui/sortable"
import { TurnstileField } from "@/components/turnstile-field"
import { SpaceIconPicker } from "@/features/components/space-icon-picker"
import type {
  AuthForm,
  AuthMode,
  ResourceForm,
  ResourceSetForm,
  Space,
  SpaceForm,
  Visibility,
} from "@/features/types"
import { visibilityOptions } from "@/features/types"
import { cn } from "@/lib/utils"
import { VaultCover, vaultCoverOptions } from "./vault-cover"

export function CreateSetDialog({
  form,
  mode = "create",
  onFormChange,
  onOpenChange,
  onSubmit,
  open,
  isSubmitting,
}: {
  form: ResourceSetForm
  isSubmitting: boolean
  mode?: "create" | "edit"
  onFormChange: (form: ResourceSetForm) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  open: boolean
}) {
  const isEdit = mode === "edit"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(720px,calc(100dvh-2rem))] overflow-auto border-line bg-ink-850 text-fg sm:max-w-lg">
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle className="font-display">
              {isEdit ? "编辑 Vault" : "创建 Vault"}
            </DialogTitle>
            <DialogDescription>
              {isEdit ? "更新这个 vault 的基础信息。" : "Vault 是 NexusVault 的协作容器。"}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>封面</FieldLabel>
              <VaultCoverPicker
                key={`${mode}:${open ? "open" : "closed"}`}
                value={form.cover}
                onChange={(cover) => onFormChange({ ...form, cover })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="set-name">名称</FieldLabel>
              <Input
                id="set-name"
                placeholder="例如：电影资料库"
                value={form.name}
                onChange={(event) => onFormChange({ ...form, name: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="set-description">描述</FieldLabel>
              <Textarea
                id="set-description"
                placeholder="这个 vault 用来收集什么？"
                rows={3}
                value={form.description}
                onChange={(event) => onFormChange({ ...form, description: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>可见性</FieldLabel>
              <Select
                value={form.visibility}
                onValueChange={(value) => onFormChange({ ...form, visibility: value as Visibility })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {visibilityOptions
                      .filter((option) => option.value !== "password")
                      .map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              className="min-w-20"
              type="submit"
              disabled={isSubmitting || !form.name.trim()}
              aria-busy={isSubmitting}
            >
              {isSubmitting && <Spinner data-icon="inline-start" />}
              {isSubmitting ? (isEdit ? "保存中" : "创建中") : isEdit ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function VaultCoverPicker({
  onChange,
  value,
}: {
  onChange: (value: string) => void
  value: string
}) {
  const [visibleOptions, setVisibleOptions] = useState(() => getRandomCoverOptions(value))
  const selected = vaultCoverOptions.some((option) => option.value === value) ? value : ""

  useEffect(() => {
    if (selected || !visibleOptions[0]) return
    onChange(visibleOptions[0].value)
  }, [onChange, selected, visibleOptions])

  function refreshOptions() {
    const nextOptions = getRandomCoverOptions()
    setVisibleOptions(nextOptions)
    if (nextOptions[0]) onChange(nextOptions[0].value)
  }

  return (
    <div className="grid grid-cols-6 gap-2">
      {visibleOptions.map((option) => {
        const isSelected = selected === option.value

        return (
          <button
            aria-label={`选择封面 ${option.label}`}
            aria-pressed={isSelected}
            className={cn(
              "relative aspect-square overflow-hidden rounded-input border border-line bg-ink-900 transition hover:border-jade-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-dim",
              isSelected && "border-jade-dim ring-2 ring-jade-dim"
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            <VaultCover className="rounded-input border-0" value={option.value} />
            {isSelected && (
              <span className="absolute bottom-1 right-1 grid size-5 place-items-center rounded-full bg-jade text-[#04140f]">
                <Check className="size-3" />
              </span>
            )}
          </button>
        )
      })}
      <button
        aria-label="随机刷新封面"
        className="grid aspect-square place-items-center rounded-input border border-line bg-ink-900 text-fg-dim transition hover:border-jade-dim hover:text-jade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-dim"
        onClick={refreshOptions}
        type="button"
      >
        <RefreshCcw className="size-5" />
      </button>
    </div>
  )
}

function getRandomCoverOptions(selectedValue?: string) {
  const selectedOption = vaultCoverOptions.find((option) => option.value === selectedValue)
  const shuffledOptions = shuffleCoverOptions(
    vaultCoverOptions.filter((option) => option.value !== selectedValue)
  )

  return selectedOption
    ? [selectedOption, ...shuffledOptions.slice(0, 4)]
    : shuffledOptions.slice(0, 5)
}

function shuffleCoverOptions(options: typeof vaultCoverOptions) {
  return [...options].sort(() => Math.random() - 0.5)
}

export function CreateSpaceDialog({
  contextLabel,
  form,
  mode = "create",
  onFormChange,
  onOpenChange,
  onSubmit,
  open,
}: {
  contextLabel?: string
  form: SpaceForm
  mode?: "create" | "edit"
  onFormChange: (form: SpaceForm) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  open: boolean
}) {
  const isEdit = mode === "edit"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-line bg-ink-850 text-fg sm:max-w-md">
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle className="font-display">
              {isEdit ? "编辑 Space" : "创建 Space"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "更新这个章节的名称与描述。"
                : contextLabel
                  ? `在 ${contextLabel} 中创建新的 Space。`
                  : "Space 会作为文档大纲中的章节。"}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>图标</FieldLabel>
              <div className="flex items-center">
                <SpaceIconPicker
                  disabled={false}
                  onSelect={(icon) => onFormChange({ ...form, icon })}
                  value={form.icon}
                />
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="space-name">名称</FieldLabel>
              <Input
                id="space-name"
                placeholder="例如：动漫、电影、工具"
                value={form.name}
                onChange={(event) => onFormChange({ ...form, name: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="space-description">描述</FieldLabel>
              <Textarea
                className="max-h-40 resize-y overflow-auto"
                id="space-description"
                placeholder="这个 Space 收纳哪一类资源？"
                rows={3}
                value={form.description}
                onChange={(event) => onFormChange({ ...form, description: event.target.value })}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!form.name.trim()}>
              {isEdit ? "保存" : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type ResourceUploadFile = {
  file: File
  id: string
  kind: "image" | "video" | "audio" | "archive"
  previewUrl?: string
  progress: number
  status: "ready" | "uploading" | "error"
}

const MAX_RESOURCE_MEDIA_FILES = 20
const MAX_RESOURCE_MEDIA_UPLOAD_BYTES = 1024 * 1024 * 1024
const RESOURCE_MEDIA_ACCEPT = [
  "image/*",
  "video/*",
  "audio/*",
  ".avif,.bmp,.gif,.heic,.heif,.jpeg,.jpg,.png,.tif,.tiff,.webp",
  ".avi,.m4v,.mkv,.mov,.mp4,.mpeg,.mpg,.webm",
  ".aac,.flac,.m4a,.mp3,.oga,.ogg,.opus,.wav",
  ".7z,.bz2,.gz,.iso,.rar,.tar,.tbz,.tgz,.txz,.xz,.zip",
].join(",")

const ARCHIVE_FILE_EXTENSIONS = new Set([
  "7z",
  "bz2",
  "gz",
  "iso",
  "rar",
  "tar",
  "tbz",
  "tgz",
  "txz",
  "xz",
  "zip",
])

const IMAGE_FILE_EXTENSIONS = new Set([
  "avif", "bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "tif", "tiff", "webp",
])
const VIDEO_FILE_EXTENSIONS = new Set([
  "avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "webm",
])
const AUDIO_FILE_EXTENSIONS = new Set([
  "aac", "flac", "m4a", "mp3", "oga", "ogg", "opus", "wav",
])

export function CreateResourceDialog({
  allowMediaUpload = false,
  form,
  isSubmitting,
  onFormChange,
  onMediaSubmit,
  onOpenChange,
  onSubmit,
  open,
  spaces,
}: {
  allowMediaUpload?: boolean
  form: ResourceForm
  isSubmitting: boolean
  onFormChange: (form: ResourceForm) => void
  onMediaSubmit?: (
    files: File[],
  ) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  open: boolean
  spaces: Space[]
}) {
  const [mode, setMode] = useState<"link" | "media">("link")
  const [mediaFiles, setMediaFiles] = useState<ResourceUploadFile[]>([])
  const [mediaError, setMediaError] = useState("")
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cloudDrive = parseCloudDriveLink(form.url, form.extractionCode)
  const canUploadMedia = allowMediaUpload && Boolean(onMediaSubmit)
  const isMediaMode = canUploadMedia && mode === "media"
  const isBusy = isSubmitting

  useEffect(() => {
    if (open) return
    setMode("link")
    setMediaError("")
    setMediaFiles((current) => {
      current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl))
      return []
    })
  }, [open])

  function handleResourceUrlChange(url: string) {
    const currentCloudDrive = parseCloudDriveLink(form.url)
    const parsedCloudDrive = parseCloudDriveLink(url)
    const parsedMagnet = parseMagnetLink(url)
    const shouldResetExtractionCode =
      !parsedCloudDrive || parsedCloudDrive.provider !== currentCloudDrive?.provider
    const shouldFillMagnetTitle =
      parsedMagnet?.displayName && isFallbackResourceTitle(form.title)

    onFormChange({
      ...form,
      url,
      title: shouldFillMagnetTitle ? parsedMagnet.displayName ?? form.title : form.title,
      extractionCode:
        parsedCloudDrive?.password ?? (shouldResetExtractionCode ? "" : form.extractionCode),
    })
  }

  function addMediaFiles(files: FileList | File[]) {
    const selectedFiles = Array.from(files)
    if (selectedFiles.length === 0) return

    setMediaFiles((current) => {
      const remainingSlots = MAX_RESOURCE_MEDIA_FILES - current.length
      const candidates = selectedFiles.slice(0, Math.max(0, remainingSlots))
      const nextFiles: ResourceUploadFile[] = []
      const rejected: string[] = []
      let totalSize = current.reduce((sum, item) => sum + item.file.size, 0)

      for (const file of candidates) {
        if (file.size <= 0) {
          rejected.push(`${file.name || "文件"} 为空`)
          continue
        }
        if (file.size > MAX_RESOURCE_MEDIA_UPLOAD_BYTES) {
          rejected.push(`${file.name} 超过 1 GB 限制`)
          continue
        }
        if (totalSize + file.size > MAX_RESOURCE_MEDIA_UPLOAD_BYTES) {
          rejected.push("所选文件总大小不能超过 1 GB")
          break
        }

        const kind = getResourceUploadKind(file)
        if (!kind) {
          rejected.push(`${file.name} 不是支持的媒体或压缩文件`)
          continue
        }

        totalSize += file.size
        nextFiles.push({
          file,
          id: crypto.randomUUID(),
          kind,
          previewUrl: kind === "archive" ? undefined : URL.createObjectURL(file),
          progress: 0,
          status: "ready",
        })
      }

      if (selectedFiles.length > candidates.length) {
        rejected.push(`一次最多添加 ${MAX_RESOURCE_MEDIA_FILES} 个文件`)
      }
      setMediaError(rejected.join("；"))
      return [...current, ...nextFiles]
    })
  }

  function removeMediaFile(id: string) {
    if (isBusy) return
    setMediaFiles((current) => {
      const item = current.find((candidate) => candidate.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return current.filter((candidate) => candidate.id !== id)
    })
  }

  function handleMediaDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggingFiles(false)
    addMediaFiles(event.dataTransfer.files)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!isMediaMode) {
      onSubmit(event)
      return
    }

    event.preventDefault()
    if (mediaFiles.length === 0) return

    setMediaError("")
    onMediaSubmit?.(mediaFiles.map((item) => item.file))
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-[min(720px,calc(100dvh-2rem))] max-h-[min(720px,calc(100dvh-2rem))] overflow-hidden border-line bg-ink-850 text-fg sm:max-w-lg"
      >
        <form className="flex h-full min-h-0 flex-col gap-5" onSubmit={handleSubmit}>
          <DialogHeader className="shrink-0">
            <DialogTitle className="font-display">添加资源</DialogTitle>
            <DialogDescription>
              {isMediaMode ? "添加本地媒体资源。" : "添加链接后会自动补全展示信息。"}
            </DialogDescription>
          </DialogHeader>
          {canUploadMedia && (
            <Tabs
              className="shrink-0"
              value={mode}
              onValueChange={(value) => setMode(value as "link" | "media")}
            >
              <TabsList className="w-full border border-line-soft bg-ink-900/80">
                <TabsTrigger value="link">
                  <Link2 data-icon="inline-start" />
                  链接
                </TabsTrigger>
                <TabsTrigger value="media">
                  <ImagePlus data-icon="inline-start" />
                  上传媒体
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <FieldGroup className="min-h-0 flex-1 overflow-y-auto pr-1">
            {isMediaMode ? (
              <Field>
                <FieldLabel>媒体文件</FieldLabel>
                <input
                  accept={RESOURCE_MEDIA_ACCEPT}
                  className="sr-only"
                  disabled={isBusy}
                  multiple
                  onChange={(event) => {
                    addMediaFiles(event.target.files ?? [])
                    event.target.value = ""
                  }}
                  ref={fileInputRef}
                  type="file"
                />
                {mediaFiles.length > 0 && (
                  <Sortable
                    className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"
                    getItemValue={(item) => item.id}
                    onValueChange={setMediaFiles}
                    strategy="grid"
                    value={mediaFiles}
                  >
                    {mediaFiles.map((item) => (
                      <SortableItem key={item.id} value={item.id} disabled={isBusy}>
                        <div className="group relative overflow-hidden rounded-input border border-line-soft bg-ink-900">
                          <ResourceUploadPreview item={item} />
                          <div className="absolute left-1.5 top-1.5 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                            <SortableItemHandle>
                              <Button
                                aria-label={`拖动排序 ${item.file.name}`}
                                className="size-7 bg-ink-950/80 text-fg hover:bg-ink-800"
                                disabled={isBusy}
                                size="icon"
                                title="拖动排序"
                                type="button"
                                variant="ghost"
                              >
                                <GripVertical className="size-3.5" />
                              </Button>
                            </SortableItemHandle>
                            <Button
                              aria-label={`移除 ${item.file.name}`}
                              className="size-7 bg-ink-950/80 text-fg hover:bg-rose/20 hover:text-rose"
                              disabled={isBusy}
                              onClick={() => removeMediaFile(item.id)}
                              size="icon"
                              title="移除文件"
                              type="button"
                              variant="ghost"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                          <div className="min-w-0 border-t border-line-soft px-2 py-1.5">
                            <p className="truncate text-xs text-fg" title={item.file.name}>
                              {item.file.name}
                            </p>
                            <p className="mono text-[10px] text-fg-dim">
                              {formatFileSize(item.file.size)}
                              {item.status === "uploading" && ` · 上传 ${Math.round(item.progress)}%`}
                              {item.status === "error" && " · 上传失败"}
                            </p>
                            {item.status === "uploading" && (
                              <Progress className="mt-1" value={item.progress} />
                            )}
                          </div>
                        </div>
                      </SortableItem>
                    ))}
                  </Sortable>
                )}
                <div
                  className={cn(
                    "mt-2 flex min-h-28 flex-col items-center justify-center gap-2 rounded-input border border-dashed px-4 py-5 text-center transition",
                    isDraggingFiles
                      ? "border-jade bg-jade/10"
                      : "border-line-soft bg-ink-900/50 hover:border-fg-dim"
                  )}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    setIsDraggingFiles(true)
                  }}
                  onDragLeave={(event) => {
                    if (event.currentTarget === event.target) setIsDraggingFiles(false)
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleMediaDrop}
                >
                  <Upload className="size-5 text-fg-dim" />
                  <Button
                    disabled={isBusy || mediaFiles.length >= MAX_RESOURCE_MEDIA_FILES}
                    onClick={() => fileInputRef.current?.click()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    选择文件
                  </Button>
                  <p className="text-xs text-fg-muted">可拖放图片、视频、音频或压缩文件</p>
                  <p className="text-[11px] text-fg-dim">最多 20 个文件，总大小不超过 1 GB</p>
                </div>
                {mediaError && <p className="mt-2 text-xs text-rose">{mediaError}</p>}
              </Field>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="resource-url">链接（必填）</FieldLabel>
                  <Input
                    className="mono"
                    disabled={isBusy}
                    id="resource-url"
                    placeholder="magnet:?xt=urn:btih:... 或 https://..."
                    value={form.url}
                    onChange={(event) => handleResourceUrlChange(event.target.value)}
                  />
                </Field>
                {cloudDrive && (
                  <Field>
                    <FieldLabel htmlFor="resource-extraction-code">
                      {getCloudDriveProviderLabel(cloudDrive.provider)}提取码
                    </FieldLabel>
                    <Input
                      className="mono"
                      disabled={isBusy}
                      id="resource-extraction-code"
                      placeholder="没有提取码可留空"
                      value={form.extractionCode}
                      onChange={(event) =>
                        onFormChange({ ...form, extractionCode: event.target.value })
                      }
                    />
                  </Field>
                )}
              </>
            )}
            <Field>
              <FieldLabel>Space</FieldLabel>
              <Select
                disabled={isBusy}
                value={form.spaceId || spaces[0]?.id || ""}
                onValueChange={(value) => onFormChange({ ...form, spaceId: value ?? "" })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
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
              <FieldLabel htmlFor="resource-title">标题</FieldLabel>
              <Input
                disabled={isBusy}
                id="resource-title"
                placeholder={isMediaMode ? "留空时使用文件名" : "留空时由 metadata 管道补全"}
                value={form.title}
                onChange={(event) => onFormChange({ ...form, title: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="resource-referer">Referer</FieldLabel>
              <Input
                disabled={isBusy}
                id="resource-referer"
                placeholder="可选，资源来源链接"
                value={form.referer}
                onChange={(event) => onFormChange({ ...form, referer: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="resource-description">描述</FieldLabel>
                <Textarea
                  className="field-sizing-fixed max-h-[15rem] overflow-y-auto resize-y"
                  disabled={isBusy}
                  id="resource-description"
                  placeholder="补充版本、来源或注意事项。"
                rows={10}
                value={form.description}
                onChange={(event) => onFormChange({ ...form, description: event.target.value })}
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="shrink-0">
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isBusy || (isMediaMode ? mediaFiles.length === 0 : !form.url.trim())}
              aria-busy={isBusy}
            >
              {isBusy && <Spinner data-icon="inline-start" />}
              {isBusy ? (isMediaMode ? "上传中" : "添加中") : isMediaMode ? "上传" : "添加"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ResourceUploadPreview({ item }: { item: ResourceUploadFile }) {
  if (item.kind === "image" && item.previewUrl) {
    return <img alt="" className="aspect-[4/3] w-full object-cover" src={item.previewUrl} />
  }
  if (item.kind === "video" && item.previewUrl) {
    return <video className="aspect-[4/3] w-full object-cover" muted preload="metadata" src={item.previewUrl} />
  }
  if (item.kind === "audio" && item.previewUrl) {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-ink-800 px-3">
        <FileAudio className="size-8 text-jade" />
        <audio className="h-8 w-full" controls preload="metadata" src={item.previewUrl} />
      </div>
    )
  }
  return (
    <div className="flex aspect-[4/3] items-center justify-center bg-ink-800">
      <Archive className="size-9 text-fg-dim" />
    </div>
  )
}

function getResourceUploadKind(file: File): ResourceUploadFile["kind"] | null {
  const mimeType = file.type.toLowerCase()
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"

  const extension = file.name.match(/\.([a-z0-9]{1,12})$/i)?.[1]?.toLowerCase()
  if (!extension) return null
  if (IMAGE_FILE_EXTENSIONS.has(extension)) return "image"
  if (VIDEO_FILE_EXTENSIONS.has(extension)) return "video"
  if (AUDIO_FILE_EXTENSIONS.has(extension)) return "audio"
  return ARCHIVE_FILE_EXTENSIONS.has(extension) ? "archive" : null
}

export async function createVideoThumbnail(file: File): Promise<File | undefined> {
  const objectUrl = URL.createObjectURL(file)
  const video = document.createElement("video")

  try {
    video.muted = true
    video.playsInline = true
    video.preload = "metadata"
    video.src = objectUrl
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForVideoEvent(video, "loadeddata")
    }

    if (Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = Math.min(1, video.duration / 2)
      await waitForVideoEvent(video, "seeked")
    }

    const sourceWidth = video.videoWidth
    const sourceHeight = video.videoHeight
    if (sourceWidth <= 0 || sourceHeight <= 0) return undefined

    const scale = Math.min(1, 1280 / sourceWidth, 720 / sourceHeight)
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(sourceWidth * scale))
    canvas.height = Math.max(1, Math.round(sourceHeight * scale))
    const context = canvas.getContext("2d")
    if (!context) return undefined
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    )
    if (!blob) return undefined

    const name = file.name.replace(/\.[^.]+$/, "") || "video"
    return new File([blob], `${name}.thumbnail.jpg`, { type: "image/jpeg" })
  } catch {
    return undefined
  } finally {
    video.removeAttribute("src")
    video.load()
    URL.revokeObjectURL(objectUrl)
  }
}

function waitForVideoEvent(video: HTMLVideoElement, eventName: "loadeddata" | "seeked") {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener(eventName, onSuccess)
      video.removeEventListener("error", onError)
    }
    const onSuccess = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error("Unable to read video frame."))
    }

    video.addEventListener(eventName, onSuccess, { once: true })
    video.addEventListener("error", onError, { once: true })
  })
}

function formatFileSize(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function isFallbackResourceTitle(value: string) {
  const title = value.trim().toLowerCase()
  if (!title) return true
  return ["名称未知", "untitled resource", "untitled link", "untitled tweet"].includes(title)
}

export function AuthDialog({
  allowSignUp,
  error,
  form,
  mode,
  onErrorReset,
  onFormChange,
  onModeChange,
  onOpenChange,
  onSubmit,
  open,
  registrationReason,
  turnstileSiteKey,
}: {
  allowSignUp: boolean
  error: string
  form: AuthForm
  mode: AuthMode
  onErrorReset: () => void
  onFormChange: (form: AuthForm) => void
  onModeChange: (mode: AuthMode) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  open: boolean
  registrationReason?: "public-registration" | "first-user" | "disabled"
  turnstileSiteKey?: string
}) {
  const isForgotPassword = mode === "forgot-password"
  const isFirstUserSignUp = mode === "sign-up" && registrationReason === "first-user"
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0)

  function resetTurnstile() {
    setTurnstileToken("")
    setTurnstileResetSignal((value) => value + 1)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    try {
      await onSubmit(event)
    } finally {
      resetTurnstile()
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetTurnstile()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="border-line bg-ink-850 text-fg sm:max-w-md">
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <DialogHeader>
            <DialogTitle className="font-display">
              {isFirstUserSignUp
                ? "创建第一个管理员账号"
                : mode === "sign-up"
                ? "注册账号"
                : isForgotPassword
                  ? "找回密码"
                  : "登录账号"}
            </DialogTitle>
            <DialogDescription>
              {isFirstUserSignUp
                ? "系统还没有用户，这个账号会成为第一个可管理 Vault 的账号。"
                : isForgotPassword
                ? "输入注册邮箱，我们会发送密码重置链接。"
                : "登录后即可创建 Vault、管理资源并邀请成员协作。"}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {mode === "sign-up" && (
              <Field>
                <FieldLabel htmlFor="auth-name">用户名</FieldLabel>
                <Input
                  id="auth-name"
                  value={form.name}
                  onChange={(event) => onFormChange({ ...form, name: event.target.value })}
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="auth-email">邮箱</FieldLabel>
              <Input
                id="auth-email"
                type="email"
                value={form.email}
                onChange={(event) => onFormChange({ ...form, email: event.target.value })}
              />
            </Field>
            {!isForgotPassword && (
              <Field>
                <FieldLabel htmlFor="auth-password">密码</FieldLabel>
                <Input
                  id="auth-password"
                  type="password"
                  value={form.password}
                  onChange={(event) => onFormChange({ ...form, password: event.target.value })}
                />
              </Field>
            )}
            {turnstileSiteKey && (
              <>
                <input type="hidden" name="turnstileToken" value={turnstileToken} />
                <div className="flex min-h-[65px] justify-center">
                  <TurnstileField
                    action="auth"
                    onError={resetTurnstile}
                    onExpire={resetTurnstile}
                    onVerify={setTurnstileToken}
                    resetSignal={turnstileResetSignal}
                    siteKey={turnstileSiteKey}
                  />
                </div>
              </>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </FieldGroup>
          <DialogFooter>
            {mode === "sign-in" && (
              <Button
                className="mr-auto"
                type="button"
                variant="ghost"
                onClick={() => {
                  onModeChange("forgot-password")
                  onErrorReset()
                }}
              >
                忘记密码？
              </Button>
            )}
            {(allowSignUp || mode !== "sign-in") && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  onModeChange(mode === "sign-up" || isForgotPassword ? "sign-in" : "sign-up")
                  onErrorReset()
                }}
              >
                {mode === "sign-up" || isForgotPassword ? "已有账号" : "创建账号"}
              </Button>
            )}
            {(mode !== "sign-up" || allowSignUp) && (
              <Button
                type="submit"
                disabled={
                  !form.email.trim() ||
                  (!isForgotPassword && !form.password) ||
                  (mode === "sign-up" && !form.name.trim()) ||
                  Boolean(turnstileSiteKey && !turnstileToken)
                }
              >
                {mode === "sign-up" ? "注册" : isForgotPassword ? "发送重置邮件" : "登录"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

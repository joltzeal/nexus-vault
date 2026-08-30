/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useRef, useState } from "react";
import { Archive, FileAudio, FileUp, GripVertical, Link2, Upload, X } from "lucide-react";
import { Button as ButtonPrimitive } from "@/components/aicanvas/andromeda/components/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/aicanvas/andromeda/components/Dialog";
import { Input as InputPrimitive } from "@/components/aicanvas/andromeda/components/Input";
import { Select as SelectPrimitive } from "@/components/aicanvas/andromeda/components/Select";
import { Textarea as TextareaPrimitive } from "@/components/aicanvas/andromeda/components/Textarea";
import { Progress } from "@/components/ui/progress";
import { Sortable, SortableItem, SortableItemHandle } from "@/components/reui/sortable";
import { cn } from "@/lib/utils";
import type { LocalMediaUploadProgress } from "../api/local-media-api";
import { getCloudDriveProviderLabel, parseCloudDriveLink } from "../input";
import type { ResourceForm } from "../types";
const Button: any = ButtonPrimitive;
const Input: any = InputPrimitive;
const Select: any = SelectPrimitive;
const Textarea: any = TextareaPrimitive;

type ResourceUploadFile = {
  file: File;
  id: string;
  kind: "image" | "video" | "audio" | "archive";
  previewUrl?: string;
  progress: number;
  status: "ready" | "uploading" | "error";
};

const MAX_RESOURCE_MEDIA_FILES = 20;
const MAX_RESOURCE_MEDIA_UPLOAD_BYTES = 1024 * 1024 * 1024;
const RESOURCE_MEDIA_ACCEPT = [
  "image/*",
  "video/*",
  "audio/*",
  ".avif,.bmp,.gif,.heic,.heif,.jpeg,.jpg,.png,.tif,.tiff,.webp",
  ".avi,.m4v,.mkv,.mov,.mp4,.mpeg,.mpg,.webm",
  ".aac,.flac,.m4a,.mp3,.oga,.ogg,.opus,.wav",
  ".7z,.bz2,.gz,.iso,.rar,.tar,.tbz,.tgz,.txz,.xz,.zip",
].join(",");
const ARCHIVE_FILE_EXTENSIONS = new Set(["7z", "bz2", "gz", "iso", "rar", "tar", "tbz", "tgz", "txz", "xz", "zip"]);
const IMAGE_FILE_EXTENSIONS = new Set(["avif", "bmp", "gif", "heic", "heif", "jpeg", "jpg", "png", "tif", "tiff", "webp"]);
const VIDEO_FILE_EXTENSIONS = new Set(["avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "webm"]);
const AUDIO_FILE_EXTENSIONS = new Set(["aac", "flac", "m4a", "mp3", "oga", "ogg", "opus", "wav"]);
export function CreateResourceDialog({
  open,
  form,
  spaces,
  allowMediaUpload = false,
  isSubmitting = false,
  onFormChange,
  onMediaSubmit,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  form: ResourceForm;
  spaces: Array<{ id: string; name: string }>;
  allowMediaUpload?: boolean;
  isSubmitting?: boolean;
  onFormChange: (form: ResourceForm) => void;
  onMediaSubmit?: (
    files: File[],
    onProgress: (progress: LocalMediaUploadProgress) => void,
  ) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [mode, setMode] = useState<"link" | "media">("link");
  const [files, setFiles] = useState<ResourceUploadFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mediaError, setMediaError] = useState("");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canUploadMedia = allowMediaUpload && Boolean(onMediaSubmit);
  const cloudDrive = parseCloudDriveLink(form.url, form.extractionCode);
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setMode("link");
      setFiles((current) => {
        current.forEach((item) => item.previewUrl && URL.revokeObjectURL(item.previewUrl));
        return [];
      });
      setUploadProgress(0);
      setMediaError("");
    }
    onOpenChange(nextOpen);
  }
  function addMediaFiles(selected: FileList | File[]) {
    const candidates = Array.from(selected).slice(0, MAX_RESOURCE_MEDIA_FILES - files.length);
    const rejected: string[] = [];
    let totalSize = files.reduce((sum, item) => sum + item.file.size, 0);
    const nextFiles = candidates.flatMap((file) => {
      if (file.size <= 0 || file.size > MAX_RESOURCE_MEDIA_UPLOAD_BYTES) {
        rejected.push(`${file.name || "文件"} 无效或超过 1 GB 限制`);
        return [];
      }
      if (totalSize + file.size > MAX_RESOURCE_MEDIA_UPLOAD_BYTES) {
        rejected.push("所选文件总大小不能超过 1 GB");
        return [];
      }
      const kind = getResourceUploadKind(file);
      if (!kind) {
        rejected.push(`${file.name} 不是支持的媒体或压缩文件`);
        return [];
      }
      totalSize += file.size;
      return [{
        file,
        id: crypto.randomUUID(),
        kind,
        previewUrl: kind === "archive" ? undefined : URL.createObjectURL(file),
        progress: 0,
        status: "ready" as const,
      }];
    });
    if (Array.from(selected).length > candidates.length) {
      rejected.push(`一次最多添加 ${MAX_RESOURCE_MEDIA_FILES} 个文件`);
    }
    setFiles((current) => [...current, ...nextFiles]);
    setMediaError(rejected.join("；"));
  }

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    addMediaFiles(event.target.files ?? []);
    event.target.value = "";
  }

  function removeMediaFile(id: string) {
    if (isSubmitting) return;
    setFiles((current) => {
      const item = current.find((candidate) => candidate.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return current.filter((candidate) => candidate.id !== id);
    });
  }

  function handleMediaDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingFiles(false);
    if (!isSubmitting) addMediaFiles(event.dataTransfer.files);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    if (mode === "media") {
      event.preventDefault();
      if (!files.length || !onMediaSubmit) return;
      setMediaError("");
      try {
        await onMediaSubmit(files.map((item) => item.file), (progress) => {
          setUploadProgress(
            progress.totalBytes > 0
              ? Math.round((progress.completedBytes / progress.totalBytes) * 100)
              : 0,
          );
          setFiles((current) =>
            current.map((item, index) =>
              index === progress.fileIndex
                ? { ...item, progress: progress.fileProgress, status: "uploading" }
                : item,
            ),
          );
        });
        handleOpenChange(false);
      } catch (reason) {
        setMediaError(reason instanceof Error ? reason.message : "媒体上传失败。");
      }
      return;
    }
    onSubmit(event);
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div>
            <DialogTitle>Add resource</DialogTitle>
            <DialogDescription>
              {mode === "media"
                ? "Upload local media."
                : "Add a link and optional metadata."}
            </DialogDescription>
          </div>
          <DialogClose onClick={() => handleOpenChange(false)} />
        </DialogHeader>
        <form onSubmit={submit}>
          <DialogBody>
            {canUploadMedia ? (
              <div className="flex gap-2 border-b border-border pb-3">
                <Button
                  icon={Link2}
                  onClick={() => setMode("link")}
                  size="sm"
                  type="button"
                  variant={mode === "link" ? "default" : "ghost"}
                >
                  Link
                </Button>
                <Button
                  icon={FileUp}
                  onClick={() => setMode("media")}
                  size="sm"
                  type="button"
                  variant={mode === "media" ? "default" : "ghost"}
                >
                  Upload
                </Button>
              </div>
            ) : null}
            {mode === "media" ? (
              <div className="grid gap-3">
                <input
                  accept={RESOURCE_MEDIA_ACCEPT}
                  className="sr-only"
                  disabled={isSubmitting}
                  multiple
                  onChange={chooseFiles}
                  ref={inputRef}
                  type="file"
                />
                {files.length > 0 ? (
                  <Sortable
                    className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                    getItemValue={(item) => item.id}
                    onValueChange={setFiles}
                    strategy="grid"
                    value={files}
                  >
                    {files.map((item) => (
                      <SortableItem disabled={isSubmitting} key={item.id} value={item.id}>
                        <div className="group relative overflow-hidden rounded-input border border-line-soft bg-ink-900">
                          <ResourceUploadPreview item={item} />
                          <div className="absolute left-1.5 top-1.5 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                            <SortableItemHandle>
                              <Button
                                aria-label={`拖动排序 ${item.file.name}`}
                                className="size-7 bg-ink-950/80 text-fg hover:bg-ink-800"
                                disabled={isSubmitting}
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
                              disabled={isSubmitting}
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
                            <p className="truncate text-xs text-fg" title={item.file.name}>{item.file.name}</p>
                            <p className="mono text-[10px] text-fg-dim">
                              {formatFileSize(item.file.size)}
                              {item.status === "uploading" && ` · 上传 ${Math.round(item.progress)}%`}
                            </p>
                            {item.status === "uploading" && <Progress className="mt-1" value={item.progress} />}
                          </div>
                        </div>
                      </SortableItem>
                    ))}
                  </Sortable>
                ) : null}
                <div
                  className={cn(
                    "flex min-h-28 flex-col items-center justify-center gap-2 rounded-input border border-dashed px-4 py-5 text-center transition",
                    isDraggingFiles ? "border-jade bg-jade/10" : "border-line-soft bg-ink-900/50 hover:border-fg-dim",
                  )}
                  onDragEnter={(event) => { event.preventDefault(); setIsDraggingFiles(true); }}
                  onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDraggingFiles(false); }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleMediaDrop}
                >
                  <Upload className="size-5 text-fg-dim" />
                  <Button
                    disabled={isSubmitting || files.length >= MAX_RESOURCE_MEDIA_FILES}
                    onClick={() => inputRef.current?.click()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    选择文件
                  </Button>
                  <p className="text-xs text-fg-muted">可拖放图片、视频、音频或压缩文件</p>
                  <p className="text-[11px] text-fg-dim">最多 20 个文件，总大小不超过 1 GB</p>
                </div>
                {mediaError ? (
                  <p className="text-xs text-destructive">{mediaError}</p>
                ) : null}
                {isSubmitting && files.length > 0 ? (
                  <p className="text-label text-muted-foreground">
                    Uploading {uploadProgress}%
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                <Input
                  label="URL"
                  disabled={isSubmitting}
                  value={form.url}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const url = event.target.value;
                    const parsed = parseCloudDriveLink(url);
                    onFormChange({
                      ...form,
                      extractionCode: parsed?.password ?? (!parsed ? "" : form.extractionCode),
                      url,
                    });
                  }}
                />
                {cloudDrive && (
                  <Input
                    className="mono"
                    id="resource-extraction-code"
                    label={`${getCloudDriveProviderLabel(cloudDrive.provider)}提取码`}
                    disabled={isSubmitting}
                    placeholder="没有提取码可留空"
                    value={form.extractionCode}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      onFormChange({ ...form, extractionCode: event.target.value })
                    }
                  />
                )}
              </>
            )}
            <Select
              label="Space"
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                onFormChange({ ...form, spaceId: event.target.value })
              }
              value={form.spaceId || spaces[0]?.id || ""}
            >
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </Select>
            <Input
              label="Title"
              value={form.title}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onFormChange({ ...form, title: event.target.value })
              }
            />
            <Input
              label="Referer"
              value={form.referer}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onFormChange({ ...form, referer: event.target.value })
              }
            />
            <Textarea
              label="Description"
              rows={4}
              value={form.description}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                onFormChange({ ...form, description: event.target.value })
              }
            />
          </DialogBody>
          <DialogFooter>
            <Button
              disabled={isSubmitting}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={
                isSubmitting ||
                (mode === "media" ? files.length === 0 : !form.url.trim())
              }
              type="submit"
            >
              {isSubmitting
                ? mode === "media"
                  ? `Uploading ${uploadProgress}%`
                  : "Adding..."
                : mode === "media"
                  ? "Upload"
                  : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResourceUploadPreview({ item }: { item: ResourceUploadFile }) {
  if (item.kind === "image" && item.previewUrl) {
    return <img alt="" className="aspect-[4/3] w-full object-cover" src={item.previewUrl} />;
  }
  if (item.kind === "video" && item.previewUrl) {
    return <video className="aspect-[4/3] w-full object-cover" muted preload="metadata" src={item.previewUrl} />;
  }
  if (item.kind === "audio" && item.previewUrl) {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-ink-800 px-3">
        <FileAudio className="size-8 text-jade" />
        <audio className="h-8 w-full" controls preload="metadata" src={item.previewUrl} />
      </div>
    );
  }
  return (
    <div className="flex aspect-[4/3] items-center justify-center bg-ink-800">
      <Archive className="size-9 text-fg-dim" />
    </div>
  );
}

function getResourceUploadKind(file: File): ResourceUploadFile["kind"] | null {
  const mimeType = file.type.toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  const extension = file.name.match(/\.([a-z0-9]{1,12})$/i)?.[1]?.toLowerCase();
  if (!extension) return null;
  if (IMAGE_FILE_EXTENSIONS.has(extension)) return "image";
  if (VIDEO_FILE_EXTENSIONS.has(extension)) return "video";
  if (AUDIO_FILE_EXTENSIONS.has(extension)) return "audio";
  if (ARCHIVE_FILE_EXTENSIONS.has(extension)) return "archive";
  return null;
}

function formatFileSize(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

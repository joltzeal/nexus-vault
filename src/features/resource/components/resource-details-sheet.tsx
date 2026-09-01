"use client";

import {
  Archive,
  ExternalLink,
  FileAudio,
  GripVertical,
  Save,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, RefObject } from "react";

import { Button } from "@/components/aicanvas/andromeda/components/Button";
import { Input } from "@/components/aicanvas/andromeda/components/Input";
import { Select as AndromedaSelect } from "@/components/aicanvas/andromeda/components/Select";
import { Textarea } from "@/components/aicanvas/andromeda/components/Textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Sortable, SortableItem, SortableItemHandle } from "@/components/reui/sortable";
import { ResourceFileTree } from "@/features/resource/components/resource-file-tree";
import type { Resource } from "@/features/resource/types";
import type { Space } from "@/features/space/types";
import { getResourceDisplayUrl, getResourceTitle } from "../view-models";
import type { LocalMediaResourceUpdateInput } from "../api/local-media-api";

const LOCAL_MEDIA_MAX_FILES = 20;
const LOCAL_MEDIA_MAX_BYTES = 1024 * 1024 * 1024;
const LOCAL_MEDIA_ACCEPT = [
  "image/*",
  "video/*",
  "audio/*",
  ".avif,.bmp,.gif,.heic,.heif,.jpeg,.jpg,.png,.tif,.tiff,.webp",
  ".avi,.m4v,.mkv,.mov,.mp4,.mpeg,.mpg,.webm",
  ".aac,.flac,.m4a,.mp3,.oga,.ogg,.opus,.wav",
  ".7z,.bz2,.gz,.iso,.rar,.tar,.tbz,.tgz,.txz,.xz,.zip",
].join(",");

type LocalMediaDraft = {
  file?: File;
  fileName: string;
  id: string;
  kind: "image" | "video" | "audio" | "archive";
  objectKey?: string;
  previewUrl?: string;
  size: number;
};

export type ResourceDetailsMediaChange = Pick<
  LocalMediaResourceUpdateInput,
  "files" | "order"
>;

export type ResourceDetailsForm = {
  title: string;
  description: string;
  url: string;
  referer: string;
  spaceId: string;
};

export function ResourceDetailsSheet({
  busy = false,
  canEdit,
  onOpenChange,
  onSave,
  open,
  resource,
  spaces,
}: {
  busy?: boolean;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    form: ResourceDetailsForm,
    media?: ResourceDetailsMediaChange,
  ) => void;
  open: boolean;
  resource?: Resource;
  spaces: Array<Pick<Space, "id" | "name">>;
}) {
  const [form, setForm] = useState<ResourceDetailsForm>(() => toForm(resource));
  const [localMedia, setLocalMedia] = useState<LocalMediaDraft[]>(() =>
    toLocalMediaDraft(resource),
  );
  const [localMediaDirty, setLocalMediaDirty] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [pendingMediaRemoval, setPendingMediaRemoval] =
    useState<LocalMediaDraft | null>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const localMediaRef = useRef(localMedia);
  const metadata = resource?.metadata?.data;
  const tree = resource?.type === "magnet" ? (metadata?.tree ?? []) : [];
  const displayUrl = resource ? getResourceDisplayUrl(resource) : "";
  const hasChanges = useMemo(() => {
    if (!resource) return false;
    return (
      form.title.trim() !== resource.title ||
      form.description.trim() !== resource.description ||
      form.url.trim() !== displayUrl ||
      form.referer.trim() !== (resource.referer ?? "") ||
      form.spaceId !== resource.spaceId ||
      localMediaDirty
    );
  }, [displayUrl, form, localMediaDirty, resource]);

  useEffect(() => {
    // Sync the draft whenever a different resource is selected.
    setForm(toForm(resource));
    localMediaRef.current.forEach(revokeDraftPreview);
    const nextMedia = toLocalMediaDraft(resource);
    localMediaRef.current = nextMedia;
    setLocalMedia(nextMedia);
    setLocalMediaDirty(false);
    setMediaError("");
    setPendingMediaRemoval(null);
  }, [resource]);

  useEffect(() => {
    localMediaRef.current = localMedia;
  }, [localMedia]);

  useEffect(() => () => localMediaRef.current.forEach(revokeDraftPreview), []);

  function update<K extends keyof ResourceDetailsForm>(
    key: K,
    value: ResourceDetailsForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function confirmRemoveMedia() {
    if (!pendingMediaRemoval) return;
    const removalId = pendingMediaRemoval.id;
    setLocalMedia((current) => {
      const item = current.find((candidate) => candidate.id === removalId);
      if (item) revokeDraftPreview(item);
      return current.filter((candidate) => candidate.id !== removalId);
    });
    setLocalMediaDirty(true);
    setMediaError("");
    setPendingMediaRemoval(null);
  }

  return (
    <>
      <Sheet open={open && Boolean(resource)} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(100vw,42rem)] gap-0 border-border bg-card p-0 text-foreground sm:max-w-[42rem]">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="break-words pr-8 text-heading">
            {resource ? getResourceTitle(resource) : "Resource"}
          </SheetTitle>
          <SheetDescription>
            {resource?.type ?? "Resource"} details and placement
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {resource && (
            <div className="flex flex-col gap-4">
              <section className="border border-border bg-card p-3">
                <dl className="grid grid-cols-[100px_minmax(0,1fr)] gap-x-3 gap-y-2 text-label">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="text-foreground">{resource.type}</dd>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="text-foreground">{resource.metadataStatus}</dd>
                  {typeof metadata?.fileCount === "number" ? (
                    <>
                      <dt className="text-muted-foreground">Files</dt>
                      <dd className="text-foreground">{metadata.fileCount}</dd>
                    </>
                  ) : null}
                </dl>
              </section>

              {resource.type === "local_media" ? (
                <LocalMediaEditor
                  disabled={!canEdit || busy}
                  error={mediaError}
                  inputRef={mediaInputRef}
                  items={localMedia}
                  onAdd={(files) => {
                    const result = addLocalMediaFiles(localMedia, files);
                    setLocalMedia(result.items);
                    setLocalMediaDirty(true);
                    setMediaError(result.error);
                  }}
                  onRemove={(id) =>
                    setPendingMediaRemoval(
                      localMedia.find((item) => item.id === id) ?? null,
                    )
                  }
                  onReorder={(next) => {
                    setLocalMedia(next);
                    setLocalMediaDirty(true);
                  }}
                />
              ) : null}

              {tree.length > 0 ? (
                <section className="overflow-hidden border border-border bg-card">
                  <div className="border-b border-border px-3 py-2 font-mono text-label uppercase tracking-[.12em] text-muted-foreground">
                    File tree
                  </div>
                  <ResourceFileTree nodes={tree} />
                </section>
              ) : null}

              <div className="flex flex-col gap-3">
                {resource.type !== "local_media" ? (
                  <label className="flex flex-col gap-1.5 text-label text-muted-foreground">
                    URL
                    <div className="flex min-w-0 items-center gap-2">
                      <Input
                        className="min-w-0 flex-1"
                        disabled={!canEdit || busy}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          update("url", event.target.value)
                        }
                        value={form.url}
                      />
                      <Button
                        aria-label="Open resource URL"
                        asChild
                        className="size-8 shrink-0 p-0"
                        disabled={!form.url.trim()}
                        size="sm"
                        variant="outline"
                      >
                        <a
                          href={form.url.trim() || "#"}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ExternalLink />
                        </a>
                      </Button>
                    </div>
                  </label>
                ) : null}
                <label className="flex flex-col gap-1.5 text-label text-muted-foreground">
                  Title
                  <Textarea
                    className="min-h-16 resize-y"
                    disabled={!canEdit || busy}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                      update("title", event.target.value)
                    }
                    value={form.title}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-label text-muted-foreground">
                  Description
                  <Textarea
                    className="min-h-24 resize-y"
                    disabled={!canEdit || busy}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                      update("description", event.target.value)
                    }
                    value={form.description}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-label text-muted-foreground">
                  Referer
                  <Input
                    disabled={!canEdit || busy}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      update("referer", event.target.value)
                    }
                    value={form.referer}
                  />
                </label>
                <AndromedaSelect
                  disabled={!canEdit || busy}
                  label="Space"
                  onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                    update("spaceId", event.target.value)
                  }
                  value={form.spaceId}
                >
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
                </AndromedaSelect>
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-border px-5 py-3">
          <Button
            disabled={
              !resource ||
              !canEdit ||
              busy ||
              !hasChanges ||
              !form.title.trim() ||
              (resource?.type !== "local_media" && !form.url.trim())
            }
            onClick={() =>
              onSave(
                {
                  title: form.title.trim(),
                  description: form.description.trim(),
                  url: form.url.trim(),
                  referer: form.referer.trim(),
                  spaceId: form.spaceId,
                },
                resource?.type === "local_media"
                  ? {
                      files: localMedia.flatMap((item) =>
                        item.file ? [item.file] : [],
                      ),
                      order: getLocalMediaOrder(localMedia),
                    }
                  : undefined,
              )
            }
            size="sm"
          >
            <Save data-icon="inline-start" />
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
      </Sheet>
      <AlertDialog
        open={Boolean(pendingMediaRemoval)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPendingMediaRemoval(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this media file?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingMediaRemoval?.fileName ?? "This file"} will be removed
              from the resource and deleted from object storage after saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmRemoveMedia}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function LocalMediaEditor({
  disabled,
  error,
  inputRef,
  items,
  onAdd,
  onRemove,
  onReorder,
}: {
  disabled: boolean;
  error: string;
  inputRef: RefObject<HTMLInputElement | null>;
  items: LocalMediaDraft[];
  onAdd: (files: FileList) => void;
  onRemove: (id: string) => void;
  onReorder: (items: LocalMediaDraft[]) => void;
}) {
  return (
    <section className="flex flex-col gap-3 border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-label font-medium text-foreground">
            Media files
          </h3>
          <p className="text-xs text-muted-foreground">{items.length} files</p>
        </div>
        <input
          accept={LOCAL_MEDIA_ACCEPT}
          className="sr-only"
          disabled={disabled}
          multiple
          onChange={(event) => {
            if (event.target.files) onAdd(event.target.files);
            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
        <Button
          aria-label="Add media files"
          disabled={disabled || items.length >= LOCAL_MEDIA_MAX_FILES}
          onClick={() => inputRef.current?.click()}
          size="sm"
          variant="outline"
        >
          <Upload data-icon="inline-start" />
          Add files
        </Button>
      </div>
      {items.length > 0 ? (
        <Sortable
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          getItemValue={(item) => item.id}
          onValueChange={onReorder}
          strategy="grid"
          value={items}
        >
          {items.map((item) => (
            <SortableItem disabled={disabled} key={item.id} value={item.id}>
              <div className="group relative overflow-hidden border border-border">
                <LocalMediaDraftPreview item={item} />
                <div className="absolute left-1.5 top-1.5 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                  <SortableItemHandle>
                    <Button
                      aria-label={`Reorder ${item.fileName}`}
                      className="size-7 bg-black/75 text-white"
                      disabled={disabled}
                      size="icon"
                      title="Reorder media"
                      type="button"
                      variant="ghost"
                    >
                      <GripVertical className="size-3.5" />
                    </Button>
                  </SortableItemHandle>
                  <Button
                    aria-label={`Remove ${item.fileName}`}
                    className="size-7 bg-black/75 text-white hover:bg-destructive"
                    disabled={disabled || items.length <= 1}
                    onClick={() => onRemove(item.id)}
                    size="icon"
                    title="Remove file"
                    type="button"
                    variant="ghost"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                <div className="border-t border-border px-2 py-1.5">
                  <p
                    className="truncate text-xs text-foreground"
                    title={item.fileName}
                  >
                    {item.fileName}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatMediaSize(item.size)}
                  </p>
                </div>
              </div>
            </SortableItem>
          ))}
        </Sortable>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </section>
  );
}

function LocalMediaDraftPreview({ item }: { item: LocalMediaDraft }) {
  if (item.kind === "image" && item.previewUrl) {
    return (
      <img
        alt=""
        className="aspect-[4/3] w-full object-cover"
        src={item.previewUrl}
      />
    );
  }
  if (item.kind === "video" && item.previewUrl) {
    return (
      <video
        className="aspect-[4/3] w-full object-cover"
        muted
        preload="metadata"
        src={item.previewUrl}
      />
    );
  }
  if (item.kind === "audio" && item.previewUrl) {
    return (
      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-muted px-2">
        <FileAudio className="size-7 text-primary" />
        {item.file ? (
          <audio
            className="h-7 w-full"
            controls
            preload="metadata"
            src={item.previewUrl}
          />
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex aspect-[4/3] items-center justify-center bg-muted">
      <Archive className="size-8 text-muted-foreground" />
    </div>
  );
}

function toLocalMediaDraft(resource?: Resource): LocalMediaDraft[] {
  if (resource?.type !== "local_media") return [];
  const media = resource.metadata?.data?.media;
  if (!Array.isArray(media)) return [];

  return media.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    const itemMetadata = value.metadata;
    const objectKey =
      itemMetadata &&
      typeof itemMetadata === "object" &&
      typeof (itemMetadata as Record<string, unknown>).objectKey === "string"
        ? ((itemMetadata as Record<string, unknown>).objectKey as string)
        : undefined;
    const url = typeof value.url === "string" ? value.url : undefined;
    if (!objectKey || !url) return [];
    const kind = getLocalMediaKind(value.kind);
    return [
      {
        fileName:
          typeof value.fileName === "string"
            ? value.fileName
            : `Media ${index + 1}`,
        id: `existing:${objectKey}`,
        kind,
        objectKey,
        previewUrl: url,
        size: typeof value.size === "number" ? value.size : 0,
      },
    ];
  });
}

function addLocalMediaFiles(current: LocalMediaDraft[], selected: FileList) {
  const candidates = Array.from(selected).slice(
    0,
    LOCAL_MEDIA_MAX_FILES - current.length,
  );
  const items = [...current];
  const rejected: string[] = [];
  let totalSize = current.reduce((sum, item) => sum + item.size, 0);

  for (const file of candidates) {
    if (file.size <= 0 || file.size > LOCAL_MEDIA_MAX_BYTES) {
      rejected.push(`${file.name || "File"} is invalid or exceeds 1 GB.`);
      continue;
    }
    if (totalSize + file.size > LOCAL_MEDIA_MAX_BYTES) {
      rejected.push("Total media size cannot exceed 1 GB.");
      continue;
    }
    const kind = getLocalMediaKind(file.type, file.name);
    if (kind === "archive" && !isArchiveFile(file.name, file.type)) {
      rejected.push(`${file.name} is not a supported media or archive file.`);
      continue;
    }
    totalSize += file.size;
    items.push({
      file,
      fileName: file.name,
      id: `new:${crypto.randomUUID()}`,
      kind,
      previewUrl: kind === "archive" ? undefined : URL.createObjectURL(file),
      size: file.size,
    });
  }
  if (Array.from(selected).length > candidates.length) {
    rejected.push(`A maximum of ${LOCAL_MEDIA_MAX_FILES} files is allowed.`);
  }
  return { error: rejected.join(" "), items };
}

function getLocalMediaOrder(items: LocalMediaDraft[]) {
  let newIndex = 0;
  return items.map((item) => item.objectKey ?? `new:${newIndex++}`);
}

function getLocalMediaKind(value: unknown, fileName = "") {
  const mimeType = typeof value === "string" ? value.toLowerCase() : "";
  if (mimeType.startsWith("image/")) return "image" as const;
  if (mimeType.startsWith("video/")) return "video" as const;
  if (mimeType.startsWith("audio/")) return "audio" as const;
  const extension = fileName.match(/\.([a-z0-9]{1,12})$/i)?.[1]?.toLowerCase();
  if (
    extension &&
    [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "avif",
      "bmp",
      "heic",
      "heif",
      "tif",
      "tiff",
    ].includes(extension)
  )
    return "image" as const;
  if (
    extension &&
    ["avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "webm"].includes(
      extension,
    )
  )
    return "video" as const;
  if (
    extension &&
    ["aac", "flac", "m4a", "mp3", "oga", "ogg", "opus", "wav"].includes(
      extension,
    )
  )
    return "audio" as const;
  return "archive" as const;
}

function isArchiveFile(fileName: string, mimeType: string) {
  if (mimeType.startsWith("application/")) return true;
  const extension = fileName.match(/\.([a-z0-9]{1,12})$/i)?.[1]?.toLowerCase();
  return [
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
  ].includes(extension ?? "");
}

function revokeDraftPreview(item: LocalMediaDraft) {
  if (item.file && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
}

function formatMediaSize(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function toForm(resource?: Resource): ResourceDetailsForm {
  return {
    title: resource?.title ?? "",
    description: resource?.description ?? "",
    url: resource ? getResourceDisplayUrl(resource) : "",
    referer: resource?.referer ?? "",
    spaceId: resource?.spaceId ?? "",
  };
}

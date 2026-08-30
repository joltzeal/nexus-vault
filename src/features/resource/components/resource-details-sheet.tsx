"use client";

import { ExternalLink, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";

import { Button } from "@/components/aicanvas/andromeda/components/Button";
import { Input } from "@/components/aicanvas/andromeda/components/Input";
import { Select as AndromedaSelect } from "@/components/aicanvas/andromeda/components/Select";
import { Textarea } from "@/components/aicanvas/andromeda/components/Textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ResourceFileTree } from "@/features/resource/components/resource-file-tree";
import type { Resource } from "@/features/resource/types";
import type { Space } from "@/features/space/types";
import { getResourceDisplayUrl, getResourceTitle } from "../view-models";

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
  onSave: (form: ResourceDetailsForm) => void;
  open: boolean;
  resource?: Resource;
  spaces: Array<Pick<Space, "id" | "name">>;
}) {
  const [form, setForm] = useState<ResourceDetailsForm>(() => toForm(resource));
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
      form.spaceId !== resource.spaceId
    );
  }, [displayUrl, form, resource]);

  useEffect(() => {
    // Sync the draft whenever a different resource is selected.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(toForm(resource));
  }, [resource]);

  function update<K extends keyof ResourceDetailsForm>(
    key: K,
    value: ResourceDetailsForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
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

              {tree.length > 0 ? (
                <section className="overflow-hidden border border-border bg-card">
                  <div className="border-b border-border px-3 py-2 font-mono text-label uppercase tracking-[.12em] text-muted-foreground">
                    File tree
                  </div>
                  <ResourceFileTree nodes={tree} />
                </section>
              ) : null}

              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5 text-label text-muted-foreground">
                  URL
                  <div className="flex min-w-0 items-center gap-2">
                    <Input
                      className="min-w-0 flex-1"
                      disabled={!canEdit || busy}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => update("url", event.target.value)}
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
                <label className="flex flex-col gap-1.5 text-label text-muted-foreground">
                  Title
                  <Textarea
                    className="min-h-16 resize-y"
                    disabled={!canEdit || busy}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => update("title", event.target.value)}
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
                    onChange={(event: ChangeEvent<HTMLInputElement>) => update("referer", event.target.value)}
                    value={form.referer}
                  />
                </label>
                <AndromedaSelect
                  disabled={!canEdit || busy}
                  label="Space"
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => update("spaceId", event.target.value)}
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
              !form.url.trim()
            }
            onClick={() =>
              onSave({
                title: form.title.trim(),
                description: form.description.trim(),
                url: form.url.trim(),
                referer: form.referer.trim(),
                spaceId: form.spaceId,
              })
            }
            size="sm"
          >
            <Save data-icon="inline-start" />
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
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

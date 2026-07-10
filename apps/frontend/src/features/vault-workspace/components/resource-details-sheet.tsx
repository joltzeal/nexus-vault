"use client"

import { ExternalLink, Save } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
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
import type { Resource, Space } from "@/features/vault-workspace/types"
import { formatBytes, formatResourceType } from "@/features/vault-workspace/formatters"
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
  const meta = resource ? getResourceMeta(resource) : null
  const metadata = resource?.metadata?.data
  const displayUrl = resource ? getResourceDisplayUrl(resource) : ""
  const hasChanges = useMemo(() => {
    if (!resource) return false

    return (
      form.title.trim() !== resource.title ||
      form.description.trim() !== resource.description ||
      form.url.trim() !== resource.url ||
      form.spaceId !== resource.spaceId
    )
  }, [form, resource])

  useEffect(() => {
    if (!resource) return
    setForm({
      title: resource.title,
      description: resource.description,
      url: resource.url,
      spaceId: resource.spaceId,
    })
  }, [resource])

  return (
    <Sheet open={open && Boolean(resource)} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] gap-0 border-line bg-ink-850 p-0 text-fg sm:max-w-[420px]">
        <SheetHeader className="border-b border-line px-[18px] py-4">
          <SheetTitle className="whitespace-normal break-words pr-8 font-display leading-snug">
            {resource ? getResourceTitle(resource) : "Resource"}
          </SheetTitle>
          <SheetDescription>
            {resource ? `${formatResourceType(resource.type)} · ${meta?.provider ?? resource.type}` : "资源详情"}
          </SheetDescription>
        </SheetHeader>

        {resource && (
          <div className="min-h-0 flex-1 overflow-auto px-[18px] py-4">
            <section className="rounded-card border border-line bg-ink-800 p-3">
              <div className="mono mb-2 text-[10px] uppercase tracking-[.14em] text-fg-dim">
                Metadata
              </div>
              <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-xs">
                <dt className="text-fg-dim">状态</dt>
                <dd>{resource.metadataStatus}</dd>
                <dt className="text-fg-dim">大小</dt>
                <dd>{formatBytes(metadata?.size)}</dd>
                <dt className="text-fg-dim">类型</dt>
                <dd>{metadata?.fileType ?? formatResourceType(resource.type)}</dd>
                <dt className="text-fg-dim">文件数</dt>
                <dd>{metadata?.fileCount ?? meta?.fileCount ?? 0}</dd>
                <dt className="text-fg-dim">创建时间</dt>
                <dd>{meta?.createdAt}</dd>
              </dl>
              {meta?.errorMessage && (
                <p className="mt-3 rounded-input border border-rose/30 bg-rose/10 px-2.5 py-2 text-xs text-rose">
                  {meta.errorMessage}
                </p>
              )}
            </section>

            <FieldGroup className="mt-4">
              <Field>
                <FieldLabel htmlFor="resource-detail-title">标题</FieldLabel>
                <Input
                  disabled={!canEdit || isBusy}
                  id="resource-detail-title"
                  value={form.title}
                  onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="resource-detail-url">链接</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    className="min-w-0"
                    disabled={!canEdit || isBusy}
                    id="resource-detail-url"
                    value={form.url}
                    onChange={(event) => setForm((value) => ({ ...value, url: event.target.value }))}
                  />
                  <Button size="icon-sm" variant="outline" asChild>
                    <a href={displayUrl} rel="noreferrer" target="_blank">
                      <ExternalLink />
                      <span className="sr-only">打开链接</span>
                    </a>
                  </Button>
                </div>
              </Field>
              <Field>
                <FieldLabel>Space</FieldLabel>
                <Select
                  disabled={!canEdit || isBusy}
                  value={form.spaceId}
                  onValueChange={(spaceId) => setForm((value) => ({ ...value, spaceId }))}
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
  )
}

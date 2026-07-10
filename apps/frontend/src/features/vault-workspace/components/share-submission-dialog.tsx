"use client"

import { LinkIcon, Send } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { TurnstileField } from "@/components/turnstile-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { apiRequest } from "@/features/vault-workspace/api-client"
import type { Space } from "@/features/vault-workspace/types"

export function ShareSubmissionDialog({
  disabled,
  slug,
  spaces,
  turnstileSiteKey,
}: {
  disabled?: boolean
  slug: string
  spaces: Space[]
  turnstileSiteKey?: string
}) {
  const [open, setOpen] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState("")
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0)
  const [form, setForm] = useState({
    spaceId: spaces[0]?.id ?? "",
    url: "",
    title: "",
    description: "",
  })

  async function handleSubmit() {
    if (!form.url.trim() || !turnstileToken) return

    try {
      setIsBusy(true)
      await apiRequest(`/shares/${slug}/submissions`, {
        method: "POST",
        body: JSON.stringify({
          ...(form.spaceId ? { spaceId: form.spaceId } : {}),
          ...(form.title.trim() ? { title: form.title.trim() } : {}),
          url: form.url.trim(),
          description: form.description.trim(),
          turnstileToken,
        }),
      })
      toast.success("资源已提交，等待 owner 审核。")
      setForm((value) => ({
        ...value,
        url: "",
        title: "",
        description: "",
      }))
      resetTurnstile()
      setOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提交失败。")
      resetTurnstile()
    } finally {
      setIsBusy(false)
    }
  }

  function resetTurnstile() {
    setTurnstileToken("")
    setTurnstileResetSignal((value) => value + 1)
  }

  return (
    <section className="mb-4 rounded-card border border-jade-dim bg-[var(--jade-glow)] p-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-card border border-jade-dim bg-ink-900/80 text-jade">
              <LinkIcon />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold">添加资源到这个 Vault</h2>
              <p className="mt-1 text-sm text-fg-muted">
                提交一个链接，审核通过后会显示在这个 vault 中。
              </p>
            </div>
          </div>
          <DialogTrigger asChild>
            <Button disabled={disabled} type="button">
              <Send data-icon="inline-start" />
              提交资源
            </Button>
          </DialogTrigger>
        </div>
        <DialogContent className="border-line bg-ink-850 text-fg sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">提交资源</DialogTitle>
            <DialogDescription>
              提交后由 vault owner 审核，通过后会显示在列表中。
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>目标 Space</FieldLabel>
              <Select
                value={form.spaceId}
                onValueChange={(spaceId) => setForm((value) => ({ ...value, spaceId }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="默认 Space" />
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
              <FieldLabel htmlFor="submission-url">链接</FieldLabel>
              <Input
                id="submission-url"
                value={form.url}
                onChange={(event) => setForm((value) => ({ ...value, url: event.target.value }))}
                placeholder="https://..."
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="submission-title">标题</FieldLabel>
              <Input
                id="submission-title"
                value={form.title}
                onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))}
                placeholder="可选，留空会自动解析"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="submission-description">补充说明</FieldLabel>
              <Textarea
                id="submission-description"
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm((value) => ({ ...value, description: event.target.value }))
                }
              />
            </Field>
          </FieldGroup>
          {turnstileSiteKey && (
            <div className="flex min-h-[65px] justify-center">
              <TurnstileField
                action="resource_submission"
                onError={resetTurnstile}
                onExpire={resetTurnstile}
                onVerify={setTurnstileToken}
                resetSignal={turnstileResetSignal}
                siteKey={turnstileSiteKey}
              />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={isBusy || !form.url.trim() || !turnstileToken}>
              提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

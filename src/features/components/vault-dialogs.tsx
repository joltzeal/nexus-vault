"use client"

import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import { Check, RefreshCcw } from "lucide-react"
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

export function CreateResourceDialog({
  form,
  onFormChange,
  onOpenChange,
  onSubmit,
  open,
  spaces,
}: {
  form: ResourceForm
  onFormChange: (form: ResourceForm) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  open: boolean
  spaces: Space[]
}) {
  const cloudDrive = parseCloudDriveLink(form.url, form.extractionCode)

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(720px,calc(100dvh-2rem))] overflow-hidden border-line bg-ink-850 text-fg sm:max-w-lg">
        <form className="flex max-h-[calc(100dvh-2rem)] min-h-0 flex-col gap-5" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle className="font-display">添加资源</DialogTitle>
            <DialogDescription>添加链接后会自动补全展示信息。</DialogDescription>
          </DialogHeader>
          <FieldGroup className="min-h-0 overflow-y-auto pr-1">
            <Field>
              <FieldLabel htmlFor="resource-url">链接（必填）</FieldLabel>
              <Input
                className="mono"
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
                  id="resource-extraction-code"
                  placeholder="没有提取码可留空"
                  value={form.extractionCode}
                  onChange={(event) =>
                    onFormChange({ ...form, extractionCode: event.target.value })
                  }
                />
              </Field>
            )}
            <Field>
              <FieldLabel>Space</FieldLabel>
              <Select
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
                id="resource-title"
                placeholder="留空时由 metadata 管道补全"
                value={form.title}
                onChange={(event) => onFormChange({ ...form, title: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="resource-description">描述</FieldLabel>
              <Textarea
                className="field-sizing-fixed max-h-[15rem] overflow-y-auto resize-y"
                id="resource-description"
                placeholder="补充版本、来源或注意事项。"
                rows={10}
                value={form.description}
                onChange={(event) => onFormChange({ ...form, description: event.target.value })}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!form.url.trim()}>
              添加
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
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

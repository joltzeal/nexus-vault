"use client"

import type { FormEvent } from "react"

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
import type {
  AuthForm,
  AuthMode,
  ResourceForm,
  ResourceSetForm,
  Space,
  SpaceForm,
  Visibility,
} from "@/features/vault-workspace/types"
import { visibilityOptions } from "@/features/vault-workspace/types"

export function CreateSetDialog({
  form,
  onFormChange,
  onOpenChange,
  onSubmit,
  open,
}: {
  form: ResourceSetForm
  onFormChange: (form: ResourceSetForm) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  open: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-line bg-ink-850 text-fg sm:max-w-md">
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle className="font-display">创建 Vault</DialogTitle>
            <DialogDescription>Vault 是 NexusVault 的协作容器。</DialogDescription>
          </DialogHeader>
          <FieldGroup>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!form.name.trim()}>
              创建
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CreateSpaceDialog({
  form,
  mode = "create",
  onFormChange,
  onOpenChange,
  onSubmit,
  open,
}: {
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
              {isEdit ? "更新这个章节的名称与描述。" : "Space 会作为文档大纲中的章节。"}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-line bg-ink-850 text-fg sm:max-w-lg">
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle className="font-display">添加资源</DialogTitle>
            <DialogDescription>资源会进入 metadata 队列，解析后自动补全展示信息。</DialogDescription>
          </DialogHeader>
          <FieldGroup>
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
              <FieldLabel>Space</FieldLabel>
              <Select
                value={form.spaceId || spaces[0]?.id}
                onValueChange={(value) => onFormChange({ ...form, spaceId: value })}
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
              <FieldLabel htmlFor="resource-url">链接</FieldLabel>
              <Input
                className="mono"
                id="resource-url"
                placeholder="magnet:?xt=urn:btih:... 或 https://..."
                value={form.url}
                onChange={(event) => onFormChange({ ...form, url: event.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="resource-description">描述</FieldLabel>
              <Textarea
                id="resource-description"
                placeholder="补充版本、来源或注意事项。"
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
            <Button type="submit" disabled={!form.url.trim()}>
              添加
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AuthDialog({
  error,
  form,
  mode,
  onErrorReset,
  onFormChange,
  onModeChange,
  onOpenChange,
  onSubmit,
  open,
}: {
  error: string
  form: AuthForm
  mode: AuthMode
  onErrorReset: () => void
  onFormChange: (form: AuthForm) => void
  onModeChange: (mode: AuthMode) => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  open: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-line bg-ink-850 text-fg sm:max-w-md">
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle className="font-display">{mode === "sign-up" ? "注册账号" : "登录账号"}</DialogTitle>
            <DialogDescription>登录后即可创建 Vault、管理资源并邀请成员协作。</DialogDescription>
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
            <Field>
              <FieldLabel htmlFor="auth-password">密码</FieldLabel>
              <Input
                id="auth-password"
                type="password"
                value={form.password}
                onChange={(event) => onFormChange({ ...form, password: event.target.value })}
              />
            </Field>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onModeChange(mode === "sign-up" ? "sign-in" : "sign-up")
                onErrorReset()
              }}
            >
              {mode === "sign-up" ? "已有账号" : "创建账号"}
            </Button>
            <Button
              type="submit"
              disabled={
                !form.email.trim() ||
                !form.password ||
                (mode === "sign-up" && !form.name.trim())
              }
            >
              {mode === "sign-up" ? "注册" : "登录"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

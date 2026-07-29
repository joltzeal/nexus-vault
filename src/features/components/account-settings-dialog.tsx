"use client"

import type { FormEvent, ReactNode } from "react"
import { useEffect, useState } from "react"
import {
  ChevronDown,
  Cookie,
  KeyRound,
  LogOut,
  Shield,
  UserRound,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { apiRequest } from "@/features/api-client"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/toast"

export type SidebarUser = {
  email: string
  image?: string | null
  name: string
}

type AccountIntegrations = {
  xCom: {
    cookieConfigured: boolean
    updatedAt: string | null
  }
}

type AccountSection = "profile" | "password" | "x-com" | null

export function AccountSettingsDialog({
  displayEmail,
  displayName,
  initials,
  onOpenChange,
  onSignOut,
  open,
  user,
}: {
  displayEmail: string
  displayName: string
  initials: string
  onOpenChange: (open: boolean) => void
  onSignOut: () => void
  open: boolean
  user?: SidebarUser
}) {
  const [activeSection, setActiveSection] = useState<AccountSection>("profile")
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwordForm, setPasswordForm] = useState({
    confirmPassword: "",
    currentPassword: "",
    newPassword: "",
  })
  const [integrations, setIntegrations] = useState<AccountIntegrations | null>(null)
  const [integrationError, setIntegrationError] = useState("")
  const [cookieBusy, setCookieBusy] = useState(false)
  const [cookieString, setCookieString] = useState("")

  useEffect(() => {
    if (!open || !user) return

    let cancelled = false
    setIntegrationError("")
    apiRequest<AccountIntegrations>("/account/integrations")
      .then((data) => {
        if (!cancelled) setIntegrations(data)
      })
      .catch((error) => {
        if (!cancelled) {
          setIntegrationError(
            error instanceof Error ? error.message : "读取集成设置失败。",
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, user])

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const currentPassword = passwordForm.currentPassword
    const newPassword = passwordForm.newPassword
    if (!currentPassword || !newPassword) return
    if (newPassword !== passwordForm.confirmPassword) {
      setPasswordError("两次输入的新密码不一致。")
      return
    }

    try {
      setPasswordBusy(true)
      setPasswordError("")
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })

      if (result.error) {
        setPasswordError(result.error.message ?? "密码修改失败，请稍后再试。")
        return
      }

      setPasswordForm({
        confirmPassword: "",
        currentPassword: "",
        newPassword: "",
      })
      toast.success("密码已修改")
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "密码修改失败，请稍后再试。")
    } finally {
      setPasswordBusy(false)
    }
  }

  async function handleSaveXComCookie(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveXComCookie(cookieString)
  }

  async function handleClearXComCookie() {
    await saveXComCookie("")
  }

  async function saveXComCookie(nextCookieString: string) {
    if (!user) return

    try {
      setCookieBusy(true)
      setIntegrationError("")
      const data = await apiRequest<AccountIntegrations>("/account/integrations/x-com", {
        body: JSON.stringify({ cookieString: nextCookieString }),
        method: "PUT",
      })
      setIntegrations(data)
      setCookieString("")
      toast.success(nextCookieString.trim() ? "x.com Cookie 已保存" : "x.com Cookie 已清除")
    } catch (error) {
      setIntegrationError(
        error instanceof Error ? error.message : "保存 x.com Cookie 失败。",
      )
    } finally {
      setCookieBusy(false)
    }
  }

  const xComConfigured = integrations?.xCom.cookieConfigured ?? false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-line bg-ink-850 text-fg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Account</DialogTitle>
          <DialogDescription>管理当前账户、登录密码和站点集成设置。</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2.5">
          <SettingsPanel
            icon={<UserRound />}
            onOpenChange={(nextOpen) => setActiveSection(nextOpen ? "profile" : null)}
            open={activeSection === "profile"}
            title="账户信息"
          >
            <div className="flex items-center gap-3 rounded-input border border-line-soft bg-ink-800/70 p-3">
              <Avatar className="h-10 w-10 rounded-lg">
                {user?.image ? <AvatarImage alt={displayName} src={user.image} /> : null}
                <AvatarFallback className="rounded-lg bg-ink-700 text-xs font-semibold text-jade">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className="truncate text-xs text-fg-dim">{displayEmail}</p>
              </div>
            </div>
            <div className="rounded-input border border-line-soft bg-ink-800/40 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="size-4 text-jade" />
                <span>Session</span>
              </div>
              <p className="mt-1 text-xs text-fg-dim">
                账户资料由 Better Auth 管理。这里可以查看当前会话并更新登录密码。
              </p>
            </div>
          </SettingsPanel>

          <SettingsPanel
            icon={<KeyRound />}
            onOpenChange={(nextOpen) => setActiveSection(nextOpen ? "password" : null)}
            open={activeSection === "password"}
            title="修改密码"
          >
            <form onSubmit={handleChangePassword}>
              <FieldGroup>
                <p className="text-xs text-fg-dim">修改后会撤销其他设备会话。</p>
                <Field>
                  <FieldLabel htmlFor="account-current-password">当前密码</FieldLabel>
                  <Input
                    id="account-current-password"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) =>
                      setPasswordForm((form) => ({
                        ...form,
                        currentPassword: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="account-new-password">新密码</FieldLabel>
                  <Input
                    id="account-new-password"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((form) => ({
                        ...form,
                        newPassword: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="account-confirm-password">确认新密码</FieldLabel>
                  <Input
                    id="account-confirm-password"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordForm((form) => ({
                        ...form,
                        confirmPassword: event.target.value,
                      }))
                    }
                  />
                </Field>
                {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
                <Button
                  disabled={
                    passwordBusy ||
                    !user ||
                    !passwordForm.currentPassword ||
                    !passwordForm.newPassword ||
                    !passwordForm.confirmPassword
                  }
                  type="submit"
                >
                  {passwordBusy ? <Spinner data-icon="inline-start" /> : null}
                  保存新密码
                </Button>
              </FieldGroup>
            </form>
          </SettingsPanel>

          <SettingsPanel
            action={
              <Badge
                className={cn(
                  xComConfigured
                    ? "border-jade-dim bg-jade/10 text-jade"
                    : "border-line-soft bg-ink-750 text-fg-dim",
                )}
                variant="outline"
              >
                {xComConfigured ? "已配置" : "未配置"}
              </Badge>
            }
            icon={<Cookie />}
            onOpenChange={(nextOpen) => setActiveSection(nextOpen ? "x-com" : null)}
            open={activeSection === "x-com"}
            title="x.com Cookie"
          >
            <form onSubmit={handleSaveXComCookie}>
              <FieldGroup>
                <Alert className="border-jade-dim/50 bg-jade/5 text-fg">
                  <Shield />
                  <AlertTitle>安全提示</AlertTitle>
                  <AlertDescription className="text-fg-dim">
                    Cookie 会保存在服务端数据库中，仅用于为你创建的 x.com 资源获取 metadata。
                    它和密码一样敏感，请只粘贴你自己账户的 Cookie，并可随时清除。
                  </AlertDescription>
                </Alert>
                {integrationError && <p className="text-sm text-destructive">{integrationError}</p>}
                {integrations?.xCom.updatedAt ? (
                  <p className="text-xs text-fg-dim">
                    最近更新：{new Date(integrations.xCom.updatedAt).toLocaleString()}
                  </p>
                ) : null}
                <Field>
                  <FieldLabel htmlFor="account-x-com-cookie">Cookie 字符串</FieldLabel>
                  <Textarea
                    className="max-h-[calc(10*1.5rem+1rem)] min-h-24 resize-y overflow-y-auto border-line-soft bg-ink-900/60 text-sm"
                    id="account-x-com-cookie"
                    placeholder="auth_token=...; ct0=..."
                    rows={4}
                    value={cookieString}
                    onChange={(event) => setCookieString(event.target.value)}
                  />
                </Field>
                <div className="flex items-center gap-2">
                  <Button disabled={cookieBusy || !user} type="submit">
                    {cookieBusy ? <Spinner data-icon="inline-start" /> : null}
                    保存 Cookie
                  </Button>
                  <Button
                    disabled={cookieBusy || !user || !xComConfigured}
                    onClick={handleClearXComCookie}
                    type="button"
                    variant="outline"
                  >
                    清除
                  </Button>
                </div>
              </FieldGroup>
            </form>
          </SettingsPanel>

          <Button
            className="justify-start"
            disabled={!user}
            onClick={onSignOut}
            variant="outline"
          >
            <LogOut data-icon="inline-start" />
            Log out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SettingsPanel({
  action,
  children,
  icon,
  onOpenChange,
  open,
  title,
}: {
  action?: ReactNode
  children: ReactNode
  icon: ReactNode
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="overflow-hidden rounded-card border border-line-soft bg-ink-800/40">
        <CollapsibleTrigger
          render={
            <button
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-ink-800"
              type="button"
            >
              <span className="grid size-7 place-items-center rounded-input border border-line-soft bg-ink-750 text-jade [&>svg]:size-4">
                {icon}
              </span>
              <span className="min-w-0 flex-1 truncate">{title}</span>
              {action}
              <ChevronDown
                className={cn(
                  "size-4 text-fg-dim transition",
                  open && "rotate-180 text-fg-muted",
                )}
              />
            </button>
          }
        />
        <CollapsibleContent>
          <div className="flex flex-col gap-3 border-t border-line-soft p-3">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

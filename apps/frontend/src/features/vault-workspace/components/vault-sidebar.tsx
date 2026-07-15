"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { authClient } from "@nexus-vault/auth/client"
import {
  BadgeCheck,
  ChevronsUpDown,
  EyeOff,
  LogOut,
  Plus,
  Shield,
  Star,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { ResourceSet } from "@/features/vault-workspace/types"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type SidebarUser = {
  email: string
  image?: string | null
  name: string
}

export function VaultSidebar({
  activeSetId,
  disabled,
  mediaVisible,
  onMediaVisibleChange,
  onSignOut,
  onCreateVault,
  onSelectStarredVault,
  onSelectVault,
  sets,
  starredVaults,
  user,
}: {
  activeSetId: string
  disabled: boolean
  mediaVisible: boolean
  onMediaVisibleChange: (visible: boolean) => void
  onSignOut: () => void
  onCreateVault: () => void
  onSelectStarredVault: (id: string) => void
  onSelectVault: (id: string) => void
  sets: ResourceSet[]
  starredVaults: Array<{
    id: string
    title: string
    starCount: number
  }>
  user?: SidebarUser
}) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState("")
  const [passwordForm, setPasswordForm] = useState({
    confirmPassword: "",
    currentPassword: "",
    newPassword: "",
  })
  const isMobile = useIsMobile()
  const displayName = user?.name?.trim() || "未登录"
  const displayEmail = user?.email?.trim() || "请先登录"
  const initials = getUserInitials(displayName, displayEmail)

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

  return (
    <aside className="hidden min-h-0 border-r border-line bg-ink-850 lg:flex lg:flex-col">
      <section className="px-3 pb-1 pt-3.5">
        <div className="mono flex items-center justify-between px-2 pb-2 text-[10px] uppercase tracking-[.16em] text-fg-dim">
          <span>Vaults</span>
          <button
            className="grid size-[18px] place-items-center rounded-sm transition hover:bg-ink-750 hover:text-jade disabled:opacity-40"
            disabled={disabled}
            onClick={onCreateVault}
            type="button"
          >
            <Plus />
            <span className="sr-only">创建 Vault</span>
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {sets.map((set, index) => (
            <button
              className={cn(
                "relative flex items-center gap-2 rounded-input px-2 py-2 text-left text-fg-muted transition hover:bg-ink-800 hover:text-fg",
                activeSetId === set.id && "bg-ink-800 text-fg before:absolute before:-left-3 before:top-1/2 before:h-[18px] before:w-[3px] before:-translate-y-1/2 before:rounded-r-sm before:bg-jade"
              )}
              key={set.id}
              onClick={() => onSelectVault(set.id)}
              type="button"
            >
              <span
                className="size-2 shrink-0 rounded-[3px]"
                style={{ backgroundColor: vaultDotColor(index) }}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{set.name}</span>
              <span className="mono text-[10.5px] text-fg-dim">
                {set.resources.length || set.resourceCount}
              </span>
            </button>
          ))}
          {sets.length === 0 && (
            <div className="rounded-input border border-line-soft bg-ink-800/50 px-3 py-4 text-xs text-fg-dim">
              登录后创建第一个 vault。
            </div>
          )}
        </div>
      </section>

      {starredVaults.length > 0 && (
        <section className="border-t border-line-soft px-3 pb-1 pt-3">
          <div className="mono flex items-center gap-1.5 px-2 pb-2 text-[10px] uppercase tracking-[.16em] text-fg-dim">
            <Star className="size-3" />
            <span>Starred vaults</span>
          </div>
          <div className="flex flex-col gap-1">
            {starredVaults.map((vault) => (
              <button
                className={cn(
                  "flex items-center gap-2 rounded-input px-2 py-1.5 text-left text-fg-muted transition hover:bg-ink-800 hover:text-fg",
                  activeSetId === vault.id && "bg-ink-800 text-fg"
                )}
                key={vault.id}
                onClick={() => onSelectStarredVault(vault.id)}
                type="button"
              >
                <Star className={cn("size-3 shrink-0", activeSetId === vault.id ? "text-jade" : "text-fg-dim")} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{vault.title}</span>
                <span className="mono text-[10px] text-fg-dim">{vault.starCount}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-auto border-t border-line-soft p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex w-full items-center gap-2 rounded-input border border-line-soft bg-ink-800/70 p-2 text-left transition hover:border-jade-dim hover:bg-ink-800 data-[state=open]:border-jade-dim data-[state=open]:bg-ink-800"
              type="button"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {user?.image ? <AvatarImage alt={displayName} src={user.image} /> : null}
                <AvatarFallback className="rounded-lg bg-ink-700 text-[11px] font-semibold text-jade">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium text-fg">{displayName}</span>
                <span className="truncate text-xs text-fg-dim">{displayEmail}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-fg-dim" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-60 border border-line-soft bg-ink-850 text-fg shadow-pop"
            side={isMobile ? "bottom" : "right"}
            sideOffset={8}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  {user?.image ? <AvatarImage alt={displayName} src={user.image} /> : null}
                  <AvatarFallback className="rounded-lg bg-ink-700 text-[11px] font-semibold text-jade">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate font-medium text-fg">{displayName}</span>
                  <span className="truncate text-xs text-fg-dim">{displayEmail}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-line-soft" />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="cursor-pointer gap-2 px-2 py-2 focus:bg-ink-800 focus:text-fg"
                disabled={!user}
                onSelect={() => setAccountOpen(true)}
              >
                <BadgeCheck className="size-4 text-fg-dim" />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-default gap-2 px-2 py-2 focus:bg-ink-800 focus:text-fg"
                disabled={!activeSetId}
                onSelect={(event) => event.preventDefault()}
              >
                <EyeOff className="size-4 text-fg-dim" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">NSFW</p>
                </div>
                <Switch
                  checked={!mediaVisible}
                  disabled={!activeSetId}
                  onCheckedChange={(checked) => onMediaVisibleChange(!checked)}
                  size="sm"
                />
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-line-soft" />
            <DropdownMenuItem
              className="cursor-pointer gap-2 px-2 py-2 text-red-300 focus:bg-red-500/10 focus:text-red-200"
              disabled={!user}
              onSelect={onSignOut}
            >
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="border border-line bg-ink-850 text-fg sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Account</DialogTitle>
            <DialogDescription>Better Auth 当前登录账户信息。</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-card border border-line-soft bg-ink-800/70 p-3">
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
          <div className="rounded-card border border-line-soft bg-ink-800/40 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Shield className="size-4 text-jade" />
              <span>Session</span>
            </div>
            <p className="mt-1 text-xs text-fg-dim">
              账户资料由 Better Auth 管理。这里可以查看当前会话并更新登录密码。
            </p>
          </div>
          <form
            className="rounded-card border border-line-soft bg-ink-800/40 p-3"
            onSubmit={handleChangePassword}
          >
            <FieldGroup>
              <div>
                <h3 className="text-sm font-semibold">修改密码</h3>
                <p className="mt-1 text-xs text-fg-dim">
                  修改后会撤销其他设备会话。
                </p>
              </div>
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
                保存新密码
              </Button>
            </FieldGroup>
          </form>
          <Button
            className="justify-start"
            disabled={!user}
            onClick={onSignOut}
            variant="outline"
          >
            <LogOut data-icon="inline-start" />
            Log out
          </Button>
        </DialogContent>
      </Dialog>
    </aside>
  )
}

function vaultDotColor(index: number) {
  const colors = ["#3fd8b0", "#5cb9f0", "#9b8cff", "#e8b34a", "#f0697a"]
  return colors[index % colors.length]
}

function getUserInitials(name: string, email: string) {
  const source = name !== "未登录" ? name : email
  const compact = source.trim()
  if (!compact) return "NV"

  const [first = "", second = ""] = compact
    .replace(/@.*$/, "")
    .split(/\s+/)
    .filter(Boolean)

  const initials = `${first.charAt(0)}${second.charAt(0)}`.toUpperCase()
  return initials || compact.slice(0, 2).toUpperCase()
}

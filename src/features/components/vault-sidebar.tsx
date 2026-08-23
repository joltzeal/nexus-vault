"use client"

import { useRef, useState } from "react"
import {
  BadgeCheck,
  ChevronsUpDown,
  EyeOff,
  LogOut,
  Plus,
  Star,
  Upload,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import {
  AccountSettingsDialog,
  type SidebarUser,
} from "@/features/components/account-settings-dialog"
import type { ResourceSet } from "@/features/types"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

export function VaultSidebar({
  activeSetId,
  disabled,
  isImporting,
  mediaVisible,
  onMediaVisibleChange,
  onImportVault,
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
  isImporting: boolean
  mediaVisible: boolean
  onMediaVisibleChange: (visible: boolean) => void
  onImportVault: (file: File) => void
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
  const importInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()
  const { setOpenMobile } = useSidebar()
  const displayName = user?.name?.trim() || "未登录"
  const displayEmail = user?.email?.trim() || "请先登录"
  const initials = getUserInitials(displayName, displayEmail)
  const vaultActionClass =
    "grid size-7 place-items-center rounded-md text-fg-dim transition hover:bg-ink-750 hover:text-jade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade/20 disabled:pointer-events-none disabled:opacity-40 group-data-[collapsible=icon]:size-8"

  function selectVault(id: string, callback: (vaultId: string) => void) {
    if (isMobile) setOpenMobile(false)
    callback(id)
  }

  return (
    <Sidebar
      className="!top-[52px] !h-[calc(100dvh-52px)] border-line bg-ink-850"
      collapsible="icon"
      side="left"
      variant="sidebar"
    >
      <SidebarHeader className="border-b border-line-soft px-2 py-2.5">
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:justify-center">
          <SidebarTrigger
            className="size-8 shrink-0 text-fg-dim hover:bg-ink-800 hover:text-jade"
            title="收起或展开 Sidebar"
            type="button"
          />
          <span className="mono min-w-0 flex-1 truncate px-1 text-[10px] uppercase tracking-[.16em] text-fg-dim group-data-[collapsible=icon]:hidden">
            Vaults
          </span>
          <span className="flex items-center gap-0.5 rounded-lg border border-line-soft bg-ink-800/60 p-0.5 group-data-[collapsible=icon]:hidden">
            <button
              className={vaultActionClass}
              aria-busy={isImporting}
              disabled={disabled || isImporting}
              onClick={() => importInputRef.current?.click()}
              title={isImporting ? "正在导入 Vault" : "导入 Vault JSON"}
              type="button"
            >
              {isImporting ? <Spinner className="size-3.5" /> : <Upload className="size-3.5" />}
              <span className="sr-only">导入 Vault JSON</span>
            </button>
            <button
              className={vaultActionClass}
              disabled={disabled}
              onClick={onCreateVault}
              title="创建 Vault"
              type="button"
            >
              <Plus className="size-3.5" />
              <span className="sr-only">创建 Vault</span>
            </button>
          </span>
        </div>
        <input
          ref={importInputRef}
          accept="application/json,.json"
          className="hidden"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            if (file) onImportVault(file)
          }}
        />
      </SidebarHeader>

      <SidebarContent className="px-0 py-1">
        <SidebarGroup className="px-2 py-1">
          <SidebarGroupLabel>Vaults</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
          {sets.map((set, index) => (
            <SidebarMenuItem key={set.id}>
              <SidebarMenuButton
                className={cn(
                  "relative h-9 text-fg-muted hover:bg-ink-800 hover:text-fg data-active:bg-ink-800 data-active:text-fg group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!",
                  activeSetId === set.id &&
                    "before:absolute before:-left-2 before:top-1/2 before:h-[18px] before:w-[3px] before:-translate-y-1/2 before:rounded-r-sm before:bg-jade"
                )}
                isActive={activeSetId === set.id}
                onClick={() => selectVault(set.id, onSelectVault)}
                tooltip={set.name}
                type="button"
              >
                <span
                  className="grid size-5 shrink-0 place-items-center rounded-[6px] text-[10px] font-semibold text-[#04140f] transition group-data-[collapsible=icon]:size-7 group-data-[collapsible=icon]:rounded-[8px] group-data-[collapsible=icon]:text-xs"
                  style={{ backgroundColor: vaultDotColor(index) }}
                >
                  {getVaultInitial(set.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium group-data-[collapsible=icon]:hidden">
                  {set.name}
                </span>
              </SidebarMenuButton>
              <SidebarMenuBadge className="mono text-[10.5px] text-fg-dim">
                {set.resources.length || set.resourceCount}
              </SidebarMenuBadge>
            </SidebarMenuItem>
          ))}
            </SidebarMenu>
          {sets.length === 0 && (
            <div className="rounded-input border border-dashed border-line-soft bg-ink-800/45 p-3 text-xs text-fg-dim group-data-[collapsible=icon]:hidden">
              <p>暂无 Vault</p>
              <button
                className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-md border border-line-soft bg-ink-850 px-2 text-fg-muted transition hover:border-jade-dim hover:text-jade disabled:pointer-events-none disabled:opacity-40"
                disabled={disabled}
                onClick={onCreateVault}
                type="button"
              >
                <Plus className="size-3.5" />
                创建 Vault
              </button>
            </div>
          )}
          </SidebarGroupContent>
        </SidebarGroup>

      {starredVaults.length > 0 && (
        <>
          <SidebarSeparator className="bg-line-soft" />
          <SidebarGroup className="px-2 py-1">
            <SidebarGroupLabel>
              <Star className="size-3 mr-2" />
              Starred vaults
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
            {starredVaults.map((vault) => (
              <SidebarMenuItem key={vault.id}>
                <SidebarMenuButton
                  className="h-8 text-fg-muted hover:bg-ink-800 hover:text-fg data-active:bg-ink-800 data-active:text-fg group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
                  isActive={activeSetId === vault.id}
                  onClick={() => selectVault(vault.id, onSelectStarredVault)}
                  tooltip={vault.title}
                  type="button"
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-[6px] border border-line-soft bg-ink-800 text-[10px] font-semibold transition group-data-[collapsible=icon]:size-7 group-data-[collapsible=icon]:rounded-[8px] group-data-[collapsible=icon]:text-xs",
                      activeSetId === vault.id ? "text-jade" : "text-fg-dim"
                    )}
                  >
                    {getVaultInitial(vault.title)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium group-data-[collapsible=icon]:hidden">
                    {vault.title}
                  </span>
                </SidebarMenuButton>
                <SidebarMenuBadge className="mono text-[10px] text-fg-dim">
                  {vault.starCount}
                </SidebarMenuBadge>
              </SidebarMenuItem>
            ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </>
      )}
      </SidebarContent>

      <SidebarFooter className="border-t border-line-soft p-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
            <button
              className="flex w-full items-center gap-2 rounded-input border border-line-soft bg-ink-800/70 p-2 text-left transition hover:border-jade-dim hover:bg-ink-800 data-[state=open]:border-jade-dim data-[state=open]:bg-ink-800 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
              type="button"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                {user?.image ? <AvatarImage alt={displayName} src={user.image} /> : null}
                <AvatarFallback className="rounded-lg bg-ink-700 text-[11px] font-semibold text-jade">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-medium text-fg">{displayName}</span>
                <span className="truncate text-xs text-fg-dim">{displayEmail}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-fg-dim group-data-[collapsible=icon]:hidden" />
            </button>
            }
          />
          <DropdownMenuContent
            align="end"
            className="min-w-60 border border-line-soft bg-ink-850 text-fg shadow-pop"
            side={isMobile ? "bottom" : "right"}
            sideOffset={8}
          >
            <DropdownMenuGroup>
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
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-line-soft" />
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="cursor-pointer gap-2 px-2 py-2 focus:bg-ink-800 focus:text-fg"
                disabled={!user}
                onClick={() => setAccountOpen(true)}
              >
                <BadgeCheck className="size-4 text-fg-dim" />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-default gap-2 px-2 py-2 focus:bg-ink-800 focus:text-fg"
                closeOnClick={false}
                disabled={!activeSetId}
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
            <DropdownMenuItem
              className="cursor-pointer gap-2 px-2 py-2 text-red-300 focus:bg-red-500/10 focus:text-red-200"
              disabled={!user}
              onClick={onSignOut}
            >
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
      <SidebarRail />
      <AccountSettingsDialog
        displayEmail={displayEmail}
        displayName={displayName}
        initials={initials}
        onOpenChange={setAccountOpen}
        onSignOut={onSignOut}
        open={accountOpen}
        user={user}
      />
    </Sidebar>
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

function getVaultInitial(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return "V"

  const first = Array.from(trimmed)[0]
  return first.toUpperCase()
}

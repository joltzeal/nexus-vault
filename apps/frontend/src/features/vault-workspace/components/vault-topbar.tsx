"use client"

import {
  Bell,
  Database,
  FileText,
  Folder,
  LogIn,
  LogOut,
  Search,
  Star,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { getInitials } from "@/features/vault-workspace/components/view-models"

export type VaultSearchItem = {
  id: string
  vaultId: string
  title: string
  description?: string
  kind: "vault" | "starred" | "space" | "resource"
  resourceId?: string
  spaceId?: string
  spaceName?: string
  vaultName?: string
}

export function VaultTopbar({
  currentUserName,
  isSignedIn,
  isSessionPending,
  notifications,
  activePage,
  onAuthOpen,
  onHome,
  onNotificationsOpen,
  onOpenConsole,
  onPageChange,
  onSearchSelect,
  onSignOut,
  onQueryChange,
  query,
  showAuthEntry,
  searchEnabled,
  unreadNotificationCount,
  vaultSearchItems,
}: {
  currentUserName?: string | null
  isSignedIn: boolean
  isSessionPending: boolean
  notifications: Array<{
    id: string
    title: string
    body: string
    type: string
    readAt?: string | null
    createdAt: string
  }>
  activePage: "workspace" | "star"
  onAuthOpen: () => void
  onHome: () => void
  onNotificationsOpen: () => void
  onOpenConsole: () => void
  onPageChange: (page: "workspace" | "star") => void
  onSearchSelect: (item: VaultSearchItem) => void
  onSignOut: () => void
  onQueryChange: (value: string) => void
  query: string
  showAuthEntry: boolean
  searchEnabled: boolean
  unreadNotificationCount: number
  vaultSearchItems: VaultSearchItem[]
}) {
  const [searchOpen, setSearchOpen] = useState(false)
  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => notification.type === "resource_submission.created"),
    [notifications]
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!searchEnabled) return
      if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey)) return
      event.preventDefault()
      setSearchOpen((open) => !open)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [searchEnabled])

  const hasQuery = query.trim().length > 0
  const groupedSearchItems = useMemo(
    () => groupSearchItemsByVault(filterSearchItems(vaultSearchItems, query)),
    [query, vaultSearchItems]
  )

  function selectSearchItem(item: VaultSearchItem) {
    onSearchSelect(item)
    onQueryChange("")
    setSearchOpen(false)
  }

  return (
    <header className="col-span-full flex h-[52px] items-center gap-4 border-b border-line bg-ink-850/70 px-4 backdrop-blur-xl">
      <button
        className="flex items-center gap-2 rounded-input pr-1 font-display text-[15px] font-semibold transition hover:text-jade"
        onClick={onHome}
        type="button"
      >
        <span className="grid size-6 place-items-center rounded-[7px] bg-linear-to-br from-jade to-[#2a9c93] text-[13px] font-bold text-[#04140f] shadow-[0_0_0_1px_rgba(63,216,176,.4),0_4px_14px_-4px_var(--jade)]">
          N
        </span>
        <span>Nexus<span className="text-jade">Vault</span></span>
      </button>

      <Button
        className={activePage === "star" ? "border-jade-dim bg-[var(--jade-glow)] text-jade" : ""}
        disabled={!isSignedIn}
        onClick={() => onPageChange(activePage === "star" ? "workspace" : "star")}
        size="sm"
        type="button"
        variant="outline"
      >
        <Star data-icon="inline-start" />
        Star
      </Button>

      {searchEnabled && (
        <>
          <button
            className="ml-1 hidden h-[34px] w-full max-w-[420px] items-center gap-2 rounded-lg border border-line bg-ink-800 px-3 text-fg-dim transition hover:border-jade-dim hover:bg-ink-800/80 hover:text-fg focus-visible:border-jade-dim focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--jade-glow)] md:flex"
            onClick={() => setSearchOpen(true)}
            type="button"
          >
            <Search className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 text-left text-sm">搜索 vault / space / resource</span>
            <kbd className="mono rounded-sm border border-line bg-ink-850 px-1.5 py-0.5 text-[10.5px] text-fg-dim">
              ⌘K
            </kbd>
          </button>

          <CommandDialog
            className="border-line bg-ink-850 text-fg sm:max-w-[640px]"
            description="搜索当前工作台中的 vault、space 与 resource。"
            open={searchOpen}
            title="搜索"
            onOpenChange={(open) => {
              setSearchOpen(open)
              if (!open) onQueryChange("")
            }}
          >
            <Command className="bg-ink-850 text-fg">
              <CommandInput
                placeholder="搜索 vault、space 或 resource..."
                value={query}
                onValueChange={onQueryChange}
              />
              <CommandList className="max-h-[min(520px,calc(100dvh-180px))]">
                {!hasQuery ? (
                  <div className="px-3 py-8 text-center text-sm text-fg-dim">
                    输入关键词后搜索 vault、space 或 resource
                  </div>
                ) : groupedSearchItems.length > 0 ? (
                  groupedSearchItems.map((group, index) => (
                    <SearchVaultGroup
                      group={group}
                      key={group.vaultId}
                      onSelect={selectSearchItem}
                      showSeparator={index > 0}
                    />
                  ))
                ) : (
                  <CommandEmpty>没有匹配的结果</CommandEmpty>
                )}
              </CommandList>
            </Command>
          </CommandDialog>
        </>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <Popover
          onOpenChange={(open) => {
            if (open) onNotificationsOpen()
          }}
        >
          <PopoverTrigger asChild>
            <Button className="relative text-fg-dim" size="icon" variant="ghost" type="button">
              <Bell />
              {unreadNotificationCount > 0 && (
                <span className="mono absolute right-0.5 top-0.5 min-w-4 rounded-chip bg-jade px-1 text-[9px] font-semibold leading-4 text-[#04140f]">
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </span>
              )}
              <span className="sr-only">通知</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[340px] gap-0 border-line bg-ink-850 p-0 text-fg">
            <PopoverHeader className="border-b border-line px-3 py-2.5">
              <PopoverTitle>新提交</PopoverTitle>
            </PopoverHeader>
            <div className="max-h-[360px] overflow-auto p-2">
              {visibleNotifications.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {visibleNotifications.map((notification) => (
                    <article
                      className="rounded-input border border-line bg-ink-800 px-3 py-2"
                      key={notification.id}
                    >
                      <div className="flex items-start gap-2">
                        {!notification.readAt && (
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-jade" />
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold">{notification.title}</h3>
                          {notification.body && (
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-fg-muted">
                              {notification.body}
                            </p>
                          )}
                          <p className="mono mt-1 text-[10px] text-fg-dim">
                            {formatNotificationTime(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-input border border-line bg-ink-800 px-3 py-6 text-center text-sm text-fg-dim">
                  暂无新的资源提交
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        {isSignedIn ? (
          <Button size="sm" variant="outline" onClick={onSignOut}>
            <LogOut data-icon="inline-start" />
            退出
          </Button>
        ) : showAuthEntry ? (
          <Button size="sm" variant="outline" onClick={onAuthOpen} disabled={isSessionPending}>
            <LogIn data-icon="inline-start" />
            登录
          </Button>
        ) : null}
        {isSignedIn && (
          <button
            className="grid size-[30px] place-items-center rounded-chip border border-line bg-linear-to-br from-[#3a5a6e] to-[#243846] text-xs font-semibold transition hover:border-jade-dim"
            onClick={onOpenConsole}
            title="个人中心"
            type="button"
          >
            {getInitials(currentUserName ?? "")}
          </button>
        )}
      </div>
    </header>
  )
}

function SearchVaultGroup({
  group,
  onSelect,
  showSeparator,
}: {
  group: SearchVaultGroup
  onSelect: (item: VaultSearchItem) => void
  showSeparator: boolean
}) {
  return (
    <>
      {showSeparator && <CommandSeparator />}
      <CommandGroup heading={group.vaultName}>
        {group.vaultItems.map((item) => (
          <SearchCommandItem
            icon="vault"
            item={item}
            key={`${item.kind}:${item.id}`}
            onSelect={onSelect}
          />
        ))}
        {group.spaces.map((space) => (
          <SearchCommandItem
            icon="space"
            item={space}
            key={`${space.kind}:${space.id}`}
            onSelect={onSelect}
          />
        ))}
        {group.resourcesBySpace.map((spaceGroup) => (
          <div className="flex flex-col gap-0.5" key={spaceGroup.spaceId}>
            <div className="px-8 py-1 text-[11px] text-fg-dim">
              {spaceGroup.spaceName}
            </div>
            {spaceGroup.resources.map((item) => (
              <SearchCommandItem
                icon="resource"
                item={item}
                key={`${item.kind}:${item.id}`}
                onSelect={onSelect}
              />
            ))}
          </div>
        ))}
      </CommandGroup>
    </>
  )
}

function SearchCommandItem({
  icon,
  item,
  onSelect,
}: {
  icon: "resource" | "space" | "vault"
  item: VaultSearchItem
  onSelect: (item: VaultSearchItem) => void
}) {
  return (
    <CommandItem
      className="my-1 border border-line-soft bg-ink-800/55 px-2.5 py-2 data-selected:border-jade-dim data-selected:bg-ink-750"
      value={[item.title, item.description, item.vaultName, item.spaceName, item.kind]
        .filter(Boolean)
        .join(" ")}
      onSelect={() => onSelect(item)}
    >
      <SearchItemIcon icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{item.title}</span>
        <span className="mt-0.5 block truncate text-xs text-fg-dim">
          {item.description || item.vaultName || getSearchKindLabel(item.kind)}
        </span>
      </span>
      <CommandShortcut>{getSearchKindLabel(item.kind)}</CommandShortcut>
    </CommandItem>
  )
}

type SearchVaultGroup = {
  vaultId: string
  vaultName: string
  vaultItems: VaultSearchItem[]
  spaces: VaultSearchItem[]
  resourcesBySpace: Array<{
    spaceId: string
    spaceName: string
    resources: VaultSearchItem[]
  }>
}

function filterSearchItems(items: VaultSearchItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []

  return items.filter((item) =>
    [item.title, item.description ?? "", item.vaultName ?? "", item.spaceName ?? "", item.kind]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  )
}

function groupSearchItemsByVault(items: VaultSearchItem[]): SearchVaultGroup[] {
  const groups = new Map<string, SearchVaultGroup>()

  for (const item of items) {
    const vaultName = item.vaultName ?? item.title
    const group = groups.get(item.vaultId) ?? {
      vaultId: item.vaultId,
      vaultName,
      vaultItems: [],
      spaces: [],
      resourcesBySpace: [],
    }

    if (item.kind === "vault" || item.kind === "starred") {
      group.vaultItems.push(item)
    } else if (item.kind === "space") {
      group.spaces.push(item)
    } else {
      const spaceId = item.spaceId ?? "unknown"
      const resourcesBySpace =
        group.resourcesBySpace.find((spaceGroup) => spaceGroup.spaceId === spaceId) ??
        {
          spaceId,
          spaceName: item.spaceName ?? "Resources",
          resources: [],
        }

      resourcesBySpace.resources.push(item)
      if (!group.resourcesBySpace.includes(resourcesBySpace)) {
        group.resourcesBySpace.push(resourcesBySpace)
      }
    }

    groups.set(item.vaultId, group)
  }

  return [...groups.values()]
}

function SearchItemIcon({ icon }: { icon: "resource" | "space" | "vault" }) {
  if (icon === "resource") return <FileText />
  if (icon === "space") return <Folder />
  return <Database />
}

function getSearchKindLabel(kind: VaultSearchItem["kind"]) {
  if (kind === "resource") return "Resource"
  if (kind === "space") return "Space"
  if (kind === "starred") return "Star"
  return "Vault"
}

function formatNotificationTime(value: string) {
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return value

  const minutes = Math.max(1, Math.round((Date.now() - time) / 60000))
  if (minutes < 60) return `${minutes}m`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`

  return `${Math.round(hours / 24)}d`
}

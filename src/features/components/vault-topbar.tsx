"use client"

import {
  Bell,
  Clock3,
  Database,
  FileText,
  Folder,
  LogIn,
  LogOut,
  Search,
  Star,
} from "lucide-react"
import { pinyin } from "pinyin-pro"
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
  CommandShortcut,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { getInitials } from "@/features/components/view-models"

export type VaultSearchItem = {
  id: string
  vaultId: string
  title: string
  kind: "vault" | "space" | "resource"
  resourceId?: string
  spaceId?: string
  spaceName?: string
  vaultName: string
}

export type VaultTopbarPage = "workspace" | "star" | "watch-later"

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
  showAuthEntry,
  searchEnabled,
  unreadNotificationCount,
  currentVaultSearchItems,
  globalSearchItems,
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
  activePage: VaultTopbarPage
  onAuthOpen: () => void
  onHome: () => void
  onNotificationsOpen: () => void
  onOpenConsole: () => void
  onPageChange: (page: VaultTopbarPage) => void
  onSearchSelect: (item: VaultSearchItem) => void
  onSignOut: () => void
  showAuthEntry: boolean
  searchEnabled: boolean
  unreadNotificationCount: number
  currentVaultSearchItems: VaultSearchItem[]
  globalSearchItems: VaultSearchItem[]
}) {
  const [currentVaultSearchOpen, setCurrentVaultSearchOpen] = useState(false)
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false)
  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => notification.type === "resource_submission.created"),
    [notifications]
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!searchEnabled) return
      if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey)) return
      event.preventDefault()
      setGlobalSearchOpen(false)
      setCurrentVaultSearchOpen((open) => !open)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [searchEnabled])

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

      <Button
        className={activePage === "watch-later" ? "border-jade-dim bg-[var(--jade-glow)] text-jade" : ""}
        onClick={() =>
          onPageChange(activePage === "watch-later" ? "workspace" : "watch-later")
        }
        size="sm"
        type="button"
        variant="outline"
      >
        <Clock3 data-icon="inline-start" />
        Watch Later
      </Button>

      {searchEnabled && (
        <>
          <Button
            aria-label="全局搜索"
            className="ml-1 md:hidden"
            onClick={() => setGlobalSearchOpen(true)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Search />
          </Button>
          <button
            className="ml-1 hidden h-[34px] w-full max-w-[420px] items-center gap-2 rounded-lg border border-line bg-ink-800 px-3 text-fg-dim transition hover:border-jade-dim hover:bg-ink-800/80 hover:text-fg focus-visible:border-jade-dim focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--jade-glow)] md:flex"
            onClick={() => setGlobalSearchOpen(true)}
            type="button"
          >
            <Search className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 text-left text-sm">全局搜索</span>
          </button>

          <VaultSearchDialog
            defaultKind="vault"
            description="搜索客户端已缓存的 Vault、Space 与 Resource。"
            emptyLabel="还没有可搜索的 Vault"
            items={globalSearchItems}
            onOpenChange={setGlobalSearchOpen}
            onSelect={onSearchSelect}
            open={globalSearchOpen}
            placeholder="Vault、Space 或 Resource 标题"
            title="全局搜索"
          />
          <VaultSearchDialog
            defaultKind="space"
            description="定位当前 Vault 中的 Space 或 Resource。"
            emptyLabel="当前 Vault 没有 Space"
            items={currentVaultSearchItems}
            onOpenChange={setCurrentVaultSearchOpen}
            onSelect={onSearchSelect}
            open={currentVaultSearchOpen}
            placeholder="Space 或 Resource 标题"
            title="当前 Vault"
          />
        </>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <Popover
          onOpenChange={(open) => {
            if (open) onNotificationsOpen()
          }}
        >
          <PopoverTrigger
            render={
            <Button className="relative text-fg-dim" size="icon" variant="ghost" type="button">
              <Bell />
              {unreadNotificationCount > 0 && (
                <span className="mono absolute right-0.5 top-0.5 min-w-4 rounded-chip bg-jade px-1 text-[9px] font-semibold leading-4 text-[#04140f]">
                  {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                </span>
              )}
              <span className="sr-only">通知</span>
            </Button>
            }
          />
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

function VaultSearchDialog({
  defaultKind,
  description,
  emptyLabel,
  items,
  onOpenChange,
  onSelect,
  open,
  placeholder,
  title,
}: {
  defaultKind: "vault" | "space"
  description: string
  emptyLabel: string
  items: VaultSearchItem[]
  onOpenChange: (open: boolean) => void
  onSelect: (item: VaultSearchItem) => void
  open: boolean
  placeholder: string
  title: string
}) {
  const [query, setQuery] = useState("")
  const indexedItems = useMemo(
    () => items.map(createIndexedSearchItem),
    [items],
  )
  const hasQuery = query.trim().length > 0
  const visibleItems = useMemo(
    () =>
      hasQuery
        ? filterSearchItems(indexedItems, query)
        : indexedItems.filter((item) => item.kind === defaultKind),
    [defaultKind, hasQuery, indexedItems, query],
  )

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  function selectItem(item: VaultSearchItem) {
    onSelect(item)
    onOpenChange(false)
  }

  return (
    <CommandDialog
      className="border-line bg-ink-850 text-fg sm:max-w-[640px]"
      description={description}
      onOpenChange={onOpenChange}
      open={open}
      title={title}
    >
      <Command className="bg-ink-850 text-fg" shouldFilter={false}>
        <CommandInput
          placeholder={placeholder}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[min(520px,calc(100dvh-180px))]">
          {visibleItems.length > 0 ? (
            <SearchResultGroups
              items={visibleItems}
              onSelect={selectItem}
              showVaultContext={defaultKind === "vault"}
            />
          ) : (
            <CommandEmpty>{hasQuery ? "没有匹配的标题" : emptyLabel}</CommandEmpty>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}

function SearchResultGroups({
  items,
  onSelect,
  showVaultContext,
}: {
  items: VaultSearchItem[]
  onSelect: (item: VaultSearchItem) => void
  showVaultContext: boolean
}) {
  const vaults = items.filter((item) => item.kind === "vault")
  const spaces = items.filter((item) => item.kind === "space")
  const resources = items.filter((item) => item.kind === "resource")

  return (
    <>
      {vaults.length > 0 && (
        <CommandGroup heading="Vaults">
          {vaults.map((vault) => (
            <SearchCommandItem
              item={vault}
              key={`${vault.kind}:${vault.id}`}
              onSelect={onSelect}
              showVaultContext={showVaultContext}
            />
          ))}
        </CommandGroup>
      )}
      {spaces.length > 0 && (
        <CommandGroup heading="Spaces">
          {spaces.map((space) => (
            <SearchCommandItem
              item={space}
              key={`${space.kind}:${space.id}`}
              onSelect={onSelect}
              showVaultContext={showVaultContext}
            />
          ))}
        </CommandGroup>
      )}
      {resources.length > 0 && (
        <CommandGroup heading="Resources">
          {resources.map((resource) => (
            <SearchCommandItem
              item={resource}
              key={`${resource.kind}:${resource.id}`}
              onSelect={onSelect}
              showVaultContext={showVaultContext}
            />
          ))}
        </CommandGroup>
      )}
    </>
  )
}

function SearchCommandItem({
  item,
  onSelect,
  showVaultContext,
}: {
  item: VaultSearchItem
  onSelect: (item: VaultSearchItem) => void
  showVaultContext: boolean
}) {
  const context =
    item.kind === "resource"
      ? [showVaultContext ? item.vaultName : "", item.spaceName].filter(Boolean).join(" / ")
      : item.kind === "space" && showVaultContext
        ? item.vaultName
        : ""

  return (
    <CommandItem
      className="my-1 border border-line-soft bg-ink-800/55 px-2.5 py-2 data-selected:border-jade-dim data-selected:bg-ink-750"
      value={`${item.kind}:${item.id}`}
      onSelect={() => onSelect(item)}
    >
      {item.kind === "vault" ? <Database /> : item.kind === "space" ? <Folder /> : <FileText />}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{item.title}</span>
        {context && (
          <span className="mt-0.5 block truncate text-xs text-fg-dim">
            {context}
          </span>
        )}
      </span>
      <CommandShortcut>
        {item.kind === "vault" ? "Vault" : item.kind === "space" ? "Space" : "Resource"}
      </CommandShortcut>
    </CommandItem>
  )
}

type IndexedSearchItem = VaultSearchItem & {
  normalizedTitle: string
  fullPinyin: string
  pinyinInitials: string
}

const SEARCH_KIND_ORDER: Record<VaultSearchItem["kind"], number> = {
  vault: 0,
  space: 1,
  resource: 2,
}

function createIndexedSearchItem(item: VaultSearchItem): IndexedSearchItem {
  const pinyinParts = pinyin(item.title, {
    toneType: "none",
    type: "array",
  })
    .map(normalizeSearchText)
    .filter(Boolean)

  return {
    ...item,
    normalizedTitle: normalizeSearchText(item.title),
    fullPinyin: pinyinParts.join(""),
    pinyinInitials: pinyinParts.map((part) => part[0]).join(""),
  }
}

function filterSearchItems(items: IndexedSearchItem[], query: string) {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return []

  return items
    .map((item) => ({ item, score: getSearchScore(item, normalizedQuery) }))
    .filter(
      (result): result is { item: IndexedSearchItem; score: number } =>
        result.score !== null,
    )
    .sort(
      (left, right) =>
        left.score - right.score ||
        SEARCH_KIND_ORDER[left.item.kind] - SEARCH_KIND_ORDER[right.item.kind] ||
        left.item.title.localeCompare(right.item.title, "zh-CN"),
    )
    .slice(0, 80)
    .map(({ item }) => item)
}

function getSearchScore(item: IndexedSearchItem, query: string) {
  if (item.normalizedTitle === query) return 0
  if (item.normalizedTitle.startsWith(query)) return 1
  if (item.normalizedTitle.includes(query)) return 2
  if (item.pinyinInitials === query) return 3
  if (item.pinyinInitials.startsWith(query)) return 4
  if (item.pinyinInitials.includes(query)) return 5
  if (item.fullPinyin.startsWith(query)) return 6
  if (item.fullPinyin.includes(query)) return 7
  return null
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
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

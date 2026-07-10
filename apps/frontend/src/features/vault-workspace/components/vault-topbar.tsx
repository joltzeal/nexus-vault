"use client"

import { Bell, LogIn, LogOut, Search } from "lucide-react"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { getInitials } from "@/features/vault-workspace/components/view-models"

export function VaultTopbar({
  currentUserName,
  isSignedIn,
  isSessionPending,
  notifications,
  onAuthOpen,
  onNotificationsOpen,
  onSignOut,
  onQueryChange,
  query,
  unreadNotificationCount,
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
  onAuthOpen: () => void
  onNotificationsOpen: () => void
  onSignOut: () => void
  onQueryChange: (value: string) => void
  query: string
  unreadNotificationCount: number
}) {
  const visibleNotifications = useMemo(
    () => notifications.filter((notification) => notification.type === "resource_submission.created"),
    [notifications]
  )

  return (
    <header className="col-span-full flex h-[52px] items-center gap-4 border-b border-line bg-ink-850/70 px-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 font-display text-[15px] font-semibold">
        <span className="grid size-6 place-items-center rounded-[7px] bg-linear-to-br from-jade to-[#2a9c93] text-[13px] font-bold text-[#04140f] shadow-[0_0_0_1px_rgba(63,216,176,.4),0_4px_14px_-4px_var(--jade)]">
          N
        </span>
        <span>Nexus<span className="text-jade">Vault</span></span>
      </div>

      <div className="relative ml-1 hidden w-full max-w-[420px] items-center md:flex">
        <Search className="pointer-events-none absolute left-3 text-fg-dim" />
        <input
          className="h-[34px] w-full rounded-input border border-line bg-ink-800 px-9 pr-14 text-sm text-fg outline-none transition focus:border-jade-dim focus:shadow-[0_0_0_3px_var(--jade-glow)]"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索资源、链接、metadata..."
          value={query}
        />
        <kbd className="mono absolute right-2 rounded-sm border border-line bg-ink-850 px-1.5 py-0.5 text-[10.5px] text-fg-dim">
          ⌘K
        </kbd>
      </div>

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
        ) : (
          <Button size="sm" variant="outline" onClick={onAuthOpen} disabled={isSessionPending}>
            <LogIn data-icon="inline-start" />
            登录
          </Button>
        )}
        <div className="grid size-[30px] place-items-center rounded-chip border border-line bg-linear-to-br from-[#3a5a6e] to-[#243846] text-xs font-semibold">
          {getInitials(currentUserName ?? "")}
        </div>
      </div>
    </header>
  )
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

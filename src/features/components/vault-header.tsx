"use client"

import Link from "next/link"
import { useState } from "react"
import {
  ChevronDown,
  Ellipsis,
  Eye,
  EyeOff,
  FolderPlus,
  GitFork,
  Inbox,
  Pencil,
  Share2,
  Star,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { ResourceSet } from "@/features/types"
import { cn } from "@/lib/utils"
import { getInitials, getVaultStats, getVisibilityCopy } from "./view-models"
import { VaultCover } from "./vault-cover"

export function VaultHeader({
  canAddResource,
  collaboratorsCount,
  disabled,
  isVaultOwner,
  isShareMode,
  mediaVisible,
  onAddResource,
  onCreateSpace,
  onDeleteVault,
  onEditVault,
  onForkVault,
  onOpenSettings,
  onToggleMediaVisibility,
  onToggleStar,
  pendingSubmissionCount,
  set,
}: {
  canAddResource: boolean
  collaboratorsCount: number
  disabled: boolean
  isVaultOwner: boolean
  isShareMode: boolean
  mediaVisible: boolean
  onAddResource: () => void
  onCreateSpace: () => void
  onDeleteVault: () => void
  onEditVault: () => void
  onForkVault: () => void
  onOpenSettings: (tab: "share" | "members" | "submissions") => void
  onToggleMediaVisibility: (visible: boolean) => void
  onToggleStar: () => void
  pendingSubmissionCount: number
  set?: ResourceSet
}) {
  const visibility = set?.visibility ?? "private"
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  return (
    <>
      <section className="mb-2 flex items-start gap-4 border-b border-line pb-[18px]">
        <Link
          aria-label="返回首页"
          className="grid size-14 shrink-0 place-items-center rounded-card border border-line bg-linear-to-br from-[#1d4a44] to-[#0f2a30] font-display text-[22px] font-bold text-jade transition hover:border-jade-dim hover:text-jade-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-dim"
          href="/"
          title="返回首页"
        >
          <VaultCover
            className="border-0 text-[22px]"
            fallback={getInitials(set?.name)}
            value={set?.cover}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex min-w-0 max-w-full flex-1 items-baseline gap-2">
                  <h1 className="min-w-0 truncate font-display text-[21px] font-semibold">
                    {set?.name ?? "创建第一个 Vault"}
                  </h1>
                  {set && (
                    <span className="max-w-[180px] shrink-0 truncate whitespace-nowrap text-fg-dim">
                      by {set.ownerName}
                    </span>
                  )}
                </div>
                <Badge
                  className={cn(
                    "shrink-0 gap-1 rounded-chip border px-2.5",
                    visibility === "public"
                      ? "border-jade-dim bg-[var(--jade-glow)] text-jade"
                      : visibility === "password"
                        ? "border-amber/25 bg-amber/10 text-amber"
                        : "border-line bg-ink-800 text-fg-muted"
                  )}
                  variant="outline"
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {getVisibilityCopy(visibility)}
                </Badge>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap justify-start gap-2 lg:justify-end">
              {isShareMode && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onToggleMediaVisibility(!mediaVisible)}
                  disabled={!set}
                >
                  {mediaVisible ? <Eye data-icon="inline-start" /> : <EyeOff data-icon="inline-start" />}
                  NSFW
                </Button>
              )}
              {canAddResource && (
                <Button size="sm" onClick={onAddResource} disabled={disabled || !set}>
                  <UserPlus data-icon="inline-start" />
                  添加资源
                </Button>
              )}
              {isVaultOwner && (
                <>
                  <Button size="sm" variant="outline" onClick={onCreateSpace} disabled={disabled || !set}>
                    <FolderPlus data-icon="inline-start" />
                    Space
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                      <Button size="sm" variant="outline" disabled={!set}>
                        管理
                        <ChevronDown data-icon="inline-end" />
                      </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="min-w-40 border-line bg-ink-850 text-fg">
                      <DropdownMenuItem onClick={() => onOpenSettings("members")}>
                        <Users />
                        协作
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenSettings("share")}>
                        <Share2 />
                        分享
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenSettings("submissions")}>
                        <Inbox />
                        收集{pendingSubmissionCount > 0 ? ` ${pendingSubmissionCount}` : ""}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                      <Button
                        aria-label="更多 Vault 操作"
                        className="w-9 px-0"
                        size="sm"
                        variant="outline"
                        disabled={!set}
                      >
                        <Ellipsis />
                      </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="min-w-36 border-line bg-ink-850 text-fg">
                      <DropdownMenuItem onClick={onEditVault}>
                        <Pencil />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-line-soft" />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteDialogOpen(true)}
                      >
                        <Trash2 />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
              {!isVaultOwner && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onToggleStar}
                    disabled={disabled || !set}
                    className={cn(set?.isStarred && "border-jade-dim bg-[var(--jade-glow)] text-jade")}
                  >
                    <Star data-icon="inline-start" />
                    {set?.starCount ?? 0}
                  </Button>
                  <Button size="sm" variant="outline" onClick={onForkVault} disabled={disabled || !set}>
                    <GitFork data-icon="inline-start" />
                    {set?.forkCount ?? 0}
                  </Button>
                </>
              )}
            </div>
          </div>
          {set?.description.trim() && (
            <p className="mt-1 max-w-[760px] text-[13px] text-fg-muted">
              {set.description}
            </p>
          )}
          <div className="mt-1 flex items-center gap-4 overflow-x-auto whitespace-nowrap text-xs text-fg-dim">
            {getVaultStats(set, collaboratorsCount).map((stat) => (
              <span className="flex shrink-0 items-center gap-1" key={stat.label}>
                <b className="mono font-medium text-fg-muted">{stat.value}</b>
                {stat.label}
              </span>
            ))}
          </div>
        </div>
      </section>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这个 Vault?</AlertDialogTitle>
            <AlertDialogDescription>
              此操作会归档当前 vault，资源、space、分享入口和协作入口都将无法继续使用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDeleteDialogOpen(false)
                onDeleteVault()
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

"use client"

import { FolderPlus, GitFork, Inbox, Share2, Star, UserPlus, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ResourceSet } from "@/features/vault-workspace/types"
import { cn } from "@/lib/utils"
import { getInitials, getVaultStats, getVisibilityCopy } from "./view-models"

export function VaultHeader({
  collaboratorsCount,
  disabled,
  isVaultOwner,
  onAddResource,
  onCreateSpace,
  onForkVault,
  onOpenSettings,
  onToggleStar,
  pendingSubmissionCount,
  set,
}: {
  collaboratorsCount: number
  disabled: boolean
  isVaultOwner: boolean
  onAddResource: () => void
  onCreateSpace: () => void
  onForkVault: () => void
  onOpenSettings: (tab: "share" | "members" | "submissions") => void
  onToggleStar: () => void
  pendingSubmissionCount: number
  set?: ResourceSet
}) {
  const visibility = set?.visibility ?? "private"

  return (
    <section className="mb-2 flex items-start gap-4 border-b border-line pb-[18px]">
      <div className="grid size-14 shrink-0 place-items-center rounded-card border border-line bg-linear-to-br from-[#1d4a44] to-[#0f2a30] font-display text-[22px] font-bold text-jade">
        {getInitials(set?.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="truncate font-display text-[21px] font-semibold">{set?.name ?? "创建第一个 Vault"}</h1>
          {set && <span className="text-fg-dim">by {set.ownerName}</span>}
          <Badge
            className={cn(
              "gap-1 rounded-chip border px-2.5",
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
        {set?.description.trim() && (
          <p className="mt-1 max-w-[760px] text-[13px] text-fg-muted">
            {set.description}
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-4 text-xs text-fg-dim">
          {getVaultStats(set, collaboratorsCount).map((stat) => (
            <span className="flex items-center gap-1" key={stat.label}>
              <b className="mono font-medium text-fg-muted">{stat.value}</b>
              {stat.label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        {isVaultOwner && (
          <>
            <Button size="sm" variant="outline" onClick={() => onOpenSettings("members")} disabled={!set}>
              <Users data-icon="inline-start" />
              成员
            </Button>
            <Button size="sm" variant="outline" onClick={() => onOpenSettings("share")} disabled={!set}>
              <Share2 data-icon="inline-start" />
              分享
            </Button>
            <Button size="sm" variant="outline" onClick={() => onOpenSettings("submissions")} disabled={!set}>
              <Inbox data-icon="inline-start" />
              收集{pendingSubmissionCount > 0 ? ` ${pendingSubmissionCount}` : ""}
            </Button>
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
        {isVaultOwner && (
          <>
            <Button size="sm" variant="outline" onClick={onCreateSpace} disabled={disabled || !set}>
              <FolderPlus data-icon="inline-start" />
              Space
            </Button>
            <Button size="sm" onClick={onAddResource} disabled={disabled || !set}>
              <UserPlus data-icon="inline-start" />
              添加资源
            </Button>
          </>
        )}
      </div>
    </section>
  )
}

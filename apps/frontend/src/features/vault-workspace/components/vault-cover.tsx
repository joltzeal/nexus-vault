"use client"

import type { LucideIcon } from "lucide-react"
import {
  Archive,
  BookOpen,
  Boxes,
  Compass,
  Database,
  Film,
  FolderGit2,
  Link2,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react"

import { cn } from "@/lib/utils"

export type VaultCoverOption = {
  value: string
  label: string
  icon: LucideIcon
  backgroundClassName: string
  iconClassName: string
}

export const vaultCoverOptions: VaultCoverOption[] = [
  {
    value: "vault-cover:archive",
    label: "Archive",
    icon: Archive,
    backgroundClassName: "bg-[linear-gradient(135deg,#16213e,#0f766e)]",
    iconClassName: "text-emerald-100",
  },
  {
    value: "vault-cover:library",
    label: "Library",
    icon: BookOpen,
    backgroundClassName: "bg-[linear-gradient(135deg,#3b1f5f,#0f3a5a)]",
    iconClassName: "text-violet-100",
  },
  {
    value: "vault-cover:media",
    label: "Media",
    icon: Film,
    backgroundClassName: "bg-[linear-gradient(135deg,#581c32,#17406f)]",
    iconClassName: "text-rose-100",
  },
  {
    value: "vault-cover:data",
    label: "Data",
    icon: Database,
    backgroundClassName: "bg-[linear-gradient(135deg,#123524,#243b55)]",
    iconClassName: "text-cyan-100",
  },
  {
    value: "vault-cover:research",
    label: "Research",
    icon: Search,
    backgroundClassName: "bg-[linear-gradient(135deg,#334155,#14532d)]",
    iconClassName: "text-lime-100",
  },
  {
    value: "vault-cover:links",
    label: "Links",
    icon: Link2,
    backgroundClassName: "bg-[linear-gradient(135deg,#1f2937,#7c2d12)]",
    iconClassName: "text-amber-100",
  },
  {
    value: "vault-cover:collection",
    label: "Collection",
    icon: Boxes,
    backgroundClassName: "bg-[linear-gradient(135deg,#0f172a,#155e75)]",
    iconClassName: "text-sky-100",
  },
  {
    value: "vault-cover:project",
    label: "Project",
    icon: FolderGit2,
    backgroundClassName: "bg-[linear-gradient(135deg,#312e81,#0f766e)]",
    iconClassName: "text-indigo-100",
  },
  {
    value: "vault-cover:map",
    label: "Map",
    icon: Compass,
    backgroundClassName: "bg-[linear-gradient(135deg,#164e63,#713f12)]",
    iconClassName: "text-orange-100",
  },
  {
    value: "vault-cover:tools",
    label: "Tools",
    icon: Wrench,
    backgroundClassName: "bg-[linear-gradient(135deg,#374151,#365314)]",
    iconClassName: "text-yellow-100",
  },
  {
    value: "vault-cover:spark",
    label: "Spark",
    icon: Sparkles,
    backgroundClassName: "bg-[linear-gradient(135deg,#4c1d95,#155e75)]",
    iconClassName: "text-fuchsia-100",
  },
]

export function getVaultCoverOption(value?: string | null) {
  return vaultCoverOptions.find((option) => option.value === value)
}

export function VaultCover({
  className,
  fallback,
  iconClassName,
  value,
}: {
  className?: string
  fallback?: string
  iconClassName?: string
  value?: string | null
}) {
  const option = getVaultCoverOption(value)

  if (!option) {
    return (
      <div
        className={cn(
          "grid size-full place-items-center rounded-card border border-line bg-linear-to-br from-[#1d4a44] to-[#0f2a30] font-display font-bold text-jade",
          className
        )}
      >
        {fallback}
      </div>
    )
  }

  const Icon = option.icon

  return (
    <div
      className={cn(
        "relative grid size-full place-items-center overflow-hidden rounded-card border border-line",
        option.backgroundClassName,
        className
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,.24),transparent_30%),radial-gradient(circle_at_80%_85%,rgba(255,255,255,.16),transparent_28%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/28 to-transparent" />
      <Icon
        aria-hidden="true"
        className={cn("relative size-1/2 drop-shadow-[0_8px_22px_rgba(0,0,0,.35)]", option.iconClassName, iconClassName)}
        strokeWidth={1.8}
      />
    </div>
  )
}

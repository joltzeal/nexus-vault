import type { LucideIcon } from "lucide-react"

export type DashboardView = "all-vaults" | "starred-vaults" | "watch-later" | "shared-vaults" | "flash-stash"

export type DashboardNavItem = {
  id: DashboardView
  label: string
  href: string
  icon: LucideIcon
}

export type DashboardVaultItem = {
  id: string
  title: string
  cover?: string
  resourceCount?: number
  isActive?: boolean
}

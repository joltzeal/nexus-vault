"use client"

import { Plus, Star } from "lucide-react"

import type { ResourceSet } from "@/features/vault-workspace/types"
import { cn } from "@/lib/utils"

export function VaultSidebar({
  activeSetId,
  disabled,
  onCreateVault,
  onSelectVault,
  sets,
  starredVaults,
  totalResources,
}: {
  activeSetId: string
  disabled: boolean
  onCreateVault: () => void
  onSelectVault: (id: string) => void
  sets: ResourceSet[]
  starredVaults: Array<{
    id: string
    title: string
    starCount: number
  }>
  totalResources: number
}) {
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
              <span className="mono text-[10.5px] text-fg-dim">{set.resources.length}</span>
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
                onClick={() => onSelectVault(vault.id)}
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
        <div className="mono mb-1.5 flex justify-between text-[10.5px] text-fg-dim">
          <span>R2 usage</span>
          <span>{totalResources} res</span>
        </div>
        <div className="h-1 overflow-hidden rounded-chip bg-ink-700">
          <span
            className="block h-full rounded-chip bg-linear-to-r from-jade to-[#2a9c93]"
            style={{ width: `${Math.min(84, Math.max(18, totalResources * 4))}%` }}
          />
        </div>
      </div>
    </aside>
  )
}

function vaultDotColor(index: number) {
  const colors = ["#3fd8b0", "#5cb9f0", "#9b8cff", "#e8b34a", "#f0697a"]
  return colors[index % colors.length]
}

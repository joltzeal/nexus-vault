export type VaultResourceViewMode = "list" | "masonry"

export const VAULT_RESOURCE_VIEW_MODE_STORAGE_KEY =
  "nexus-vault:resource-view-mode"

export function getStoredVaultResourceViewMode(): VaultResourceViewMode {
  if (typeof window === "undefined") return "list"
  try {
    return window.localStorage.getItem(VAULT_RESOURCE_VIEW_MODE_STORAGE_KEY) ===
      "masonry"
      ? "masonry"
      : "list"
  } catch {
    return "list"
  }
}

export function storeVaultResourceViewMode(mode: VaultResourceViewMode) {
  try {
    window.localStorage.setItem(VAULT_RESOURCE_VIEW_MODE_STORAGE_KEY, mode)
  } catch {
    // Keep the current page state when browser storage is unavailable.
  }
}

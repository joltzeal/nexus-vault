import { headers } from "next/headers"
import { getCloudflareContext } from "@opennextjs/cloudflare"

import { getDb } from "@nexus-vault/db"
import { createAuth } from "@nexus-vault/auth/server"
import { listVaults, getVaultDetail } from "@/server/services/vault-service"
import { mapVaultDetail, mapVaultListItem } from "@/features/vault-workspace/mappers"
import type { VaultWorkspaceInitialData } from "@/features/vault-workspace/types"

export async function loadVaultWorkspace(): Promise<VaultWorkspaceInitialData> {
  let actorId: string | undefined
  let actorEmail: string | undefined
  let actorName: string | null | undefined

  try {
    const cloudflare = await getCloudflareContext({ async: true })
    const db = getDb(cloudflare.env.DB)
    const requestHeaders = await headers()
    const session = await createAuth(cloudflare.env, cloudflare.ctx).api.getSession({
      headers: new Headers(requestHeaders),
    })
    const actor =
      session?.user?.id && session.user.email
        ? {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
          }
        : undefined
    actorEmail = actor?.email
    actorName = actor?.name
    actorId = actor?.id
    if (!actor) {
      return {
        sets: [],
        activeSetId: "",
      }
    }

    const vaultRows = await listVaults(db, { actor })
    const activeVaultId = vaultRows[0]?.id

    if (!activeVaultId) {
      return {
        sets: [],
        activeSetId: "",
        actorId,
        actorEmail,
        actorName,
      }
    }

    const detail = await getVaultDetail(db, activeVaultId, { actor })
    const hydratedSet = mapVaultDetail(detail)

    return {
      sets: vaultRows.map((vault) =>
        vault.id === hydratedSet.id ? hydratedSet : mapVaultListItem(vault)
      ),
      activeSetId: hydratedSet.id,
      actorId,
      actorEmail,
      actorName,
    }
  } catch (error) {
    return {
      sets: [],
      activeSetId: "",
      actorId,
      actorEmail,
      actorName,
      error: error instanceof Error ? error.message : "Failed to load workspace.",
    }
  }
}

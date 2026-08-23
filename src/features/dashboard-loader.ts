import type { Viewer } from "@/auth/session"
import { createDbSession } from "@/db"
import { mapVaultDetail, mapVaultListItem } from "@/features/mappers"
import type { VaultWorkspaceInitialData } from "@/features/types"
import type { Actor } from "@/server/api/types"
import { getVaultDetail, listVaults } from "@/server/services/vault-service"

type VaultListRow = Parameters<typeof mapVaultListItem>[0]

export async function loadDashboardWorkspace(
  viewer: Viewer,
  env?: Partial<CloudflareEnv>,
  input: {
    vaultId?: string
  } = {},
): Promise<VaultWorkspaceInitialData> {
  const actor: Actor = {
    id: viewer.id,
    email: viewer.email,
    name: viewer.name,
  }

  let database: Awaited<ReturnType<typeof createDbSession>> | undefined

  try {
    database = await createDbSession(env)
    const db = database.db
    const vaultRows = (await listVaults(db, { actor })) as VaultListRow[]
    const activeVaultId = input.vaultId || vaultRows[0]?.id

    if (!activeVaultId) {
      return {
        sets: [],
        activeSetId: "",
        actorId: actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
      }
    }

    const detail = await getVaultDetail(db, activeVaultId, { actor })
    const hydratedSet = mapVaultDetail(detail)
    const isOwnedVault = vaultRows.some((vault) => vault.id === hydratedSet.id)

    return {
      sets: vaultRows.map((vault) =>
        vault.id === hydratedSet.id ? hydratedSet : mapVaultListItem(vault),
      ),
      activeSetId: hydratedSet.id,
      externalActiveSet: isOwnedVault ? undefined : hydratedSet,
      actorId: actor.id,
      actorEmail: actor.email,
      actorName: actor.name,
    }
  } catch (error) {
    return {
      sets: [],
      activeSetId: "",
      actorId: actor.id,
      actorEmail: actor.email,
      actorName: actor.name,
      error: error instanceof Error ? error.message : "Failed to load workspace.",
    }
  } finally {
    await database?.close().catch((error) => {
      console.error("Dashboard database session close failed", { error })
    })
  }
}

import { loadVaultWorkspace } from "@/features/vault-workspace/server-loader"
import { Home } from "@/features/vault-workspace/components/home"
import { VaultWorkspaceClient } from "@/features/vault-workspace/vault-workspace-client"

export default async function Page() {
  const initialData = await loadVaultWorkspace()

  if (initialData.actorEmail) {
    return <VaultWorkspaceClient initialData={initialData} />
  }

  return <Home />
}

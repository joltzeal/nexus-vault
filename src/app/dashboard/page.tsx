import { getCloudflareContext } from "@opennextjs/cloudflare"

import { requireViewer } from "@/auth/session"
import { VaultWorkspaceClient } from "@/features/dashboard"
import { loadDashboardWorkspace } from "@/features/dashboard-loader"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const { env } = await getCloudflareContext({ async: true })
  const viewer = await requireViewer(env)
  const initialData = await loadDashboardWorkspace(viewer, env)

  return <VaultWorkspaceClient initialData={initialData} />
}

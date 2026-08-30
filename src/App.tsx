import { Navigate, Outlet, Route, Routes, useOutletContext } from "react-router-dom"

import { authClient } from "./auth"
import { DashboardPage } from "./pages/dashboard"
import { DashboardViewPage } from "./pages/dashboard/views/dashboard-view-pages"
import { HomePage } from "./pages/home"
import { VaultDetailPage } from "./pages/vault/vault-detail-page"
import { PublicShareShell } from "./app/public-share-shell"
import { SharedVaultPage } from "./pages/share/shared-vault-page"
import { SettingsPage } from "./pages/settings"
import type { DashboardOutletContext } from "./app/dashboard-shell"

function ProtectedDashboard() {
  const session = authClient.useSession()
  if (session.isPending) return <div className="grid min-h-[100dvh] place-items-center bg-background text-sm text-muted-foreground">Loading session...</div>
  if (!session.data) return <Navigate replace to="/login" />
  return <DashboardPage />
}

function DashboardOutlet() {
  const context = useOutletContext<DashboardOutletContext>()
  return <Outlet context={context} />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<HomePage />} />
      <Route path="/signup" element={<HomePage />} />
      <Route path="/dashboard" element={<ProtectedDashboard />}>
        <Route element={<DashboardOutlet />}>
          <Route index element={<DashboardViewPage view="all-vaults" />} />
          <Route path="starred" element={<DashboardViewPage view="starred-vaults" />} />
          <Route path="watch-later" element={<DashboardViewPage view="watch-later" />} />
          <Route path="shared" element={<DashboardViewPage view="shared-vaults" />} />
          <Route path="settings" element={<SettingsRoute />} />
          <Route path="vault/:vaultId" element={<VaultDetailPage />} />
        </Route>
      </Route>
      <Route path="/s/:shareSlug" element={<PublicShareShell />}>
        <Route index element={<SharedVaultPage />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  )
}

function SettingsRoute() {
  const context = useOutletContext<DashboardOutletContext>()
  return <SettingsPage {...context} />
}

export default App

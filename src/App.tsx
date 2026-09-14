import { Navigate, Outlet, Route, Routes, useNavigate, useOutletContext } from "react-router-dom"
import { useEffect } from "react"

import { authClient } from "./auth"
import { DashboardPage } from "./pages/dashboard"
import { DashboardViewPage, FlashStashPage } from "./pages/dashboard/views/dashboard-view-pages"
import { HomePage } from "./pages/home"
import { VaultDetailPage } from "./pages/vault/vault-detail-page"
import { PublicShareShell } from "./app/public-share-shell"
import { SharedVaultPage } from "./pages/share/shared-vault-page"
import { SettingsPage } from "./pages/settings"
import type { DashboardOutletContext } from "./app/dashboard-shell"
import { Spinner } from "./components/aicanvas/andromeda/components/Spinner"
import { onUnauthorized } from "./lib/api-client"

function ProtectedDashboard() {
  const session = authClient.useSession()
  if (session.isPending) return <div className="flex min-h-[100dvh] items-center justify-center gap-2 bg-background text-sm text-muted-foreground"><Spinner variant="accent" size="sm" label="Loading session" />Loading session...</div>
  if (!session.data) return <Navigate replace to="/login" />
  return <DashboardPage />
}

function DashboardOutlet() {
  const context = useOutletContext<DashboardOutletContext>()
  return <Outlet context={context} />
}

function App() {
  const navigate = useNavigate()
  useEffect(() => onUnauthorized(() => {
    void authClient.signOut()
    navigate("/login", { replace: true, state: { reason: "expired" } })
  }), [navigate])
  useEffect(() => {
    const refreshSession = () => {
      if (document.visibilityState === "visible") void authClient.getSession()
    }
    document.addEventListener("visibilitychange", refreshSession)
    window.addEventListener("focus", refreshSession)
    return () => {
      document.removeEventListener("visibilitychange", refreshSession)
      window.removeEventListener("focus", refreshSession)
    }
  }, [])
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
          <Route path="flash-stash" element={<FlashStashPage />} />
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

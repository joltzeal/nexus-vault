import { useEffect, useMemo, useState } from "react"

import type { RegistrationMode } from "@/auth/registration"
import { Home } from "@/features/components/home"
import { ShareUnavailableClient } from "@/features/components/share-unavailable-client"
import { ShareUnlockClient } from "@/features/components/share-unlock-client"
import { VaultWorkspaceClient } from "@/features/dashboard"
import type { ApiResponse, VaultWorkspaceInitialData } from "@/features/types"

type BootstrapData = {
  registrationMode: RegistrationMode
  initialData: VaultWorkspaceInitialData | null
  turnstileSiteKey?: string
}

type ShareBootstrapData = {
  share: {
    unavailable: boolean
    passwordRequired: boolean
    initialData: VaultWorkspaceInitialData | null
  } | null
  turnstileSiteKey?: string
}

type AppState =
  | { status: "loading" }
  | { status: "home"; registrationMode: RegistrationMode; turnstileSiteKey?: string }
  | { status: "workspace"; initialData: VaultWorkspaceInitialData }
  | { status: "share-unavailable" }
  | { status: "share-password"; slug: string; turnstileSiteKey?: string }
  | { status: "error"; message: string }

export function App() {
  const [state, setState] = useState<AppState>({ status: "loading" })
  const shareSlug = useMemo(() => getShareSlug(window.location.pathname), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const nextState = shareSlug
          ? await loadShareState(shareSlug)
          : await loadWorkspaceState()
        if (!cancelled) setState(nextState)
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "应用加载失败。",
          })
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [shareSlug])

  if (state.status === "loading") return <LoadingScreen />
  if (state.status === "error") return <ErrorScreen message={state.message} />
  if (state.status === "home") {
    return (
      <Home
        registrationMode={state.registrationMode}
        turnstileSiteKey={state.turnstileSiteKey}
      />
    )
  }
  if (state.status === "share-unavailable") return <ShareUnavailableClient />
  if (state.status === "share-password") {
    return <ShareUnlockClient slug={state.slug} turnstileSiteKey={state.turnstileSiteKey} />
  }

  return <VaultWorkspaceClient initialData={state.initialData} />
}

async function loadWorkspaceState(): Promise<AppState> {
  const data = await apiRequest<BootstrapData>("/api/bootstrap")

  if (!data.initialData) {
    return {
      status: "home",
      registrationMode: data.registrationMode,
      turnstileSiteKey: data.turnstileSiteKey,
    }
  }

  if (window.location.pathname !== "/dashboard") {
    window.history.replaceState(null, "", "/dashboard")
  }

  return { status: "workspace", initialData: data.initialData }
}

async function loadShareState(slug: string): Promise<AppState> {
  const data = await apiRequest<ShareBootstrapData>(
    `/api/bootstrap/share/${encodeURIComponent(slug)}`,
  )

  if (!data.share || data.share.unavailable) return { status: "share-unavailable" }
  if (data.share.passwordRequired || !data.share.initialData) {
    return {
      status: "share-password",
      slug,
      turnstileSiteKey: data.turnstileSiteKey,
    }
  }

  return { status: "workspace", initialData: data.share.initialData }
}

async function apiRequest<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: {
      accept: "application/json",
    },
  })
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message ?? "服务暂时不可用，请稍后再试。")
  }

  return payload.data
}

function getShareSlug(pathname: string) {
  const match = /^\/s\/([^/]+)\/?$/.exec(pathname)
  return match ? decodeURIComponent(match[1]) : null
}

function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-background text-foreground">
      <div className="rounded-card border border-line bg-ink-850 px-4 py-3 text-sm text-fg-muted shadow-pop">
        正在加载 NexusVault
      </div>
    </main>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-card border border-line bg-ink-850 p-5 shadow-pop">
        <h1 className="font-display text-lg font-semibold text-fg">加载失败</h1>
        <p className="mt-2 text-sm leading-6 text-fg-muted">{message}</p>
      </section>
    </main>
  )
}

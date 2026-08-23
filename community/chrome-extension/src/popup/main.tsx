import { StrictMode, useEffect, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import "../app/globals.css"
import {
  APP_ORIGIN,
  type ExtensionRequest,
  type ExtensionResponse,
  type ViewerState,
} from "../shared"

type PopupState =
  | { status: "loading" }
  | { status: "ready"; viewer: ViewerState }
  | { status: "error"; message: string }

function PopupApp() {
  const [state, setState] = useState<PopupState>({ status: "loading" })
  const viewer = state.status === "ready" ? state.viewer : undefined
  const displayName = useMemo(() => getDisplayName(viewer), [viewer])

  useEffect(() => {
    void refresh()
  }, [])

  async function refresh() {
    setState({ status: "loading" })
    const response = await sendMessage<ViewerState>({ type: "GET_VIEWER_STATE", refresh: true })
    setState(response.ok ? { status: "ready", viewer: response.data } : { status: "error", message: response.error })
  }

  async function openLogin() {
    await sendMessage({ type: "OPEN_LOGIN" })
  }

  return (
    <main className="flex w-[360px] flex-col gap-3 bg-background p-3 text-foreground">
      <header className="flex items-center gap-3">
        <img alt="" className="size-9 rounded-lg border border-border" src="/icons/nexus-vault.svg" />
        <div className="min-w-0">
          <h1 className="font-display text-base font-semibold leading-none">Nexus Vault</h1>
          <p className="mt-1 text-xs text-muted-foreground">保存资源到 Space</p>
        </div>
      </header>

      <Separator />

      {state.status === "loading" ? (
        <div className="flex min-h-28 items-center justify-center gap-2 rounded-lg border border-border bg-popover px-3 py-4 text-sm text-muted-foreground">
          <Spinner />
          正在检查登录态...
        </div>
      ) : state.status === "error" ? (
        <section className="rounded-lg border border-border bg-popover px-3 py-3 text-sm text-destructive">
          <p>{state.message}</p>
          <div className="mt-3">
            <Button onClick={() => void refresh()} size="sm" type="button" variant="outline">
              重试
            </Button>
          </div>
        </section>
      ) : !state.viewer.connected ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-popover px-3 py-3 text-sm text-muted-foreground">
          <p>还没有拿到 Nexus Vault 登录态。请先到主页授权登录，登录 cookie 会由浏览器持久化保存。</p>
          <Button onClick={() => void openLogin()} size="sm" type="button">
            打开主页登录
          </Button>
        </section>
      ) : (
        <section className="flex items-center gap-3 rounded-lg border border-border bg-popover px-3 py-3">
          <Avatar className="size-9">
            <AvatarImage alt="" src={state.viewer.viewer?.image ?? undefined} />
            <AvatarFallback className="bg-jade/15 text-jade">
              {displayName.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <strong className="truncate text-sm font-semibold">{displayName}</strong>
              <Badge variant="secondary">已连接</Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">{state.viewer.viewer?.email}</p>
          </div>
          <Button onClick={() => void refresh()} size="icon-sm" type="button" variant="ghost">
            ↻
          </Button>
        </section>
      )}

      <footer className="pt-1">
        <a
          className="text-xs text-jade transition hover:text-jade-bright"
          href={APP_ORIGIN}
          rel="noreferrer"
          target="_blank"
        >
          打开 Nexus Vault
        </a>
      </footer>
    </main>
  )
}

function sendMessage<T = unknown>(message: ExtensionRequest): Promise<ExtensionResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<ExtensionResponse<T>>
}

function getDisplayName(viewer?: ViewerState) {
  return viewer?.viewer?.name?.trim() || viewer?.viewer?.email || "Nexus user"
}

const root = document.getElementById("root")
if (!root) throw new Error("Root element not found.")

createRoot(root).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>,
)

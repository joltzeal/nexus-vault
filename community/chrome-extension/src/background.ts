import {
  APP_ORIGIN,
  STORAGE_KEYS,
  type ApiResponse,
  type AuthState,
  type ExtensionRequest,
  type ExtensionResponse,
  type PreferredTarget,
  type TransferTargetVault,
  type Viewer,
  type ViewerState,
  findPreferredTarget,
  isExtensionRequest,
} from "./shared"

type TransferTargetsResponse = {
  items: TransferTargetVault[]
}

type CreateResourceResponse = {
  id: string
  metadataStatus: "pending" | "processing" | "completed" | "failed"
}

type SessionResponse = {
  user?: Viewer | null
  session?: unknown
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isExtensionRequest(message)) return false

  void handleMessage(message)
    .then((response) => sendResponse(response))
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Nexus Vault request failed.",
        authRequired: error instanceof AuthRequiredError,
      } satisfies ExtensionResponse)
    })

  return true
})

async function handleMessage(message: ExtensionRequest): Promise<ExtensionResponse> {
  if (message.type === "OPEN_LOGIN") {
    await chrome.tabs.create({ url: `${APP_ORIGIN}/`, active: true })
    return { ok: true, data: null }
  }

  if (message.type === "GET_AUTH_STATE") {
    const data = await getAuthState(message.refresh ?? false)
    return { ok: true, data }
  }

  if (message.type === "GET_VIEWER_STATE") {
    const data = await getViewerState(message.refresh ?? false)
    return { ok: true, data }
  }

  if (message.type === "SET_PREFERRED_TARGET") {
    await chrome.storage.local.set({ [STORAGE_KEYS.preferredTarget]: message.target })
    const data = await getAuthState(false)
    return { ok: true, data }
  }

  if (message.type === "SAVE_RESOURCE") {
    const result = await apiRequest<CreateResourceResponse>(
      `/api/v1/vaults/${encodeURIComponent(message.vaultId)}/resources`,
      {
        method: "POST",
        body: JSON.stringify({
          description: message.description ?? "",
          ...(message.referer?.trim() ? { referer: message.referer.trim() } : {}),
          spaceId: message.spaceId,
          ...(message.title?.trim() ? { title: message.title.trim() } : {}),
          url: message.url,
        }),
      },
    )

    const target = await readPreferredTarget()
    if (!target || target.vaultId !== message.vaultId || target.spaceId !== message.spaceId) {
      const authState = await getAuthState(true)
      const vault = authState.targets.find((item) => item.id === message.vaultId)
      const space = vault?.spaces.find((item) => item.id === message.spaceId)
      if (vault && space) {
        await chrome.storage.local.set({
          [STORAGE_KEYS.preferredTarget]: {
            vaultId: vault.id,
            vaultTitle: vault.title,
            spaceId: space.id,
            spaceName: space.name,
          } satisfies PreferredTarget,
        })
      }
    }

    return { ok: true, data: result }
  }

  return { ok: false, error: "Unsupported Nexus Vault message." }
}

async function getAuthState(refresh: boolean): Promise<AuthState> {
  if (!refresh) {
    const cached = await readAuthState()
    if (cached && Date.now() - Date.parse(cached.checkedAt) < 30_000) return cached
  }

  try {
    const data = await apiRequest<TransferTargetsResponse>("/api/v1/resources/transfer-targets")
    const preferredTarget = findPreferredTarget(data.items, await readPreferredTarget())
    const viewerState = await getViewerState(false).catch(() => undefined)
    const state: AuthState = {
      connected: true,
      checkedAt: new Date().toISOString(),
      targets: data.items,
      preferredTarget,
      viewer: viewerState?.viewer,
    }
    await chrome.storage.local.set({
      [STORAGE_KEYS.lastAuthState]: state,
      ...(preferredTarget ? { [STORAGE_KEYS.preferredTarget]: preferredTarget } : {}),
    })
    return state
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      const state: AuthState = {
        connected: false,
        checkedAt: new Date().toISOString(),
        targets: [],
      }
      await chrome.storage.local.set({ [STORAGE_KEYS.lastAuthState]: state })
      return state
    }
    throw error
  }
}

async function getViewerState(refresh: boolean): Promise<ViewerState> {
  if (!refresh) {
    const cached = await readAuthState()
    if (cached && Date.now() - Date.parse(cached.checkedAt) < 30_000) {
      return {
        connected: cached.connected,
        checkedAt: cached.checkedAt,
        viewer: cached.viewer,
      }
    }
  }

  try {
    const session = await rawRequest<SessionResponse>("/api/auth/get-session")
    const viewer = normalizeViewer(session?.user)
    const state: ViewerState = {
      connected: Boolean(viewer),
      checkedAt: new Date().toISOString(),
      viewer,
    }
    const cached = await readAuthState()
    await chrome.storage.local.set({
      [STORAGE_KEYS.lastAuthState]: {
        connected: state.connected,
        checkedAt: state.checkedAt,
        targets: cached?.targets ?? [],
        preferredTarget: cached?.preferredTarget,
        viewer: state.viewer,
      } satisfies AuthState,
    })
    return state
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      const state: ViewerState = {
        connected: false,
        checkedAt: new Date().toISOString(),
      }
      await chrome.storage.local.set({
        [STORAGE_KEYS.lastAuthState]: {
          connected: false,
          checkedAt: state.checkedAt,
          targets: [],
        } satisfies AuthState,
      })
      return state
    }
    throw error
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${APP_ORIGIN}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...init?.headers,
    },
  })

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null
  if (response.status === 401) throw new AuthRequiredError()

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message ?? "Nexus Vault 服务暂时不可用。")
  }

  return payload.data
}

async function rawRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${APP_ORIGIN}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...init?.headers,
    },
  })

  if (response.status === 401) throw new AuthRequiredError()
  const payload = (await response.json().catch(() => null)) as T | null

  if (!response.ok) {
    throw new Error("Nexus Vault 服务暂时不可用。")
  }

  return payload as T
}

async function readAuthState() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.lastAuthState)
  const value = data[STORAGE_KEYS.lastAuthState]
  return isAuthState(value) ? value : undefined
}

async function readPreferredTarget() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.preferredTarget)
  const value = data[STORAGE_KEYS.preferredTarget]
  return isPreferredTarget(value) ? value : undefined
}

function isAuthState(value: unknown): value is AuthState {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as AuthState).connected === "boolean" &&
      typeof (value as AuthState).checkedAt === "string" &&
      Array.isArray((value as AuthState).targets),
  )
}

function normalizeViewer(value: unknown): Viewer | undefined {
  if (!value || typeof value !== "object") return undefined
  const user = value as Viewer
  return typeof user.email === "string"
    ? {
        email: user.email,
        id: typeof user.id === "string" ? user.id : undefined,
        image: typeof user.image === "string" ? user.image : null,
        name: typeof user.name === "string" ? user.name : null,
      }
    : undefined
}

function isPreferredTarget(value: unknown): value is PreferredTarget {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as PreferredTarget).vaultId === "string" &&
      typeof (value as PreferredTarget).spaceId === "string" &&
      typeof (value as PreferredTarget).vaultTitle === "string" &&
      typeof (value as PreferredTarget).spaceName === "string",
  )
}

class AuthRequiredError extends Error {
  constructor() {
    super("请先登录 Nexus Vault。")
  }
}

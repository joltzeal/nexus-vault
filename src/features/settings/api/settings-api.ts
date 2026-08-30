import type { GlobalIntegrations } from "../types"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  })
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const payload = (await response.json()) as { message?: string }
      if (payload.message) message = payload.message
    } catch {
      // Keep the status-based message when the worker does not return JSON.
    }
    throw new Error(message)
  }
  const payload = (await response.json()) as { data?: T; success?: boolean; error?: { message?: string } | null }
  if (payload.success === false) throw new Error(payload.error?.message ?? "Request failed")
  return (payload.data ?? payload) as T
}

export function getAccountIntegrations() {
  return request<GlobalIntegrations>("/account/integrations")
}

export function updateXComCookie(cookieString: string) {
  return request<GlobalIntegrations>("/account/integrations/x-com", {
    body: JSON.stringify({ cookieString }),
    method: "PUT",
  })
}

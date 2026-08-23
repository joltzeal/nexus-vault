import type { ApiResponse } from "@/features/types"

let authRedirectStarted = false

function redirectToSignInWhenUnauthorized(status: number) {
  if (status !== 401 || typeof window === "undefined" || authRedirectStarted) return

  authRedirectStarted = true
  window.location.replace("/")
}

export async function apiRequest<T>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (!(init?.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json")
  }

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
  })

  redirectToSignInWhenUnauthorized(response.status)

  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    throw new Error(response.ok ? "请求返回格式异常。" : "服务暂时不可用，请稍后再试。")
  }

  const payload = (await response.json()) as ApiResponse<T>

  if (!payload.success) {
    throw new Error(payload.error.message)
  }

  return payload.data
}

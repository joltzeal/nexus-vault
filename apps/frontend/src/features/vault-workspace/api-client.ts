import type { ApiResponse } from "@/features/vault-workspace/types"

export async function apiRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  })
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

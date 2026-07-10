import type { ApiResponse } from "@/features/vault-workspace/types"

export async function apiRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  })
  const payload = (await response.json()) as ApiResponse<T>

  if (!payload.success) {
    throw new Error(payload.error.message)
  }

  return payload.data
}

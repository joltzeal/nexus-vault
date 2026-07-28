"use client"

type AuthClientError = {
  code?: string
  message: string
  status?: number
}

type AuthClientResult<T = unknown> =
  | { data: T; error: null }
  | { data: null; error: AuthClientError }

async function authRequest<T>(path: string, body?: unknown): Promise<AuthClientResult<T>> {
  try {
    const response = await fetch(`/api/auth/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const payload = (await response.json().catch(() => null)) as
      | { code?: string; message?: string }
      | T
      | null

    if (!response.ok) {
      const error = payload && typeof payload === "object" ? payload : null
      return {
        data: null,
        error: {
          code: error && "code" in error ? error.code : undefined,
          message:
            error && "message" in error && typeof error.message === "string"
              ? error.message
              : "认证服务暂时不可用。",
          status: response.status,
        },
      }
    }

    return { data: payload as T, error: null }
  } catch (error) {
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : "认证服务暂时不可用。",
      },
    }
  }
}

export const authClient = {
  signIn: {
    email(input: { email: string; password: string }) {
      return authRequest("sign-in/email", input)
    },
  },
  signUp: {
    email(input: { email: string; name: string; password: string }) {
      return authRequest("sign-up/email", input)
    },
  },
  signOut() {
    return authRequest("sign-out", {})
  },
  changePassword(input: {
    currentPassword: string
    newPassword: string
    revokeOtherSessions?: boolean
  }) {
    return authRequest("change-password", input)
  },
  requestPasswordReset(input: { email: string; redirectTo?: string }) {
    return authRequest("request-password-reset", input)
  },
  getSession() {
    return authRequest("get-session")
  },
}

export default authClient

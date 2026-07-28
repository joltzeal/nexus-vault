import type { RegistrationEnv } from "@/auth/registration"

export type AuthRuntimeEnv = Partial<CloudflareEnv> &
  NodeJS.ProcessEnv &
  RegistrationEnv & {
    BETTER_AUTH_SECRET?: string
    BETTER_AUTH_TRUSTED_ORIGINS?: string
    BETTER_AUTH_URL?: string
  }

export function splitAuthOrigins(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean)
}

export function getAuthBaseUrl(env: AuthRuntimeEnv) {
  return (
    env.BETTER_AUTH_URL?.trim().replace(/\/$/, "") ||
    process.env.BETTER_AUTH_URL?.trim().replace(/\/$/, "") ||
    "http://localhost:3000"
  )
}

export function getAuthSecret(env: AuthRuntimeEnv) {
  const secret = env.BETTER_AUTH_SECRET?.trim() || process.env.BETTER_AUTH_SECRET?.trim()
  if (secret) return secret

  if (env.NEXTJS_ENV === "production" || process.env.NEXTJS_ENV === "production") {
    throw new Error("BETTER_AUTH_SECRET is required in production.")
  }

  return "nexus-vault-local-development-secret"
}

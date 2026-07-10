import { betterAuth } from "better-auth/minimal"
import { drizzleAdapter } from "better-auth/adapters/drizzle"

import { betterAuthSchema } from "@nexus-vault/db/better-auth-schema"
import { getDb } from "@nexus-vault/db"

export function createAuth(
  env: CloudflareEnv,
  executionCtx?: {
    waitUntil(promise: Promise<unknown>): void
  }
) {
  const db = getDb(env.DB)

  return betterAuth({
    appName: "NexusVault",
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: betterAuthSchema,
      transaction: false,
    }),
    secondaryStorage: {
      get(key) {
        return env.CACHE.get(key)
      },
      set(key, value, ttl) {
        return env.CACHE.put(
          key,
          value,
          ttl ? { expirationTtl: Math.max(ttl, 60) } : undefined
        )
      },
      delete(key) {
        return env.CACHE.delete(key)
      },
    },
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    verification: {
      storeInDatabase: true,
    },
    advanced: {
      useSecureCookies: env.NEXTJS_ENV === "production",
      trustedProxyHeaders: true,
      backgroundTasks: executionCtx
        ? {
            handler: (promise) => {
              executionCtx.waitUntil(promise)
            },
          }
        : undefined,
    },
    rateLimit: {
      enabled: true,
      storage: "secondary-storage",
    },
    telemetry: {
      enabled: false,
    },
  })
}

export type Auth = ReturnType<typeof createAuth>

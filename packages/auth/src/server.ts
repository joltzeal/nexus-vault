import { betterAuth } from "better-auth/minimal"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware } from "better-auth/api"

import { betterAuthSchema } from "@nexus-vault/db/better-auth-schema"
import type { Db } from "@nexus-vault/db"
import { getRegistrationPolicy } from "./registration-policy"

export function createAuth(
  env: CloudflareEnv,
  db: Db,
  executionCtx?: {
    waitUntil(promise: Promise<unknown>): void
  }
) {
  return betterAuth({
    appName: "NexusVault",
    database: drizzleAdapter(db, {
      provider: "pg",
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
      sendResetPassword:
        env.NEXTJS_ENV === "production"
          ? undefined
          : async ({ user, url }) => {
              console.info(
                `[NexusVault] Password reset link for ${user.email}: ${url}`
              )
            },
    },
    verification: {
      storeInDatabase: true,
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return

        const policy = await getRegistrationPolicy(db, env)
        if (policy.allowSignUp) return

        throw APIError.from("FORBIDDEN", {
          code: "REGISTRATION_DISABLED",
          message: "User registration is disabled.",
        })
      }),
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

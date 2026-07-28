import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { betterAuth } from "better-auth/minimal"
import { withCloudflare } from "better-auth-cloudflare"

import { type AuthRuntimeEnv } from "@/auth/config"
import { getAuthOptions } from "@/auth"
import { schema } from "@/db/schema"

export const auth = betterAuth({
  ...withCloudflare(
    {
      autoDetectIpAddress: false,
      geolocationTracking: false,
    },
    getAuthOptions(process.env as AuthRuntimeEnv),
  ),
  database: drizzleAdapter({} as never, {
    provider: "pg",
    schema,
    camelCase: true,
  }),
})

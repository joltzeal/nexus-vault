import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";

import type { createDb } from "../db";
import {
  user,
  session,
  account,
  verification,
} from "./schema";
type Database = Awaited<
  ReturnType<typeof createDb>
>["db"];

export function  createAuth(
  db: Database,
  env: Env,
) {
  return betterAuth({
    appName: "Nexus Vault",

    baseURL: env.BETTER_AUTH_URL,

    secret: env.BETTER_AUTH_SECRET,

    database: drizzleAdapter(db, {
      provider: "pg",

      schema: {
        user,
        session,
        account,
        verification,
      },
    }),

    emailAndPassword: {
      enabled: true,
    },

    trustedOrigins: [
      env.BETTER_AUTH_URL,
    ],

  });
}

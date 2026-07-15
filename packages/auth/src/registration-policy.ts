import { userTable } from "@nexus-vault/db/better-auth-schema"
import type { getDb } from "@nexus-vault/db"

export type RegistrationPolicyReason = "public-registration" | "first-user" | "disabled"

export type RegistrationPolicy = {
  allowSignUp: boolean
  reason: RegistrationPolicyReason
}

type Db = ReturnType<typeof getDb>

type RegistrationPolicyEnv = {
  ALLOW_USER_REGISTRATION?: string
}

export async function getRegistrationPolicy(
  db: Db,
  env: RegistrationPolicyEnv
): Promise<RegistrationPolicy> {
  if (env.ALLOW_USER_REGISTRATION === "true") {
    return {
      allowSignUp: true,
      reason: "public-registration",
    }
  }

  const firstUser = await db.select({ id: userTable.id }).from(userTable).limit(1)

  if (firstUser.length === 0) {
    return {
      allowSignUp: true,
      reason: "first-user",
    }
  }

  return {
    allowSignUp: false,
    reason: "disabled",
  }
}

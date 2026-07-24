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
  CACHE?: KVNamespace
}

const REGISTRATION_POLICY_CACHE_KEY = "nexus-vault:auth:registration-policy"

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

  const cachedPolicy = await readCachedRegistrationPolicy(env)
  if (cachedPolicy) return cachedPolicy

  const firstUser = await db.select({ id: userTable.id }).from(userTable).limit(1)

  if (firstUser.length === 0) {
    return {
      allowSignUp: true,
      reason: "first-user",
    }
  }

  const policy = {
    allowSignUp: false,
    reason: "disabled",
  } satisfies RegistrationPolicy

  await env.CACHE?.put(REGISTRATION_POLICY_CACHE_KEY, JSON.stringify(policy), {
    expirationTtl: 300,
  })

  return policy
}

async function readCachedRegistrationPolicy(env: RegistrationPolicyEnv) {
  const cached = await env.CACHE?.get(REGISTRATION_POLICY_CACHE_KEY)
  if (!cached) return null

  try {
    const policy = JSON.parse(cached) as Partial<RegistrationPolicy>
    if (policy.allowSignUp === false && policy.reason === "disabled") {
      return {
        allowSignUp: false,
        reason: "disabled",
      } satisfies RegistrationPolicy
    }
  } catch {
    return null
  }

  return null
}

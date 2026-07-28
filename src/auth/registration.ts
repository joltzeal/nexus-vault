import { count } from "drizzle-orm"

import type { Db } from "@/db"
import { user } from "@/db/auth-schema"

export const HAS_USERS_CACHE_KEY = "auth:has-users"

export type RegistrationMode = "public" | "first-user" | "login-only"

export type RegistrationEnv = Partial<Pick<CloudflareEnv, "CACHE">> & {
	ALLOW_USER_REGISTRATION?: string
}

export function isUserRegistrationAllowed(env: RegistrationEnv) {
	return env.ALLOW_USER_REGISTRATION === "true" || env.ALLOW_USER_REGISTRATION === "1"
}

export async function getRegistrationMode(env: RegistrationEnv): Promise<RegistrationMode> {
	if (isUserRegistrationAllowed(env)) return "public"

	const hasUsers = await env.CACHE?.get(HAS_USERS_CACHE_KEY)
	return hasUsers === "1" ? "login-only" : "first-user"
}

export async function markUsersExist(env: RegistrationEnv) {
	await env.CACHE?.put(HAS_USERS_CACHE_KEY, "1")
}

export async function canCreateUser(env: RegistrationEnv, db: Db) {
	if (isUserRegistrationAllowed(env)) return true

	const [row] = await db.select({ value: count() }).from(user)
	const hasUsers = (row?.value ?? 0) > 0
	if (hasUsers) await markUsersExist(env)

	return !hasUsers
}

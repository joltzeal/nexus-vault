import { betterAuth } from "better-auth/minimal";
import { APIError } from "better-auth/api";
import { captcha } from "better-auth/plugins";
import { withCloudflare } from "better-auth-cloudflare";
import { sql } from "drizzle-orm";
import type { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";

import { createDbSession, type Db } from "@/db";
import { canCreateUser, markUsersExist, type RegistrationEnv } from "@/auth/registration";
import { user } from "@/db/auth-schema";
import { schema } from "@/db/schema";
import {
	getAuthBaseUrl,
	getAuthSecret,
	splitAuthOrigins,
	type AuthRuntimeEnv,
} from "@/auth/config";
import {
	getTurnstileAllowedHostnames,
	type TurnstileEnv,
} from "@/server/services/turnstile-service";

type RuntimeEnv = AuthRuntimeEnv & RegistrationEnv & TurnstileEnv;
type PostgresDb = ReturnType<typeof drizzlePostgres>;
const BCRYPT_COST = 12;
const MAX_PASSWORD_BYTES = 72;

export function getAuthOptions(env: RuntimeEnv, db?: Db) {
	const turnstileSecret = env.TURNSTILE_SECRET_KEY?.trim();

	return {
		appName: "NexusVault",
		baseURL: getAuthBaseUrl(env),
		secret: getAuthSecret(env),
		emailAndPassword: {
			enabled: true,
			maxPasswordLength: MAX_PASSWORD_BYTES,
			...(db ? { password: createPostgresPasswordStrategy(db) } : {}),
		},
		session: {
			deferSessionRefresh: true,
		},
		rateLimit: {
			enabled: true,
			window: 60,
			max: 100,
			customRules: {
				"/sign-in/email": {
					window: 60,
					max: 100,
				},
				"/sign-up/email": {
					window: 60,
					max: 50,
				},
			},
		},
		...(turnstileSecret
			? {
					plugins: [
						captcha({
							provider: "cloudflare-turnstile",
							secretKey: turnstileSecret,
							expectedAction: "auth",
							allowedHostnames: getTurnstileAllowedHostnames(env),
						}),
					],
				}
			: {}),
		trustedOrigins: splitAuthOrigins(env.BETTER_AUTH_TRUSTED_ORIGINS),
		...(db
			? {
					databaseHooks: {
						user: {
							create: {
								before: async (nextUser: typeof user.$inferInsert) => {
									if (await canCreateUser(env, db)) {
										return { data: nextUser };
									}
									throw APIError.from("FORBIDDEN", {
										code: "REGISTRATION_DISABLED",
										message: "User registration is disabled.",
									});
								},
								after: async () => {
									await markUsersExist(env);
								},
							},
						},
					},
				}
			: {}),
	};
}

function createPostgresPasswordStrategy(db: Db) {
	return {
		hash: async (password: string) => {
			assertBcryptPasswordLength(password);
			const rows = await db.execute(
				sql`select crypt(${password}, gen_salt('bf', ${BCRYPT_COST})) as hash`,
			);
			const hash = (rows[0] as { hash?: unknown } | undefined)?.hash;
			if (typeof hash !== "string" || !isPostgresBcryptHash(hash)) {
				throw new Error("PostgreSQL did not return a valid password hash.");
			}
			return hash;
		},
		verify: async ({ hash, password }: { hash: string; password: string }) => {
			if (!isPostgresBcryptHash(hash) || getPasswordByteLength(password) > MAX_PASSWORD_BYTES) {
				return false;
			}
			const rows = await db.execute(
				sql`select crypt(${password}, ${hash}) = ${hash} as valid`,
			);
			return (rows[0] as { valid?: unknown } | undefined)?.valid === true;
		},
	};
}

function assertBcryptPasswordLength(password: string) {
	if (getPasswordByteLength(password) > MAX_PASSWORD_BYTES) {
		throw new Error("Password must not exceed 72 UTF-8 bytes.");
	}
}

function getPasswordByteLength(password: string) {
	return new TextEncoder().encode(password).byteLength;
}

function isPostgresBcryptHash(hash: string) {
	return /^\$2[aby]\$\d{2}\$/.test(hash);
}

export async function createAuthSession(envOverride?: RuntimeEnv) {
	const env = (envOverride ?? process.env) as unknown as RuntimeEnv;
	const database = await createDbSession(env);

	try {
		const instance = betterAuth({
			...withCloudflare(
				{
					autoDetectIpAddress: true,
					geolocationTracking: false,
					cf: {},
					postgres: {
						db: database.db as unknown as PostgresDb,
						options: {
							schema,
							camelCase: true,
						},
					},
				},
				getAuthOptions(env, database.db),
			),
		});

		return {
			auth: instance,
			close: database.close,
		};
	} catch (error) {
		await database.close();
		throw error;
	}
}

export { getAuthSecret } from "@/auth/config";

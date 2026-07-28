import { getCloudflareContext } from "@opennextjs/cloudflare";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { betterAuth } from "better-auth/minimal";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { withCloudflare } from "better-auth-cloudflare";
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

type RuntimeEnv = AuthRuntimeEnv & RegistrationEnv;

type PostgresDb = ReturnType<typeof drizzlePostgres>;

const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_PARAMS = {
	N: 16384,
	r: 16,
	p: 1,
	maxmem: 128 * 16384 * 16 * 2,
};

async function hashPassword(password: string) {
	const salt = randomBytes(16).toString("hex");
	const key = scryptSync(
		password.normalize("NFKC"),
		salt,
		SCRYPT_KEY_LENGTH,
		SCRYPT_PARAMS,
	);
	return `${salt}:${key.toString("hex")}`;
}

async function verifyPassword({ hash, password }: { hash: string; password: string }) {
	const [salt, keyHex, extra] = hash.split(":");
	if (extra !== undefined || !/^[a-f\d]{32}$/i.test(salt) || !/^[a-f\d]{128}$/i.test(keyHex)) {
		return false;
	}

	const expected = Buffer.from(keyHex, "hex");
	const derived = scryptSync(
		password.normalize("NFKC"),
		salt,
		SCRYPT_KEY_LENGTH,
		SCRYPT_PARAMS,
	);
	return timingSafeEqual(expected, derived);
}

export function getAuthOptions(env: RuntimeEnv, db?: Db) {
	return {
		appName: "NexusVault",
		baseURL: getAuthBaseUrl(env),
		secret: getAuthSecret(env),
		emailAndPassword: {
			enabled: true,
			password: {
				hash: hashPassword,
				verify: verifyPassword,
			},
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
		trustedOrigins: splitAuthOrigins(env.BETTER_AUTH_TRUSTED_ORIGINS),
		plugins: [nextCookies()],
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

export async function createAuthSession(envOverride?: RuntimeEnv) {
	let cfCtx: Awaited<ReturnType<typeof getCloudflareContext>> | null = null;

	if (!envOverride) {
		try {
			cfCtx = await getCloudflareContext({ async: true });
		} catch {
			cfCtx = null;
		}
	}

	const env = (envOverride ?? cfCtx?.env ?? process.env) as unknown as RuntimeEnv;
	const database = await createDbSession(env);

	try {
		const instance = betterAuth({
			...withCloudflare(
				{
					autoDetectIpAddress: true,
					geolocationTracking: false,
					cf: cfCtx?.cf ?? {},
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

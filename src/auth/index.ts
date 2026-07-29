import { AsyncLocalStorage } from "node:async_hooks"
import { getCloudflareContext } from "@opennextjs/cloudflare";
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

export function getAuthOptions(env: RuntimeEnv, db?: Db) {
	return {
		appName: "NexusVault",
		baseURL: getAuthBaseUrl(env),
		secret: getAuthSecret(env),
		emailAndPassword: {
			enabled: true,
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

// Per-request db storage. betterAuth is initialized once with a Proxy that
// reads from this storage, so each request gets a fresh TCP connection while
// the expensive betterAuth initialization only runs once per isolate.
const requestDbStorage = new AsyncLocalStorage<Db>();

function createDbProxy(): Db {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return new Proxy({} as Db, {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		get(_target, prop: string | symbol): any {
			const db = requestDbStorage.getStore();
			if (!db) throw new Error("No database in request context. Call createAuthSession() first.");
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const value = (db as any)[prop];
			return typeof value === "function" ? value.bind(db) : value;
		},
	});
}

type CachedAuth = {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	instance: any;
	env: RuntimeEnv;
};

const _global = globalThis as typeof globalThis & { __nexusAuthCache?: CachedAuth };

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

	if (!_global.__nexusAuthCache) {
		// First request in this isolate: build betterAuth with a db proxy so
		// subsequent requests can swap in a fresh connection without rebuilding.
		const dbProxy = createDbProxy();

		const instance = betterAuth({
			...withCloudflare(
				{
					autoDetectIpAddress: true,
					geolocationTracking: false,
					cf: {},
					postgres: {
						db: dbProxy as unknown as PostgresDb,
						options: { schema, camelCase: true },
					},
				},
				getAuthOptions(env, dbProxy),
			),
		});

		_global.__nexusAuthCache = { instance, env };
	}

	const { instance } = _global.__nexusAuthCache;

	return {
		auth: instance,
		// Run the request inside the AsyncLocalStorage context so betterAuth's
		// db calls resolve to this request's fresh postgres connection.
		async handle(request: Request): Promise<Response> {
			return requestDbStorage.run(database.db, async () => {
				try {
					return await instance.handler(request);
				} finally {
					await database.close();
				}
			});
		},
		close: database.close,
	};
}

export { getAuthSecret } from "@/auth/config";

import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { schema } from "./schema";

type RuntimeEnv = Partial<CloudflareEnv> & {
	DATABASE_URL?: string;
	HYPERDRIVE?: Hyperdrive;
};

export type Db = PostgresJsDatabase<typeof schema>;

async function getDatabaseUrl(env?: RuntimeEnv | Promise<RuntimeEnv>) {
	const runtimeEnv = await (env ?? (process.env as unknown as RuntimeEnv));
	return runtimeEnv.HYPERDRIVE?.connectionString ?? runtimeEnv.DATABASE_URL ?? process.env.DATABASE_URL;
}

export async function createDbSession(env?: RuntimeEnv | Promise<RuntimeEnv>) {
	const connectionString = await getDatabaseUrl(env);

	if (!connectionString) {
		throw new Error("DATABASE_URL is required locally, or bind HYPERDRIVE in Cloudflare.");
	}

	const sqlClient = postgres(connectionString, {
		max: 1,
		prepare: false,
		fetch_types: false,
		connect_timeout: 5,
		idle_timeout: 10,
		max_lifetime: 60,
		connection: {
			statement_timeout: 15_000,
			idle_in_transaction_session_timeout: 15_000,
		},
	});
	const db = drizzle(sqlClient, { schema });

	return {
		db,
		async close() {
			await sqlClient.end({ timeout: 1 });
		},
	};
}

export * from "drizzle-orm";
export * from "./schema";

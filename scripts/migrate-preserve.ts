import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const migrationsFolder = path.resolve("drizzle/migrations");
const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
const migrationSchema = "drizzle";
const migrationTable = "__drizzle_migrations";

type MigrationEntry = {
	tag: string;
	when: number;
};

type SchemaSnapshot = {
	tables: Map<string, Set<string>>;
	enums: Set<string>;
};

const legacyAuthColumnRenames: Record<string, Record<string, string>> = {
	account: {
		user_id: "userId",
		account_id: "accountId",
		provider_id: "providerId",
		access_token: "accessToken",
		refresh_token: "refreshToken",
		access_token_expires_at: "accessTokenExpiresAt",
		refresh_token_expires_at: "refreshTokenExpiresAt",
		id_token: "idToken",
		created_at: "createdAt",
		updated_at: "updatedAt",
	},
	session: {
		user_id: "userId",
		expires_at: "expiresAt",
		ip_address: "ipAddress",
		user_agent: "userAgent",
		created_at: "createdAt",
		updated_at: "updatedAt",
	},
	user: {
		email_verified: "emailVerified",
		created_at: "createdAt",
		updated_at: "updatedAt",
	},
	verification: {
		expires_at: "expiresAt",
		created_at: "createdAt",
		updated_at: "updatedAt",
	},
};

function hasFlag(name: string): boolean {
	return process.argv.slice(2).includes(name);
}

function parseMigrationSql(sql: string): SchemaSnapshot {
	const tables = new Map<string, Set<string>>();
	const tablePattern = /CREATE TABLE (?:"[^"]+"\.)?"([^"]+)"\s*\(([\s\S]*?)\n\);/g;

	for (const match of sql.matchAll(tablePattern)) {
		const columns = new Set<string>();
		for (const line of match[2].split("\n")) {
			const column = line.match(/^\s*"([^"]+)"\s+/);
			if (column) columns.add(column[1]);
		}
		tables.set(match[1], columns);
	}

	const enums = new Set<string>();
	for (const match of sql.matchAll(/CREATE TYPE (?:"[^"]+"\.)?"([^"]+)" AS ENUM/g)) {
		enums.add(match[1]);
	}

	return { tables, enums };
}

async function readCurrentMigration(): Promise<{
	entry: MigrationEntry;
	sql: string;
	hash: string;
}> {
	const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
		entries?: MigrationEntry[];
	};
	const entry = journal.entries?.at(-1);
	if (!entry) throw new Error(`No migration entries found in ${journalPath}`);

	const sql = await readFile(path.join(migrationsFolder, `${entry.tag}.sql`), "utf8");
	const hash = createHash("sha256").update(sql).digest("hex");
	return { entry, sql, hash };
}

async function getExistingTables(client: Client, names: string[]): Promise<Set<string>> {
	if (names.length === 0) return new Set();
	const result = await client.query<{ table_name: string }>(
		`SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
		[names],
	);
	return new Set(result.rows.map((row) => row.table_name));
}

async function getExistingColumns(
	client: Client,
	tableNames: string[],
): Promise<Map<string, Set<string>>> {
	if (tableNames.length === 0) return new Map();
	const result = await client.query<{ table_name: string; column_name: string }>(
		`SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
		[tableNames],
	);
	const columns = new Map<string, Set<string>>();
	for (const row of result.rows) {
		if (!columns.has(row.table_name)) columns.set(row.table_name, new Set());
		columns.get(row.table_name)?.add(row.column_name);
	}
	return columns;
}

async function getExistingEnums(client: Client, names: string[]): Promise<Set<string>> {
	if (names.length === 0) return new Set();
	const result = await client.query<{ typname: string }>(
		`SELECT typname
     FROM pg_type
     WHERE typtype = 'e' AND typnamespace = 'public'::regnamespace
       AND typname = ANY($1::text[])`,
		[names],
	);
	return new Set(result.rows.map((row) => row.typname));
}

async function migrationTableExists(client: Client, schema: string): Promise<boolean> {
	const result = await client.query<{ exists: boolean }>(
		"SELECT to_regclass($1) IS NOT NULL AS exists",
		[`${schema}.${migrationTable}`],
	);
	return result.rows[0]?.exists === true;
}

async function getMigrationRows(client: Client): Promise<Array<{ hash: string; created_at: string | number | null }>> {
	if (!(await migrationTableExists(client, migrationSchema))) return [];
	const result = await client.query<{ hash: string; created_at: string | number | null }>(
		`SELECT hash, created_at
     FROM "${migrationSchema}"."${migrationTable}"
     ORDER BY created_at DESC`,
	);
	return result.rows;
}

async function baseline(
	client: Client,
	hash: string,
	rows: Array<{ hash: string; created_at: string | number | null }>,
): Promise<void> {
	const latestTimestamp = rows.reduce(
		(max, row) => Math.max(max, Number(row.created_at) || 0),
		0,
	);
	const createdAt = Math.max(Date.now(), latestTimestamp + 1);

	await client.query("BEGIN");
	try {
		await client.query(`CREATE SCHEMA IF NOT EXISTS "${migrationSchema}"`);
		await client.query(`
      CREATE TABLE IF NOT EXISTS "${migrationSchema}"."${migrationTable}" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);
		await client.query(
			`INSERT INTO "${migrationSchema}"."${migrationTable}" (hash, created_at) VALUES ($1, $2)`,
			[hash, createdAt],
		);
		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	}
}

async function renameLegacyAuthColumns(
	client: Client,
	columns: Map<string, Set<string>>,
): Promise<void> {
	const statements: string[] = [];
	for (const [table, renames] of Object.entries(legacyAuthColumnRenames)) {
		const actual = columns.get(table) ?? new Set<string>();
		for (const [current, legacy] of Object.entries(renames)) {
			if (!actual.has(current) && actual.has(legacy)) {
				statements.push(
					`ALTER TABLE "${table}" RENAME COLUMN "${legacy}" TO "${current}"`,
				);
			}
		}
	}

	const accountColumns = columns.get("account") ?? new Set<string>();
	const hasIssuer = accountColumns.has("issuer");
	const hasProviderId = accountColumns.has("provider_id") || accountColumns.has("providerId");
	if (!hasIssuer && hasProviderId) {
		statements.push('ALTER TABLE "account" ADD COLUMN "issuer" text');
		statements.push('UPDATE "account" SET "issuer" = "provider_id" WHERE "issuer" IS NULL');
		statements.push('ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL');
	}

	if (statements.length === 0) {
		throw new Error(
			"No supported legacy Better Auth column aliases were detected. Review the reported schema and create a reviewed migration manually.",
		);
	}

	await client.query("BEGIN");
	try {
		for (const statement of statements) await client.query(statement);
		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	}
}

async function main(): Promise<void> {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("DATABASE_URL is required");

	const baselineRequested = hasFlag("--baseline");
	const confirmed = hasFlag("--yes");
	const legacyAuthRequested = hasFlag("--legacy-auth");
	if (confirmed && !baselineRequested) {
		throw new Error("--yes can only be used together with --baseline");
	}
	if (legacyAuthRequested && !confirmed) {
		throw new Error("--legacy-auth requires --yes because it changes column names");
	}

	const currentMigration = await readCurrentMigration();
	const snapshot = parseMigrationSql(currentMigration.sql);
	const client = new Client({ connectionString: databaseUrl });
	await client.connect();

	try {
		const info = await client.query<{ database: string; server_version: string }>(
			"SELECT current_database() AS database, current_setting('server_version') AS server_version",
		);
		console.log(`Database: ${info.rows[0]?.database ?? "unknown"}`);
		console.log(`PostgreSQL: ${info.rows[0]?.server_version ?? "unknown"}`);
		console.log(`Current migration: ${currentMigration.entry.tag}`);

		const publicMigrationTable = await migrationTableExists(client, "public");
		const rows = await getMigrationRows(client);
		if (publicMigrationTable && rows.length === 0) {
			throw new Error(
				`Found public.${migrationTable}. This project uses drizzle.${migrationTable}; inspect the legacy migration configuration before continuing.`,
			);
		}

		const tableNames = [...snapshot.tables.keys()];
		const existingTables = await getExistingTables(client, tableNames);
		let existingColumns = await getExistingColumns(client, [...existingTables]);
		const legacyRenames = Object.entries(legacyAuthColumnRenames).flatMap(([table, renames]) => {
			const actual = existingColumns.get(table) ?? new Set<string>();
			return Object.entries(renames)
				.filter(([current, legacy]) => !actual.has(current) && actual.has(legacy))
				.map(([current, legacy]) => `${table}.${legacy} -> ${table}.${current}`);
		});
		const accountHasIssuer = existingColumns.get("account")?.has("issuer") ?? false;
		const accountHasProvider =
			existingColumns.get("account")?.has("provider_id") ||
			existingColumns.get("account")?.has("providerId");
		if (!accountHasIssuer && accountHasProvider) legacyRenames.push("account.(new issuer) <- account.provider_id");
		if (legacyRenames.length) console.log(`Legacy Better Auth aliases: ${legacyRenames.join(", ")}`);

		if (legacyAuthRequested) {
			console.log("Applying explicitly requested Better Auth compatibility changes.");
			await renameLegacyAuthColumns(client, existingColumns);
			existingColumns = await getExistingColumns(client, [...existingTables]);
		}
		const existingEnums = await getExistingEnums(client, [...snapshot.enums]);
		const missingTables = tableNames.filter((name) => !existingTables.has(name));
		const missingEnums = [...snapshot.enums].filter((name) => !existingEnums.has(name));
		const missingColumns = tableNames.flatMap((table) => {
			const actual = existingColumns.get(table) ?? new Set<string>();
			return [...(snapshot.tables.get(table) ?? [])]
				.filter((column) => !actual.has(column))
				.map((column) => `${table}.${column}`);
		});
		const hasExistingSchema = existingTables.size > 0 || existingEnums.size > 0;
		const currentRecorded = rows.some((row) => row.hash === currentMigration.hash);

		console.log(`Migration records: ${rows.length}`);
		console.log(`Existing application tables: ${existingTables.size}/${tableNames.length}`);
		if (missingTables.length) console.log(`Missing tables: ${missingTables.join(", ")}`);
		if (missingEnums.length) console.log(`Missing enums: ${missingEnums.join(", ")}`);
		if (missingColumns.length) console.log(`Missing columns: ${missingColumns.join(", ")}`);

		if (currentRecorded) {
			console.log("Current migration is already recorded; applying pending migrations.");
			await migrate(drizzle(client), { migrationsFolder });
			return;
		}

		if (hasExistingSchema) {
			if (legacyRenames.length && !legacyAuthRequested) {
				throw new Error(
					"Legacy Better Auth column names were detected. After taking a backup, rerun with `--legacy-auth --baseline --yes` to rename only those columns and establish the migration baseline.",
				);
			}
			if (missingTables.length || missingEnums.length || missingColumns.length) {
				throw new Error(
					"Existing schema does not match the current migration closely enough to baseline. Create a reviewed incremental migration first.",
				);
			}
			if (!baselineRequested || !confirmed) {
				throw new Error(
					"Existing tables were found without the current migration record. This command is read-only by default. Run `pnpm run db:migrate:preserve -- --baseline --yes` after taking a database backup and reviewing the schema.",
				);
			}
			console.log("Writing migration baseline only; application data will not be changed.");
			await baseline(client, currentMigration.hash, rows);
			console.log("Baseline recorded. Applying any migrations newer than the baseline.");
			await migrate(drizzle(client), { migrationsFolder });
			return;
		}

		if (baselineRequested) {
			throw new Error("--baseline was requested, but no existing application schema was found; use the normal migration path instead.");
		}

		console.log("No existing application schema found; applying migrations normally.");
		await migrate(drizzle(client), { migrationsFolder });
	} finally {
		await client.end();
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});

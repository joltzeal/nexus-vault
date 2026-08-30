import { hashPassword } from "better-auth/crypto";
import { Client } from "pg";

type Options = {
	email?: string;
	password?: string;
	confirmed: boolean;
};

function getOption(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	return value && !value.startsWith("--") ? value : undefined;
}

function getOptions(): Options {
	return {
		email: getOption("--email") ?? process.env.AUTH_EMAIL,
		password: getOption("--password") ?? process.env.AUTH_NEW_PASSWORD,
		confirmed: process.argv.includes("--yes"),
	};
}

async function main(): Promise<void> {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("DATABASE_URL is required");

	const { email, password, confirmed } = getOptions();
	if (!email) throw new Error("Provide --email <address> or AUTH_EMAIL");
	if (!password) throw new Error("Provide --password <value> or AUTH_NEW_PASSWORD");
	if (!confirmed) {
		throw new Error(
			"This changes a production credential. Re-run with --yes after checking the email and database.",
		);
	}

	const normalizedEmail = email.trim().toLowerCase();
	if (!normalizedEmail.includes("@")) throw new Error("The email address is invalid");
	if (password.length < 8 || password.length > 128) {
		throw new Error("Better Auth passwords must be between 8 and 128 characters");
	}

	const client = new Client({ connectionString: databaseUrl });
	await client.connect();

	try {
		const userResult = await client.query<{ id: string; email: string }>(
			`SELECT id, email
       FROM "user"
       WHERE lower(email) = $1
       LIMIT 2`,
			[normalizedEmail],
		);
		if (userResult.rows.length === 0) throw new Error(`No user found for ${normalizedEmail}`);
		if (userResult.rows.length > 1) throw new Error("Multiple users match this email; refusing to continue");

		const user = userResult.rows[0];
		const accountResult = await client.query<{ id: string }>(
			`SELECT id
       FROM "account"
       WHERE user_id = $1 AND provider_id = 'credential'
       LIMIT 2`,
			[user.id],
		);
		if (accountResult.rows.length === 0) {
			throw new Error("This user has no Better Auth credential account; password was not changed");
		}
		if (accountResult.rows.length > 1) {
			throw new Error("Multiple credential accounts found; password was not changed");
		}

		const passwordHash = await hashPassword(password);
		await client.query("BEGIN");
		try {
			const updateResult = await client.query(
				`UPDATE "account"
         SET password = $1,
             issuer = 'local:credential',
             account_id = $2,
             updated_at = CURRENT_TIMESTAMP
		 WHERE id = $3 AND user_id = $2 AND provider_id = 'credential'`,
				[passwordHash, user.id, accountResult.rows[0].id],
			);
			if (updateResult.rowCount !== 1) throw new Error("Credential account changed during update; transaction aborted");

			const sessions = await client.query(
				`DELETE FROM "session" WHERE user_id = $1`,
				[user.id],
			);
			await client.query("COMMIT");
			console.log(`Password updated for ${user.email}`);
			console.log(`Revoked ${sessions.rowCount ?? 0} existing session(s)`);
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		}
	} finally {
		await client.end();
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});

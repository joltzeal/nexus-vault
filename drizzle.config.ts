import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		"DATABASE_URL is required to run Drizzle Kit. Configure it in .env.",
	);
}

export default defineConfig({
	schema: "./worker/db/schema.ts",
	out: "./drizzle/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: databaseUrl,
	},
});

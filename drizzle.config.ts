import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

function readDevVars(): Record<string, string> {
	try {
		return Object.fromEntries(
			readFileSync(".dev.vars", "utf8")
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith("#"))
				.map((line) => {
					const [key, ...value] = line.split("=");
					return [key, value.join("=").replace(/\s+#.*$/, "")];
				}),
		);
	} catch {
		return {};
	}
}

const devVars = readDevVars();
const databaseUrl = process.env.DATABASE_URL ?? devVars.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is required for Drizzle Kit. Add it to .dev.vars or your shell env.");
}

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: databaseUrl,
	},
});

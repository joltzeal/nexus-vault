import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const migrationFile = join(root, "migrations", "0000_initial_schema.sql")
loadEnvFiles([
  join(root, ".env.production"),
  join(root, ".env"),
  join(root, "apps", "frontend", ".env.production"),
  join(root, "apps", "frontend", ".env"),
])

const connectionString =
  process.env.DATABASE_URL ??
  process.env.HYPERDRIVE_DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.NEON_DATABASE_URL ??
  process.env.SUPABASE_DATABASE_URL

if (!connectionString) {
  console.error(
    "Missing DATABASE_URL. Set DATABASE_URL, HYPERDRIVE_DATABASE_URL, POSTGRES_URL, NEON_DATABASE_URL, or SUPABASE_DATABASE_URL to your Postgres origin connection string."
  )
  process.exit(1)
}

const sql = readFileSync(migrationFile, "utf8")
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter(Boolean)

const sqlClient = postgres(connectionString, {
  max: 1,
  prepare: false,
  fetch_types: false,
})

try {
  await sqlClient.begin(async (tx) => {
    for (const statement of sql) {
      await tx.unsafe(statement)
    }
  })
  console.log(`Applied ${sql.length} Postgres migration statements.`)
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await sqlClient.end({ timeout: 1 })
}

function loadEnvFiles(paths) {
  for (const path of paths) {
    if (!existsSync(path)) continue

    const content = readFileSync(path, "utf8")
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!match) continue

      const [, key, rawValue] = match
      if (process.env[key] !== undefined) continue

      process.env[key] = unwrapEnvValue(rawValue.trim())
    }
  }
}

function unwrapEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const migrationsDir = join(root, "migrations")

const betterAuthSql = `CREATE TABLE \`user\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`name\` text NOT NULL,
  \`email\` text NOT NULL,
  \`emailVerified\` integer DEFAULT false NOT NULL,
  \`image\` text,
  \`createdAt\` integer NOT NULL,
  \`updatedAt\` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`user_email_unique\` ON \`user\` (\`email\`);
--> statement-breakpoint
CREATE TABLE \`account\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`accountId\` text NOT NULL,
  \`providerId\` text NOT NULL,
  \`userId\` text NOT NULL,
  \`accessToken\` text,
  \`refreshToken\` text,
  \`idToken\` text,
  \`accessTokenExpiresAt\` integer,
  \`refreshTokenExpiresAt\` integer,
  \`scope\` text,
  \`password\` text,
  \`createdAt\` integer NOT NULL,
  \`updatedAt\` integer NOT NULL,
  FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX \`account_userId_idx\` ON \`account\` (\`userId\`);
--> statement-breakpoint
CREATE TABLE \`session\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`expiresAt\` integer NOT NULL,
  \`token\` text NOT NULL,
  \`createdAt\` integer NOT NULL,
  \`updatedAt\` integer NOT NULL,
  \`ipAddress\` text,
  \`userAgent\` text,
  \`userId\` text NOT NULL,
  FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`session_token_unique\` ON \`session\` (\`token\`);
--> statement-breakpoint
CREATE TABLE \`verification\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`identifier\` text NOT NULL,
  \`value\` text NOT NULL,
  \`expiresAt\` integer NOT NULL,
  \`createdAt\` integer NOT NULL,
  \`updatedAt\` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX \`verification_identifier_idx\` ON \`verification\` (\`identifier\`);
`

const businessSql = `PRAGMA foreign_keys = ON;

CREATE TABLE \`users\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`email\` text NOT NULL,
  \`name\` text,
  \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`updated_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`deleted_at\` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`users_email_unique\` ON \`users\` (\`email\`);
--> statement-breakpoint
CREATE TABLE \`vaults\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`title\` text NOT NULL,
  \`description\` text DEFAULT '' NOT NULL,
  \`visibility\` text DEFAULT 'private' NOT NULL,
  \`password_hash\` text,
  \`owner_id\` text,
  \`star_count\` integer DEFAULT 0 NOT NULL,
  \`fork_count\` integer DEFAULT 0 NOT NULL,
  \`forked_from_vault_id\` text,
  \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`updated_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`deleted_at\` text,
  FOREIGN KEY (\`owner_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE \`spaces\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`vault_id\` text NOT NULL,
  \`name\` text NOT NULL,
  \`description\` text DEFAULT '' NOT NULL,
  \`icon\` text DEFAULT 'tv' NOT NULL,
  \`position\` integer DEFAULT 0 NOT NULL,
  \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`updated_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`deleted_at\` text,
  FOREIGN KEY (\`vault_id\`) REFERENCES \`vaults\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE \`resources\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`vault_id\` text NOT NULL,
  \`space_id\` text,
  \`type\` text NOT NULL,
  \`title\` text NOT NULL,
  \`description\` text DEFAULT '' NOT NULL,
  \`url\` text NOT NULL,
  \`metadata_status\` text DEFAULT 'pending' NOT NULL,
  \`position\` integer DEFAULT 0 NOT NULL,
  \`created_by\` text,
  \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`updated_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`deleted_at\` text,
  FOREIGN KEY (\`vault_id\`) REFERENCES \`vaults\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (\`space_id\`) REFERENCES \`spaces\`(\`id\`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE \`resource_metadata\` (
  \`resource_id\` text PRIMARY KEY NOT NULL,
  \`provider\` text NOT NULL,
  \`status\` text DEFAULT 'pending' NOT NULL,
  \`data_json\` text DEFAULT '{}' NOT NULL,
  \`error_message\` text,
  \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`updated_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (\`resource_id\`) REFERENCES \`resources\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE \`collaborators\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`vault_id\` text NOT NULL,
  \`user_id\` text NOT NULL,
  \`role\` text NOT NULL,
  \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`updated_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (\`vault_id\`) REFERENCES \`vaults\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`collaborators_vault_user_unique\` ON \`collaborators\` (\`vault_id\`, \`user_id\`);
--> statement-breakpoint
CREATE TABLE \`shares\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`vault_id\` text NOT NULL,
  \`visibility\` text DEFAULT 'private' NOT NULL,
  \`password_hash\` text,
  \`token\` text NOT NULL,
  \`slug\` text,
  \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`updated_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`deleted_at\` text,
  FOREIGN KEY (\`vault_id\`) REFERENCES \`vaults\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`shares_token_unique\` ON \`shares\` (\`token\`);
--> statement-breakpoint
CREATE UNIQUE INDEX \`shares_slug_unique\` ON \`shares\` (\`slug\`);
--> statement-breakpoint
CREATE TABLE \`comments\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`vault_id\` text NOT NULL,
  \`resource_id\` text NOT NULL,
  \`parent_id\` text,
  \`author_id\` text,
  \`author_name\` text DEFAULT 'Anonymous' NOT NULL,
  \`body\` text NOT NULL,
  \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`updated_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`deleted_at\` text,
  FOREIGN KEY (\`vault_id\`) REFERENCES \`vaults\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (\`resource_id\`) REFERENCES \`resources\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (\`author_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE \`stars\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`vault_id\` text NOT NULL,
  \`user_id\` text NOT NULL,
  \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (\`vault_id\`) REFERENCES \`vaults\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX \`stars_vault_user_unique\` ON \`stars\` (\`vault_id\`, \`user_id\`);
--> statement-breakpoint
CREATE TABLE \`forks\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`source_vault_id\` text NOT NULL,
  \`target_vault_id\` text NOT NULL,
  \`created_by\` text,
  \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (\`source_vault_id\`) REFERENCES \`vaults\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (\`target_vault_id\`) REFERENCES \`vaults\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE \`notifications\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`user_id\` text,
  \`vault_id\` text,
  \`type\` text NOT NULL,
  \`title\` text NOT NULL,
  \`body\` text DEFAULT '' NOT NULL,
  \`read_at\` text,
  \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (\`vault_id\`) REFERENCES \`vaults\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
`

const submissionsSql = `CREATE TABLE \`resource_submissions\` (
  \`id\` text PRIMARY KEY NOT NULL,
  \`vault_id\` text NOT NULL,
  \`space_id\` text,
  \`status\` text DEFAULT 'pending' NOT NULL,
  \`submitter_id\` text,
  \`submitter_name\` text DEFAULT '' NOT NULL,
  \`submitter_email\` text DEFAULT '' NOT NULL,
  \`type\` text NOT NULL,
  \`title\` text NOT NULL,
  \`description\` text DEFAULT '' NOT NULL,
  \`url\` text NOT NULL,
  \`metadata_json\` text DEFAULT '{}' NOT NULL,
  \`reviewed_by\` text,
  \`review_note\` text DEFAULT '' NOT NULL,
  \`reviewed_at\` text,
  \`approved_resource_id\` text,
  \`created_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`updated_at\` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  \`deleted_at\` text,
  FOREIGN KEY (\`vault_id\`) REFERENCES \`vaults\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (\`space_id\`) REFERENCES \`spaces\`(\`id\`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (\`submitter_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (\`reviewed_by\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (\`approved_resource_id\`) REFERENCES \`resources\`(\`id\`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX \`resource_submissions_vault_status_created_idx\` ON \`resource_submissions\` (\`vault_id\`, \`status\`, \`created_at\`);
`

rmSync(migrationsDir, { force: true, recursive: true })
mkdirSync(migrationsDir, { recursive: true })
writeFileSync(join(migrationsDir, "0000_better_auth.sql"), betterAuthSql)
writeFileSync(join(migrationsDir, "0001_business_tables.sql"), businessSql)
writeFileSync(join(migrationsDir, "0002_resource_submissions.sql"), submissionsSql)

console.log("Generated D1 migrations:")
console.log(" - migrations/0000_better_auth.sql")
console.log(" - migrations/0001_business_tables.sql")
console.log(" - migrations/0002_resource_submissions.sql")
console.log("No drizzle meta files were generated.")

import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const migrationsDir = join(root, "migrations")

const initialSchemaSql = `CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean DEFAULT false NOT NULL,
  "image" text,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY NOT NULL,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  "scope" text,
  "password" text,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account" ("userId");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vaults" (
  "id" uuid PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "cover" text DEFAULT '' NOT NULL,
  "visibility" text DEFAULT 'private' NOT NULL,
  "password_hash" text,
  "collection_enabled" boolean DEFAULT false NOT NULL,
  "nsfw_enabled" boolean DEFAULT true NOT NULL,
  "owner_id" text REFERENCES "user"("id") ON DELETE set null,
  "star_count" integer DEFAULT 0 NOT NULL,
  "fork_count" integer DEFAULT 0 NOT NULL,
  "forked_from_vault_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vaults_owner_deleted_created_idx" ON "vaults" ("owner_id", "deleted_at", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vaults_deleted_created_idx" ON "vaults" ("deleted_at", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "spaces" (
  "id" uuid PRIMARY KEY NOT NULL,
  "vault_id" uuid NOT NULL REFERENCES "vaults"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "icon" text DEFAULT 'tv' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "spaces_vault_deleted_position_idx" ON "spaces" ("vault_id", "deleted_at", "position");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resources" (
  "id" uuid PRIMARY KEY NOT NULL,
  "vault_id" uuid NOT NULL REFERENCES "vaults"("id") ON DELETE cascade,
  "space_id" uuid REFERENCES "spaces"("id") ON DELETE set null,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "url" text NOT NULL,
  "dedupe_key" text NOT NULL,
  "metadata_status" text DEFAULT 'pending' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_by" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resources_vault_deleted_space_position_idx" ON "resources" ("vault_id", "deleted_at", "space_id", "position");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resources_vault_dedupe_unique" ON "resources" ("vault_id", "dedupe_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_submissions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "vault_id" uuid NOT NULL REFERENCES "vaults"("id") ON DELETE cascade,
  "space_id" uuid REFERENCES "spaces"("id") ON DELETE set null,
  "status" text DEFAULT 'pending' NOT NULL,
  "submitter_id" text REFERENCES "user"("id") ON DELETE set null,
  "submitter_name" text DEFAULT '' NOT NULL,
  "submitter_email" text DEFAULT '' NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "url" text NOT NULL,
  "metadata_json" text DEFAULT '{}' NOT NULL,
  "reviewed_by" text REFERENCES "user"("id") ON DELETE set null,
  "review_note" text DEFAULT '' NOT NULL,
  "reviewed_at" timestamp,
  "approved_resource_id" uuid REFERENCES "resources"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_submissions_vault_status_created_idx" ON "resource_submissions" ("vault_id", "status", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resource_metadata" (
  "resource_id" uuid PRIMARY KEY NOT NULL REFERENCES "resources"("id") ON DELETE cascade,
  "provider" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "data_json" text DEFAULT '{}' NOT NULL,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collaborators" (
  "id" uuid PRIMARY KEY NOT NULL,
  "vault_id" uuid NOT NULL REFERENCES "vaults"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "role" text DEFAULT 'editor' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "collaborators_vault_user_unique" ON "collaborators" ("vault_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collaborators_user_vault_idx" ON "collaborators" ("user_id", "vault_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shares" (
  "id" uuid PRIMARY KEY NOT NULL,
  "vault_id" uuid NOT NULL REFERENCES "vaults"("id") ON DELETE cascade,
  "visibility" text DEFAULT 'private' NOT NULL,
  "password_hash" text,
  "token" text NOT NULL UNIQUE,
  "slug" text UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shares_vault_deleted_idx" ON "shares" ("vault_id", "deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shares_slug_deleted_idx" ON "shares" ("slug", "deleted_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comments" (
  "id" uuid PRIMARY KEY NOT NULL,
  "vault_id" uuid NOT NULL REFERENCES "vaults"("id") ON DELETE cascade,
  "resource_id" uuid NOT NULL REFERENCES "resources"("id") ON DELETE cascade,
  "parent_id" uuid,
  "author_id" text REFERENCES "user"("id") ON DELETE set null,
  "author_name" text DEFAULT 'Anonymous' NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_vault_deleted_created_idx" ON "comments" ("vault_id", "deleted_at", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_resource_deleted_created_idx" ON "comments" ("resource_id", "deleted_at", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stars" (
  "id" uuid PRIMARY KEY NOT NULL,
  "vault_id" uuid NOT NULL REFERENCES "vaults"("id") ON DELETE cascade,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stars_vault_user_unique" ON "stars" ("vault_id", "user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stars_user_created_idx" ON "stars" ("user_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "starred_resources" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "source_resource_id" uuid NOT NULL,
  "source_vault_id" uuid NOT NULL,
  "source_space_id" uuid,
  "source_vault_title" text DEFAULT '' NOT NULL,
  "source_space_name" text DEFAULT '' NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "url" text NOT NULL,
  "metadata_status" text DEFAULT 'pending' NOT NULL,
  "metadata_provider" text,
  "metadata_data_json" text DEFAULT '{}' NOT NULL,
  "metadata_error_message" text,
  "source_created_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "starred_resources_user_source_unique" ON "starred_resources" ("user_id", "source_resource_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "starred_resources_user_created_idx" ON "starred_resources" ("user_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forks" (
  "id" uuid PRIMARY KEY NOT NULL,
  "source_vault_id" uuid NOT NULL REFERENCES "vaults"("id") ON DELETE cascade,
  "target_vault_id" uuid NOT NULL REFERENCES "vaults"("id") ON DELETE cascade,
  "created_by" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forks_source_target_idx" ON "forks" ("source_vault_id", "target_vault_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forks_created_by_created_idx" ON "forks" ("created_by", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE cascade,
  "vault_id" uuid REFERENCES "vaults"("id") ON DELETE cascade,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_read_created_idx" ON "notifications" ("user_id", "read_at", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_created_idx" ON "notifications" ("user_id", "created_at");
`

rmSync(migrationsDir, { force: true, recursive: true })
mkdirSync(migrationsDir, { recursive: true })
writeFileSync(join(migrationsDir, "0000_initial_schema.sql"), initialSchemaSql)

console.log("Generated Postgres migrations:")
console.log(" - migrations/0000_initial_schema.sql")

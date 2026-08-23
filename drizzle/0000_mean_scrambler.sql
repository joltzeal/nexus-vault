CREATE TYPE "public"."collaborator_role" AS ENUM('editor');--> statement-breakpoint
CREATE TYPE "public"."metadata_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('magnet', 'twitter', 'telegram', 'douyin', 'baidu_pan', 'pan_115', 'pan_123', 'quark_pan', 'uc_pan', 'xunlei_pan', 'pikpak', 'onedrive', 'google_drive', 'dropbox', 'alist', 'ftp', 'http', 'youtube', 'other');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."vault_visibility" AS ENUM('public', 'private', 'password');--> statement-breakpoint
CREATE TYPE "public"."vault_watch_level" AS ENUM('all', 'updates', 'none');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "collaborator_role" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_vault_id" uuid NOT NULL,
	"target_vault_id" uuid NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"visibility" "vault_visibility" DEFAULT 'private' NOT NULL,
	"password_hash" text,
	"token" text NOT NULL,
	"slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "shares_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT 'tv' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vault_stars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"level" "vault_watch_level" DEFAULT 'updates' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover" text DEFAULT '' NOT NULL,
	"visibility" "vault_visibility" DEFAULT 'private' NOT NULL,
	"password_hash" text,
	"collection_enabled" boolean DEFAULT false NOT NULL,
	"nsfw_enabled" boolean DEFAULT true NOT NULL,
	"owner_id" text,
	"star_count" integer DEFAULT 0 NOT NULL,
	"fork_count" integer DEFAULT 0 NOT NULL,
	"forked_from_vault_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "resource_annotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"rating" integer,
	"comment" text DEFAULT '' NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_metadata" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"status" "metadata_status" DEFAULT 'pending' NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_read_later" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"space_id" uuid,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"submitter_id" text,
	"submitter_name" text DEFAULT '' NOT NULL,
	"submitter_email" text DEFAULT '' NOT NULL,
	"type" "resource_type" NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reviewed_by" text,
	"review_note" text DEFAULT '' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"approved_resource_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"space_id" uuid,
	"type" "resource_type" NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"metadata_status" "metadata_status" DEFAULT 'pending' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"star_count" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "starred_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"source_resource_id" uuid,
	"type" "resource_type" NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"metadata_status" "metadata_status" DEFAULT 'pending' NOT NULL,
	"metadata_provider" text,
	"metadata_data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata_error_message" text,
	"source_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"vault_id" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_integration_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forks" ADD CONSTRAINT "forks_source_vault_id_vaults_id_fk" FOREIGN KEY ("source_vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forks" ADD CONSTRAINT "forks_target_vault_id_vaults_id_fk" FOREIGN KEY ("target_vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forks" ADD CONSTRAINT "forks_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_stars" ADD CONSTRAINT "vault_stars_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_stars" ADD CONSTRAINT "vault_stars_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_watches" ADD CONSTRAINT "vault_watches_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_watches" ADD CONSTRAINT "vault_watches_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_forked_from_vault_id_vaults_id_fk" FOREIGN KEY ("forked_from_vault_id") REFERENCES "public"."vaults"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_annotations" ADD CONSTRAINT "resource_annotations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_annotations" ADD CONSTRAINT "resource_annotations_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_metadata" ADD CONSTRAINT "resource_metadata_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_read_later" ADD CONSTRAINT "resource_read_later_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_read_later" ADD CONSTRAINT "resource_read_later_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_submissions" ADD CONSTRAINT "resource_submissions_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_submissions" ADD CONSTRAINT "resource_submissions_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_submissions" ADD CONSTRAINT "resource_submissions_submitter_id_user_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_submissions" ADD CONSTRAINT "resource_submissions_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_submissions" ADD CONSTRAINT "resource_submissions_approved_resource_id_resources_id_fk" FOREIGN KEY ("approved_resource_id") REFERENCES "public"."resources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starred_resources" ADD CONSTRAINT "starred_resources_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_integration_settings" ADD CONSTRAINT "user_integration_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "collaborators_vault_user_unique" ON "collaborators" USING btree ("vault_id","user_id");--> statement-breakpoint
CREATE INDEX "collaborators_user_vault_idx" ON "collaborators" USING btree ("user_id","vault_id");--> statement-breakpoint
CREATE UNIQUE INDEX "forks_source_target_unique" ON "forks" USING btree ("source_vault_id","target_vault_id");--> statement-breakpoint
CREATE INDEX "forks_created_by_created_idx" ON "forks" USING btree ("created_by","created_at");--> statement-breakpoint
CREATE INDEX "shares_vault_deleted_idx" ON "shares" USING btree ("vault_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shares_slug_active_unique" ON "shares" USING btree ("slug") WHERE "shares"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "spaces_vault_deleted_position_idx" ON "spaces" USING btree ("vault_id","deleted_at","position");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_stars_vault_user_unique" ON "vault_stars" USING btree ("vault_id","user_id");--> statement-breakpoint
CREATE INDEX "vault_stars_user_created_idx" ON "vault_stars" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_watches_vault_user_unique" ON "vault_watches" USING btree ("vault_id","user_id");--> statement-breakpoint
CREATE INDEX "vault_watches_user_updated_idx" ON "vault_watches" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "vaults_owner_deleted_created_idx" ON "vaults" USING btree ("owner_id","deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "vaults_deleted_created_idx" ON "vaults" USING btree ("deleted_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_annotations_user_resource_unique" ON "resource_annotations" USING btree ("user_id","resource_id");--> statement-breakpoint
CREATE INDEX "resource_annotations_user_updated_idx" ON "resource_annotations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_read_later_user_resource_unique" ON "resource_read_later" USING btree ("user_id","resource_id");--> statement-breakpoint
CREATE INDEX "resource_read_later_user_position_idx" ON "resource_read_later" USING btree ("user_id","position");--> statement-breakpoint
CREATE INDEX "resource_submissions_vault_status_created_idx" ON "resource_submissions" USING btree ("vault_id","status","created_at");--> statement-breakpoint
CREATE INDEX "resources_vault_space_position_idx" ON "resources" USING btree ("vault_id","space_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "resources_vault_dedupe_unique" ON "resources" USING btree ("vault_id","dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "starred_resources_user_source_unique" ON "starred_resources" USING btree ("user_id","source_resource_id");--> statement-breakpoint
CREATE INDEX "starred_resources_user_created_idx" ON "starred_resources" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "starred_resources_source_resource_idx" ON "starred_resources" USING btree ("source_resource_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_created_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_integration_settings_user_unique" ON "user_integration_settings" USING btree ("user_id");

CREATE TABLE "history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" text,
	"entity_type" text NOT NULL,
	"action" text NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"entity_id" text NOT NULL,
	"entity_label" text DEFAULT '' NOT NULL,
	"vault_id" uuid,
	"space_id" uuid,
	"source_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"target_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"details_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "history" ADD CONSTRAINT "history_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "history_actor_created_idx" ON "history" USING btree ("actor_id","created_at","id");
--> statement-breakpoint
CREATE INDEX "history_actor_entity_created_idx" ON "history" USING btree ("actor_id","entity_type","created_at");
--> statement-breakpoint
CREATE INDEX "history_actor_action_created_idx" ON "history" USING btree ("actor_id","action","created_at");
--> statement-breakpoint
CREATE INDEX "history_actor_vault_created_idx" ON "history" USING btree ("actor_id","vault_id","created_at");

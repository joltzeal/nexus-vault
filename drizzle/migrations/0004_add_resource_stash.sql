ALTER TABLE "resources" ALTER COLUMN "vault_id" DROP NOT NULL;
ALTER TABLE "resources" ADD COLUMN "stash_user_id" text;
ALTER TABLE "resources" ADD CONSTRAINT "resources_stash_user_id_user_id_fk" FOREIGN KEY ("stash_user_id") REFERENCES "user"("id") ON DELETE cascade;
ALTER TABLE "resources" ADD CONSTRAINT "resources_single_container_check" CHECK (("vault_id" IS NOT NULL) <> ("stash_user_id" IS NOT NULL));
ALTER TABLE "resources" ADD CONSTRAINT "resources_stash_has_no_space_check" CHECK ("stash_user_id" IS NULL OR "space_id" IS NULL);
CREATE UNIQUE INDEX "resources_stash_dedupe_unique" ON "resources" USING btree ("stash_user_id","dedupe_key");
CREATE INDEX "resources_stash_position_idx" ON "resources" USING btree ("stash_user_id","position");

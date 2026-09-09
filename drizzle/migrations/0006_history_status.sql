ALTER TABLE "history" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'success' NOT NULL;

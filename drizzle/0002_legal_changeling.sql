ALTER TYPE "public"."resource_type" ADD VALUE 'local_media' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "resources" ALTER COLUMN "url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "starred_resources" ALTER COLUMN "url" DROP NOT NULL;--> statement-breakpoint
UPDATE "resources" AS resource
SET "type" = 'local_media', "url" = NULL
FROM "resource_metadata" AS metadata
WHERE metadata."resource_id" = resource."id"
  AND metadata."provider" = 'local-media';--> statement-breakpoint
UPDATE "starred_resources" AS starred
SET "type" = 'local_media', "url" = NULL
FROM "resources" AS resource
WHERE starred."source_resource_id" = resource."id"
  AND resource."type" = 'local_media';

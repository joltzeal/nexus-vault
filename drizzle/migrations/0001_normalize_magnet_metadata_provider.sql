UPDATE "resource_metadata"
SET "provider" = 'magnet'
WHERE "provider" IN ('whatslink', 'darklyn');

UPDATE "starred_resources"
SET "metadata_provider" = 'magnet'
WHERE "metadata_provider" IN ('whatslink', 'darklyn');

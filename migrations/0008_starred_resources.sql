CREATE TABLE IF NOT EXISTS starred_resources (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  source_resource_id TEXT NOT NULL,
  source_vault_id TEXT NOT NULL,
  source_space_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  metadata_status TEXT NOT NULL DEFAULT 'pending',
  metadata_provider TEXT,
  metadata_data_json TEXT NOT NULL DEFAULT '{}',
  metadata_error_message TEXT,
  source_created_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS starred_resources_user_source_unique
  ON starred_resources (user_id, source_resource_id);

CREATE INDEX IF NOT EXISTS starred_resources_user_created_idx
  ON starred_resources (user_id, created_at);

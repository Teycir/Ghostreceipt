-- Sanctum-style pointer storage table for short-link payload lookup.
-- Apply with Wrangler D1:
--   wrangler d1 execute <DB_NAME> --file=./scripts/sql/share-pointers.sql

CREATE TABLE IF NOT EXISTS share_pointers (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  last_accessed_at_ms INTEGER NOT NULL,
  is_active INTEGER NOT NULL,
  deactivated_at_ms INTEGER
);

CREATE INDEX IF NOT EXISTS share_pointers_active_access_idx
ON share_pointers(is_active, last_accessed_at_ms, created_at_ms);

CREATE INDEX IF NOT EXISTS share_pointers_expires_idx
ON share_pointers(expires_at_ms);

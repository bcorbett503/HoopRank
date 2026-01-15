-- Migration: Deprecate legacy match columns
-- The participants and started_by columns are no longer used by the API
-- All logic now uses creator_id/opponent_id pattern for type safety

-- Mark columns as deprecated via comment (safe approach)
COMMENT ON COLUMN matches.participants IS 'DEPRECATED: Use creator_id/opponent_id instead. Will be removed in future migration.';
COMMENT ON COLUMN matches.started_by IS 'DEPRECATED: Legacy "all started" tracking. May be removed in future migration.';

-- Make participants nullable since it's no longer required
ALTER TABLE matches ALTER COLUMN participants DROP NOT NULL;

-- Set default to empty array for backwards compatibility
ALTER TABLE matches ALTER COLUMN participants SET DEFAULT ARRAY[]::text[];

-- NOTE: Full column removal deferred to a future migration after confirming
-- no running instances depend on these columns:
-- ALTER TABLE matches DROP COLUMN participants;
-- ALTER TABLE matches DROP COLUMN started_by;

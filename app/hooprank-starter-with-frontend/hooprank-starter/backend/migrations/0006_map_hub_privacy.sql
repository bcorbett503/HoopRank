-- Migration 0006: Map hub privacy and generated avatar metadata.
-- Idempotent schema additions for player map visibility and editable avatars.

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepting_challenges BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS loc_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS user_privacy (
    user_id VARCHAR(255) PRIMARY KEY,
    push_enabled BOOLEAN DEFAULT TRUE,
    public_profile BOOLEAN DEFAULT TRUE,
    public_location BOOLEAN DEFAULT FALSE,
    map_visibility_enabled BOOLEAN DEFAULT FALSE,
    discover_radius_mi NUMERIC(5,1) DEFAULT 25.0,
    discover_mode TEXT DEFAULT 'open',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE user_privacy ADD COLUMN IF NOT EXISTS map_visibility_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE user_privacy ADD COLUMN IF NOT EXISTS discover_radius_mi NUMERIC(5,1) DEFAULT 25.0;
ALTER TABLE user_privacy ADD COLUMN IF NOT EXISTS discover_mode TEXT DEFAULT 'open';
ALTER TABLE user_privacy ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_map_lat_lng ON users (lat, lng);
CREATE INDEX IF NOT EXISTS idx_user_privacy_map_visibility
    ON user_privacy (map_visibility_enabled, public_location);

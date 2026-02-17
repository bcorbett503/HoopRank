-- Migration 0003: User Schema Fixes
-- Extracted from UsersService.runMigrations() during Phase 7 decomposition.
-- Contains 10 one-time schema fixes that were previously run at runtime.
-- These are idempotent and safe to re-run (all use IF NOT EXISTS / IF EXISTS).

-- Fix 1: Recreate user_followed_courts with VARCHAR(255) for user_id and court_id
-- (originally migrated from UUID to VARCHAR to support Firebase UIDs)
CREATE TABLE IF NOT EXISTS user_followed_courts (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    court_id VARCHAR(255) NOT NULL,
    alerts_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, court_id)
);

-- Fix 2: Create user_court_alerts if missing
CREATE TABLE IF NOT EXISTS user_court_alerts (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    court_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, court_id)
);

-- Fix 3: Ensure user_followed_players has correct types
CREATE TABLE IF NOT EXISTS user_followed_players (
    id SERIAL PRIMARY KEY,
    follower_id VARCHAR(255) NOT NULL,
    followed_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, followed_id)
);

-- Fix 4: Add court_id column to player_statuses if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'player_statuses' AND column_name = 'court_id'
    ) THEN
        ALTER TABLE player_statuses ADD COLUMN court_id VARCHAR(255) NULL;
    END IF;
END $$;

-- Fix 4b: Add video columns to player_statuses if missing
ALTER TABLE player_statuses ADD COLUMN IF NOT EXISTS video_url VARCHAR(500);
ALTER TABLE player_statuses ADD COLUMN IF NOT EXISTS video_thumbnail_url VARCHAR(500);
ALTER TABLE player_statuses ADD COLUMN IF NOT EXISTS video_duration_ms INTEGER;

-- Fix 7: Add missing columns to users table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'position') THEN
        ALTER TABLE users ADD COLUMN position TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'height') THEN
        ALTER TABLE users ADD COLUMN height TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'weight') THEN
        ALTER TABLE users ADD COLUMN weight INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'city') THEN
        ALTER TABLE users ADD COLUMN city TEXT;
    END IF;
END $$;

-- Fix 8: Create teams tables if missing
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    team_type TEXT NOT NULL,
    owner_id VARCHAR(255) NOT NULL,
    rating NUMERIC(2,1) DEFAULT 3.0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    logo_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    status TEXT DEFAULT 'pending',
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    sender_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fix 10: Create user_followed_teams table if missing
CREATE TABLE IF NOT EXISTS user_followed_teams (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    team_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, team_id)
);

-- Note: Fixes 5 (player_statuses.user_id INT→VARCHAR), 6 (users.id INT→VARCHAR),
-- and 9 (check_ins.court_id UUID→VARCHAR) involved destructive ALTER COLUMN TYPE
-- operations that can only be safely run once on the original database.
-- These are omitted from this migration as they have already been applied.

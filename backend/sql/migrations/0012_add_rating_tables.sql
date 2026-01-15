-- Migration: Add rating system tables
-- These tables are required by rating.ts for the engagement and rating system

-- User Ratings - caches current MMR and streak data
CREATE TABLE IF NOT EXISTS user_ratings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mmr INTEGER NOT NULL DEFAULT 1500,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_active_day DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_user_ratings_updated 
  BEFORE UPDATE ON user_ratings 
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Engagement Ledger - tracks engagement points with reasons
CREATE TABLE IF NOT EXISTS engagement_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_engagement_user_created 
  ON engagement_ledger(user_id, created_at DESC);

-- Rank History - historical snapshots of user rankings
CREATE TABLE IF NOT EXISTS rank_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  elo INTEGER NOT NULL,
  hoop_rank NUMERIC(2,1) NOT NULL,
  source TEXT,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rank_history_user_created 
  ON rank_history(user_id, created_at ASC);

-- Add expires_at column to challenges if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'challenges' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE challenges 
    ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours');
  END IF;
END $$;

-- Add updated_at column to invites if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invites' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE invites 
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

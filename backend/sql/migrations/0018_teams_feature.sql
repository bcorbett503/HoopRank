-- 0018_teams_feature.sql
-- Teams Feature: Add teams, team_members, and team match support
-- =============================================================================

-- Teams table (type-specific: 3v3 or 5v5)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  team_type VARCHAR(3) NOT NULL CHECK (team_type IN ('3v3', '5v5')),
  -- Rating and MMR for team rankings
  rating NUMERIC(3,2) NOT NULL DEFAULT 3.0 CHECK (rating BETWEEN 1.0 AND 5.0),
  mmr INTEGER NOT NULL DEFAULT 1500,
  matches_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  -- Auto-created group chat thread
  thread_id UUID REFERENCES threads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team members (roster)
CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ,
  PRIMARY KEY (team_id, user_id)
);

-- Add match_type and team references to matches table
ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_type VARCHAR(3) NOT NULL DEFAULT '1v1' 
  CHECK (match_type IN ('1v1', '3v3', '5v5'));
ALTER TABLE matches ADD COLUMN IF NOT EXISTS creator_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams (owner_id);
CREATE INDEX IF NOT EXISTS idx_teams_type_rating ON teams (team_type, rating DESC);
CREATE INDEX IF NOT EXISTS idx_teams_thread ON teams (thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members (user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members (team_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_type ON matches (match_type);
CREATE INDEX IF NOT EXISTS idx_matches_creator_team ON matches (creator_team_id) WHERE creator_team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_opponent_team ON matches (opponent_team_id) WHERE opponent_team_id IS NOT NULL;

-- Updated_at trigger for teams
CREATE TRIGGER trg_teams_updated 
  BEFORE UPDATE ON teams 
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Function to enforce max team size
CREATE OR REPLACE FUNCTION check_team_size() RETURNS TRIGGER AS $$
DECLARE
  team_type VARCHAR(3);
  max_size INTEGER;
  current_size INTEGER;
BEGIN
  SELECT t.team_type INTO team_type FROM teams t WHERE t.id = NEW.team_id;
  
  IF team_type = '3v3' THEN
    max_size := 5;
  ELSE
    max_size := 10;
  END IF;
  
  SELECT COUNT(*) INTO current_size 
  FROM team_members 
  WHERE team_id = NEW.team_id AND status = 'accepted';
  
  IF current_size >= max_size AND NEW.status = 'accepted' THEN
    RAISE EXCEPTION 'Team is full (max % members for %)', max_size, team_type;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_team_size
  BEFORE INSERT OR UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION check_team_size();

-- Comments for documentation
COMMENT ON TABLE teams IS 'Teams for 3v3 or 5v5 matches. Max 5 members for 3v3, 10 for 5v5.';
COMMENT ON TABLE team_members IS 'Team roster with invite/accept workflow.';
COMMENT ON COLUMN matches.match_type IS '1v1 (individual), 3v3, or 5v5 (team)';
COMMENT ON COLUMN matches.creator_team_id IS 'Team that created the match (for 3v3/5v5)';
COMMENT ON COLUMN matches.opponent_team_id IS 'Opponent team (for 3v3/5v5)';

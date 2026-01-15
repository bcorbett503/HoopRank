-- Add contest tracking columns for community rating
-- games_played: total games completed by this player
-- games_contested: number of games this player contested

ALTER TABLE users ADD COLUMN IF NOT EXISTS games_played INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS games_contested INT DEFAULT 0;

-- Create index for contestRate queries (if needed for sorting/filtering)
CREATE INDEX IF NOT EXISTS idx_users_contest_rate ON users (games_contested, games_played);

COMMENT ON COLUMN users.games_played IS 'Total number of completed games';
COMMENT ON COLUMN users.games_contested IS 'Number of games contested by this player';

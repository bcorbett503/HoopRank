-- 0023_team_group_chat.sql
-- Team Group Chat: Extend threads for group messaging
-- =============================================================================

-- Add columns to threads table for group chat support
ALTER TABLE threads ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE threads ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Make user_a and user_b nullable for group threads (they're only used for 1:1 chats)
ALTER TABLE threads ALTER COLUMN user_a DROP NOT NULL;
ALTER TABLE threads ALTER COLUMN user_b DROP NOT NULL;

-- Thread participants table for group chats
CREATE TABLE IF NOT EXISTS thread_participants (
  thread_id UUID NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

-- Index for efficient lookup of user's group threads
CREATE INDEX IF NOT EXISTS idx_thread_participants_user ON thread_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_team ON threads(team_id) WHERE team_id IS NOT NULL;

-- Make messages.to_id nullable for group messages (group messages don't have a single recipient)
ALTER TABLE messages ALTER COLUMN to_id DROP NOT NULL;

-- Comments
COMMENT ON COLUMN threads.is_group IS 'True for group chats (team chats), false for 1:1 DMs';
COMMENT ON COLUMN threads.team_id IS 'Link to team for team group chats';
COMMENT ON COLUMN threads.group_name IS 'Display name for group threads';
COMMENT ON TABLE thread_participants IS 'Participants in group threads';

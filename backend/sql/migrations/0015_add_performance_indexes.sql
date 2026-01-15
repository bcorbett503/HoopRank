-- Migration: Add performance indexes for common query patterns
-- These indexes optimize frequent lookups in matches, challenges, and messages

-- =============================================================================
-- MATCHES TABLE
-- =============================================================================
-- Participant lookups: Finding all matches where a user is creator or opponent
-- Used by: match history queries, stats calculations, recent games
CREATE INDEX IF NOT EXISTS idx_matches_creator_id 
  ON matches(creator_id);

CREATE INDEX IF NOT EXISTS idx_matches_opponent_id 
  ON matches(opponent_id);

-- Combined status + participant for filtered history queries
-- Used by: pending match lookups, active match filtering
CREATE INDEX IF NOT EXISTS idx_matches_status_creator 
  ON matches(status, creator_id);

CREATE INDEX IF NOT EXISTS idx_matches_status_opponent 
  ON matches(status, opponent_id);

-- =============================================================================
-- CHALLENGES TABLE
-- =============================================================================
-- Status filtering: Very common for pending challenge lookups
CREATE INDEX IF NOT EXISTS idx_challenges_status 
  ON challenges(status);

-- Recipient lookups: Finding challenges sent TO a specific user
CREATE INDEX IF NOT EXISTS idx_challenges_to_id 
  ON challenges(to_id);

-- Sender lookups: Finding challenges sent BY a specific user  
CREATE INDEX IF NOT EXISTS idx_challenges_from_id 
  ON challenges(from_id);

-- Composite for active challenge checks (common deduplication query)
CREATE INDEX IF NOT EXISTS idx_challenges_pending_pair 
  ON challenges(from_id, to_id) 
  WHERE status = 'pending';

-- =============================================================================
-- MESSAGES TABLE
-- =============================================================================
-- Unread message counts: Partial index for efficient badge counts
CREATE INDEX IF NOT EXISTS idx_messages_unread 
  ON messages(to_id) 
  WHERE read = false;

-- Sender lookups (less common but useful for message history)
CREATE INDEX IF NOT EXISTS idx_messages_from_id 
  ON messages(from_id);

-- =============================================================================
-- THREADS TABLE
-- =============================================================================
-- User thread lookups: Finding all threads involving a specific user
-- Note: user_a is always < user_b due to symmetrical pair pattern
CREATE INDEX IF NOT EXISTS idx_threads_user_a 
  ON threads(user_a);

CREATE INDEX IF NOT EXISTS idx_threads_user_b 
  ON threads(user_b);

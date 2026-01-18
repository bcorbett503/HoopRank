-- Add new match statuses for team challenges
-- Drop and recreate the status constraint to include new statuses

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;

ALTER TABLE matches ADD CONSTRAINT matches_status_check 
  CHECK (status IN (
    'waiting',           -- Original: waiting for opponent to join
    'live',              -- Original: match in progress
    'ended',             -- Original: match completed
    'challenge_pending', -- Team challenge sent, waiting for response
    'accepted',          -- Challenge accepted, ready to play
    'declined',          -- Challenge declined
    'pending_confirmation', -- Score submitted, waiting for opponent confirmation
    'completed',         -- Match finished with confirmed score
    'disputed',          -- Score mismatch between teams
    'cancelled'          -- Match cancelled
  ));

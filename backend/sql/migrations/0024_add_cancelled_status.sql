-- Add 'cancelled' status to challenges table check constraint
-- This is needed because the cancel challenge endpoint sets status = 'cancelled'

-- Drop the existing constraint and add a new one with 'cancelled' included
ALTER TABLE challenges DROP CONSTRAINT IF EXISTS challenges_status_check;
ALTER TABLE challenges ADD CONSTRAINT challenges_status_check 
  CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled'));

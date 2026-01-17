-- Migration: Change hoop_rank to numeric(3,2) for 2 decimal precision
-- This allows ratings like 3.15, 2.85, etc.

ALTER TABLE users 
ALTER COLUMN hoop_rank TYPE numeric(3,2);

-- Also update reputation to match
ALTER TABLE users 
ALTER COLUMN reputation TYPE numeric(3,2);

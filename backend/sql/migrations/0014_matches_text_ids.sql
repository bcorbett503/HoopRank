-- Migration: Change matches table ID columns from UUID to TEXT for Firebase compatibility
-- This allows Firebase auth IDs (which are strings, not UUIDs) to be stored

ALTER TABLE matches 
  ALTER COLUMN creator_id TYPE TEXT,
  ALTER COLUMN opponent_id TYPE TEXT,
  ALTER COLUMN court_id TYPE TEXT;

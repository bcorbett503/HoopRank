-- 0017_add_city_to_users.sql
-- Add city column to users table for zip code lookup results

ALTER TABLE users ADD COLUMN IF NOT EXISTS city text;

-- Add index for city lookups
CREATE INDEX IF NOT EXISTS idx_users_city ON users (city) WHERE city IS NOT NULL;

-- Comment describing the column
COMMENT ON COLUMN users.city IS 'City name, auto-populated from zip code via Zippopotam.us API';

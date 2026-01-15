-- Add authentication tracking columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT;

-- Add index for faster lookups by auth provider
CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);

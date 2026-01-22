-- Add fcm_token column to users table for push notifications
-- This column stores the Firebase Cloud Messaging token for each user

ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- Index for faster lookup of users with FCM tokens
CREATE INDEX IF NOT EXISTS idx_users_fcm_token ON users(fcm_token) WHERE fcm_token IS NOT NULL;

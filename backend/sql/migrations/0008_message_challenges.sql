-- Migration: Add challenge support to messages table
-- Creates fields to track which messages are challenges and their status

alter table messages
  add column if not exists is_challenge boolean not null default false,
  add column if not exists challenge_status text;

-- Add constraint for challenge_status values
alter table messages
  add constraint messages_challenge_status_check 
  check (challenge_status is null or challenge_status in ('pending', 'accepted', 'declined', 'expired'));

-- Add index for querying pending challenges
create index if not exists idx_messages_challenge_pending 
  on messages (from_id, is_challenge, challenge_status) 
  where is_challenge = true and challenge_status = 'pending';

-- Add comment
comment on column messages.is_challenge is 'Whether this message is a challenge';
comment on column messages.challenge_status is 'Status of the challenge: pending, accepted, declined, or expired';

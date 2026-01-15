-- Migration: Add match_id to messages table
-- Allows linking a message (like a challenge) to a specific match

alter table messages
  add column if not exists match_id uuid references matches(id) on delete set null;

create index if not exists idx_messages_match_id on messages(match_id);

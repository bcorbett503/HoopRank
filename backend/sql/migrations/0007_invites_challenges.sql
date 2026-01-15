-- === Invites ===
create table if not exists invites (
  token       text primary key,
  type        text not null check (type in ('match')),
  host_id     text not null references users(id),
  status      text not null default 'open' check (status in ('open','accepted','expired')),
  accepted_by text references users(id),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists invites_host_idx    on invites(host_id);
create index if not exists invites_status_idx  on invites(status);
create index if not exists invites_expires_idx on invites(expires_at);

-- === Challenges ===
create table if not exists challenges (
  id         uuid primary key,
  from_id    text not null references users(id),
  to_id      text not null references users(id),
  message    text,
  status     text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure at most one PENDING challenge between a pair (order-independent)
create index if not exists challenges_inbox_idx  on challenges(to_id, status);
create index if not exists challenges_outbox_idx on challenges(from_id, status);
create unique index if not exists challenges_unique_pending
  on challenges (least(from_id,to_id), greatest(from_id,to_id))
  where status = 'pending';

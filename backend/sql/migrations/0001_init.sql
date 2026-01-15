create extension if not exists postgis;
create extension if not exists citext;
create extension if not exists pgcrypto;

-- Common "updated_at" trigger
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

-- USERS
create table if not exists users (
  id text primary key,
  email text unique,
  username citext unique,
  name text not null,
  dob date,
  avatar_url text,
  hoop_rank numeric(2,1) not null default 3.0 check (hoop_rank between 1.0 and 5.0),
  reputation numeric(2,1) not null default 5.0 check (reputation between 0 and 5),
  position text,
  height text,
  weight integer,
  zip text,
  loc_enabled boolean not null default false,
  last_loc geography(point,4326),
  last_loc_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_users_updated before update on users for each row execute function set_updated_at();

-- PRIVACY
create table if not exists user_privacy (
  user_id text primary key references users(id) on delete cascade,
  push_enabled boolean not null default true,
  public_profile boolean not null default true,
  public_location boolean not null default true,
  discover_radius_mi numeric(4,2) not null default 5,
  discover_mode text not null default 'open' check (discover_mode in ('open','similar')),
  discover_window numeric(2,1) not null default 0.5,
  discover_min_reputation numeric(2,1) not null default 0
);

-- FRIENDS / REQUESTS
create table if not exists friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_id text not null references users(id) on delete cascade,
  to_id text not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_id, to_id)
);
create trigger trg_fr_updated before update on friend_requests for each row execute function set_updated_at();

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  user_a text not null references users(id) on delete cascade,
  user_b text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a <> user_b)
);
create index if not exists idx_friendships_a on friendships(user_a);
create index if not exists idx_friendships_b on friendships(user_b);

-- COURTS
create table if not exists courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  indoor boolean,
  rims integer,
  source text,
  geog geography(point,4326) not null
);
create index if not exists courts_geog_gix on courts using gist (geog);

-- MATCHES
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('waiting','live','ended')),
  creator_id text not null references users(id),
  opponent_id text references users(id),
  court_id uuid references courts(id),
  participants text[] not null,
  started_by jsonb not null default '{}'::jsonb,
  timer_start timestamptz,
  score jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists matches_status_idx on matches(status);
create index if not exists matches_court_idx on matches(court_id);
create trigger trg_matches_updated before update on matches for each row execute function set_updated_at();

-- RATINGS HISTORY
create table if not exists ratings_history (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  at timestamptz not null default now(),
  rating_before numeric(2,1),
  rating_after numeric(2,1),
  delta numeric(2,1)
);
create index if not exists idx_ratings_user_at on ratings_history(user_id, at desc);

-- COURT KINGS
create table if not exists court_kings_current (
  court_id uuid not null references courts(id) on delete cascade,
  bracket text not null,
  user_id text not null references users(id) on delete cascade,
  hoop_rank numeric(2,1) not null,
  last_win_at timestamptz not null,
  primary key (court_id, bracket)
);
create table if not exists court_kings_history (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  bracket text not null,
  user_id text not null references users(id) on delete cascade,
  hoop_rank numeric(2,1) not null,
  from_at timestamptz not null,
  to_at timestamptz
);

-- MESSAGING
create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  user_a text not null references users(id) on delete cascade,
  user_b text not null references users(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_a, user_b)
);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  from_id text not null references users(id) on delete cascade,
  to_id text not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read boolean not null default false
);
create index if not exists idx_msg_thread_at on messages(thread_id, created_at);
create index if not exists idx_msg_to_read on messages(to_id, read);

-- DEVICES
create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  platform text not null check (platform in ('ios','android','web')),
  token text not null,
  app_version text,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_devices_token on devices(token);

-- NOTIFICATIONS
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references users(id) on delete cascade,
  type text not null,
  title text,
  body text,
  data jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_read on notifications(user_id, read);

-- CHALLENGES
create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  from_id text not null references users(id) on delete cascade,
  to_id text not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_challenges_updated before update on challenges for each row execute function set_updated_at();

-- INVITES
create table if not exists invites (
  token uuid primary key default gen_random_uuid(),
  type text not null check (type in ('match')),
  host_id text not null references users(id) on delete cascade,
  status text not null default 'open' check (status in ('open','accepted','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_by text references users(id)
);
create index if not exists idx_invites_expiry on invites(expires_at);

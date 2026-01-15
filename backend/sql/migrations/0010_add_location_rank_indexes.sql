-- Add GIST index for efficient spatial queries on user location
create index if not exists idx_users_last_loc on users using gist (last_loc);

-- Add B-Tree index for efficient ranking/sorting by HoopRank
create index if not exists idx_users_hoop_rank on users(hoop_rank desc);

-- 0001_init.sql (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  rating NUMERIC(2,1) DEFAULT 2.5 CHECK (rating BETWEEN 1.0 AND 5.0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY,
  host_id UUID REFERENCES users(id),
  guest_id UUID REFERENCES users(id),
  status TEXT CHECK (status IN ('pending','accepted','completed','cancelled')),
  rating_diff_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS elo_history (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  match_id UUID REFERENCES matches(id),
  elo_before INT NOT NULL,
  elo_after  INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

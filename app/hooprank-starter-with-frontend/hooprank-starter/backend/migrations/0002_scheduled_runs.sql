-- Migration: Create scheduled_runs and run_attendees tables
-- Extracted from RunsService.ensureTables() during Phase 6 tech debt cleanup
-- 
-- This migration is idempotent (IF NOT EXISTS / IF NOT EXISTS on columns).
-- Safe to run multiple times.

-- 1. Create the scheduled_runs table
CREATE TABLE IF NOT EXISTS scheduled_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_id VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    game_mode VARCHAR(20) DEFAULT '5v5',
    court_type VARCHAR(20),
    age_range VARCHAR(20),
    scheduled_at TIMESTAMP NOT NULL,
    status_id INTEGER,
    duration_minutes INTEGER DEFAULT 120,
    max_players INTEGER DEFAULT 10,
    notes TEXT,
    tagged_player_ids TEXT,
    tag_mode VARCHAR(20),
    visibility VARCHAR(20) DEFAULT 'public',
    invited_player_ids TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create the run_attendees table
CREATE TABLE IF NOT EXISTS run_attendees (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'going',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(run_id, user_id)
);

/**
 * Consolidated database schema migrations
 * 
 * This file handles all schema migrations in one place, called once at startup.
 * Replaces scattered ALTER TABLE statements throughout the codebase.
 * 
 * All migrations use IF NOT EXISTS / IF EXISTS patterns to be idempotent.
 */

import { DataSource } from 'typeorm';

export async function runSchemaEvolution(dataSource: DataSource): Promise<void> {
    console.log('[SchemaEvolution] Running consolidated migrations...');
    const isPostgres = !!process.env.DATABASE_URL;

    if (!isPostgres) {
        console.log('[SchemaEvolution] Skipping - SQLite mode');
        return;
    }

    try {
        // ============================================
        // MATCHES TABLE MIGRATIONS
        // ============================================

        // Team match support columns
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_match BOOLEAN DEFAULT false`);
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS creator_team_id UUID`);
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent_team_id UUID`);
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_type VARCHAR(10) DEFAULT '1v1'`);

        // Score and completion columns
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_creator INTEGER`);
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_opponent INTEGER`);
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`);
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_id UUID`);

        // ============================================
        // TEAMS TABLE MIGRATIONS  
        // ============================================

        await dataSource.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0`);
        await dataSource.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0`);
        await dataSource.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 3.00`);
        await dataSource.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS age_group TEXT`);
        await dataSource.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS gender TEXT`);
        await dataSource.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS skill_level TEXT`);
        await dataSource.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS home_court_id TEXT`);
        await dataSource.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS city TEXT`);
        await dataSource.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT`);

        // ============================================
        // USERS TABLE MIGRATIONS
        // ============================================

        // Age column for rankings filter
        await dataSource.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER`);

        // Standardize rating precision to DECIMAL(3,2)
        await dataSource.query(`ALTER TABLE users ALTER COLUMN hoop_rank TYPE DECIMAL(3,2)`);
        await dataSource.query(`ALTER TABLE users ALTER COLUMN reputation TYPE DECIMAL(3,2)`);
        await dataSource.query(`ALTER TABLE teams ALTER COLUMN rating TYPE DECIMAL(3,2)`);

        // ============================================
        // PLAYER_STATUSES TABLE MIGRATIONS
        // ============================================

        await dataSource.query(`
            ALTER TABLE player_statuses 
                ADD COLUMN IF NOT EXISTS video_url VARCHAR(500),
                ADD COLUMN IF NOT EXISTS video_thumbnail_url VARCHAR(500),
                ADD COLUMN IF NOT EXISTS video_duration_ms INTEGER
        `);

        // ============================================
        // INDEXES FOR PERFORMANCE
        // ============================================

        // Matches indexes
        await dataSource.query(`CREATE INDEX IF NOT EXISTS idx_matches_creator_id ON matches(creator_id)`);
        await dataSource.query(`CREATE INDEX IF NOT EXISTS idx_matches_opponent_id ON matches(opponent_id)`);
        await dataSource.query(`CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status)`);
        await dataSource.query(`CREATE INDEX IF NOT EXISTS idx_matches_court_id ON matches(court_id)`);
        await dataSource.query(`CREATE INDEX IF NOT EXISTS idx_matches_team_match ON matches(team_match) WHERE team_match = true`);

        // Player statuses indexes
        await dataSource.query(`CREATE INDEX IF NOT EXISTS idx_player_statuses_court_id ON player_statuses(court_id)`);
        await dataSource.query(`CREATE INDEX IF NOT EXISTS idx_player_statuses_user_id ON player_statuses(user_id)`);

        // Users indexes
        await dataSource.query(`CREATE INDEX IF NOT EXISTS idx_users_hoop_rank ON users(hoop_rank) WHERE hoop_rank IS NOT NULL`);

        // ============================================
        // TEAM EVENTS TABLE (practices & games)
        // ============================================

        await dataSource.query(`
            CREATE TABLE IF NOT EXISTS team_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                team_id UUID NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                event_date TIMESTAMPTZ NOT NULL,
                end_date TIMESTAMPTZ,
                location_name TEXT,
                court_id VARCHAR(255),
                opponent_team_id UUID,
                opponent_team_name TEXT,
                recurrence_rule TEXT,
                notes TEXT,
                created_by TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        await dataSource.query(`
            CREATE TABLE IF NOT EXISTS team_event_attendance (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                event_id UUID NOT NULL,
                user_id TEXT NOT NULL,
                status TEXT DEFAULT 'in',
                responded_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Team events indexes
        await dataSource.query(`CREATE INDEX IF NOT EXISTS idx_team_events_team_id ON team_events(team_id)`);
        await dataSource.query(`CREATE INDEX IF NOT EXISTS idx_team_events_event_date ON team_events(event_date)`);
        await dataSource.query(`CREATE INDEX IF NOT EXISTS idx_team_event_attendance_event_id ON team_event_attendance(event_id)`);
        await dataSource.query(`CREATE INDEX IF NOT EXISTS idx_team_event_attendance_user_id ON team_event_attendance(user_id)`);

        // Link team_events to matches for game→match pipeline
        await dataSource.query(`ALTER TABLE team_events ADD COLUMN IF NOT EXISTS match_id UUID`);

        // Store rating changes on matches for feed display (e.g. "3.0 → 3.2")
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_old_rating DECIMAL(4,2)`);
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_new_rating DECIMAL(4,2)`);
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS loser_old_rating DECIMAL(4,2)`);
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS loser_new_rating DECIMAL(4,2)`);

        // Store custom opponent name for unregistered teams
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent_name TEXT`);

        // Backfill opponent_name from linked team_events for existing matches
        await dataSource.query(`
            UPDATE matches m
            SET opponent_name = te.opponent_team_name
            FROM team_events te
            WHERE te.match_id = m.id
              AND m.opponent_name IS NULL
              AND te.opponent_team_name IS NOT NULL
        `);

        console.log('[SchemaEvolution] All migrations completed successfully');
    } catch (error) {
        console.error('[SchemaEvolution] Migration error:', error.message);
        // Don't throw - allow app to continue even if some migrations fail
    }
}

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

        // ============================================
        // USERS TABLE MIGRATIONS
        // ============================================

        // Age column for rankings filter
        await dataSource.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER`);

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

        console.log('[SchemaEvolution] All migrations completed successfully');
    } catch (error) {
        console.error('[SchemaEvolution] Migration error:', error.message);
        // Don't throw - allow app to continue even if some migrations fail
    }
}

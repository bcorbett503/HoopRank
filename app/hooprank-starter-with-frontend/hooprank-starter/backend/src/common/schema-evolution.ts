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
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_submitter_id VARCHAR`);
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS status_id INTEGER`);

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

        // Games contested counter
        await dataSource.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS games_contested INT DEFAULT 0`);

        // Standardize rating precision to DECIMAL(3,2) — only if columns exist
        const alterColumnTypeIfExists = async (table: string, column: string, type: string) => {
            const exists = await dataSource.query(
                `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
                [table, column],
            );
            if (exists.length > 0) {
                await dataSource.query(`ALTER TABLE ${table} ALTER COLUMN ${column} TYPE ${type}`);
            }
        };
        await alterColumnTypeIfExists('users', 'hoop_rank', 'DECIMAL(3,2)');
        await alterColumnTypeIfExists('users', 'reputation', 'DECIMAL(3,2)');
        await alterColumnTypeIfExists('teams', 'rating', 'DECIMAL(3,2)');

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

        // ============================================
        // REPORT & BLOCK TABLES
        // ============================================

        await dataSource.query(`
            CREATE TABLE IF NOT EXISTS user_reports (
                id SERIAL PRIMARY KEY,
                reporter_id VARCHAR(255) NOT NULL,
                reported_user_id VARCHAR(255) NOT NULL,
                reason TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await dataSource.query(`
            CREATE TABLE IF NOT EXISTS content_reports (
                id SERIAL PRIMARY KEY,
                reporter_id VARCHAR(255) NOT NULL,
                status_id INTEGER NOT NULL,
                reason TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await dataSource.query(`
            CREATE TABLE IF NOT EXISTS blocked_users (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                blocked_user_id VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, blocked_user_id)
            )
        `);

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

        // Confirm/Amend flow columns for team matches
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS submitted_by_team_id TEXT`);
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS amended_score_creator INT`);
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS amended_score_opponent INT`);
        await dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS amended_by_team_id TEXT`);

        // Update status constraint to include pending_confirmation and pending_amendment
        await dataSource.query(`ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check`);
        await dataSource.query(`
            ALTER TABLE matches ADD CONSTRAINT matches_status_check
            CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled', 'ended', 'score_submitted', 'contested', 'pending_confirmation', 'pending_amendment'))
        `);
        // ============================================
        // ENGAGEMENT TABLE COLUMN TYPE FIXES
        // ============================================
        // These tables may have been created with INTEGER user_id
        // but need VARCHAR for Firebase UIDs.
        const engagementTables = ['status_likes', 'status_comments', 'event_attendees'];
        for (const table of engagementTables) {
            try {
                const tableExists = await dataSource.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_name = $1
                    )
                `, [table]);

                if (!tableExists[0]?.exists) continue;

                const columnInfo = await dataSource.query(`
                    SELECT data_type FROM information_schema.columns
                    WHERE table_name = $1 AND column_name = 'user_id'
                `, [table]);

                if (columnInfo.length > 0 && columnInfo[0]?.data_type === 'integer') {
                    await dataSource.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_user_id_fkey`);
                    await dataSource.query(`ALTER TABLE ${table} ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::VARCHAR(255)`);
                }

                // Ensure status_id FK points to player_statuses
                await dataSource.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_status_id_fkey`).catch(() => { });
                await dataSource.query(`
                    ALTER TABLE ${table}
                    ADD CONSTRAINT ${table}_status_id_fkey
                    FOREIGN KEY (status_id) REFERENCES player_statuses(id) ON DELETE CASCADE
                `).catch(() => { });
            } catch (tableError) {
                console.error(`[SchemaEvolution] Error fixing ${table}:`, tableError.message);
            }
        }

        // ============================================
        // MESSAGE MEDIA COLUMNS
        // ============================================
        await dataSource.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT`);
        await dataSource.query(`ALTER TABLE team_messages ADD COLUMN IF NOT EXISTS image_url TEXT`);

        console.log('[SchemaEvolution] All migrations completed successfully');
    } catch (error) {
        console.error('[SchemaEvolution] FATAL: Migration failed — refusing to start:', error.message);
        throw error; // Fail-closed: crash the app so Railway surfaces the issue
    }
}

/**
 * Consolidated database schema migrations
 *
 * This file handles all schema migrations in one place, called once at startup.
 * Replaces scattered ALTER TABLE statements throughout the codebase.
 *
 * All migrations use IF NOT EXISTS / IF EXISTS patterns to be idempotent.
 */

import { DataSource } from "typeorm";

export async function runSchemaEvolution(
  dataSource: DataSource,
): Promise<void> {
  console.log("[SchemaEvolution] Running consolidated migrations...");
  const isPostgres = !!process.env.DATABASE_URL;

  if (!isPostgres) {
    console.log("[SchemaEvolution] Skipping - SQLite mode");
    return;
  }

  // Helper: run a migration query, log errors but don't crash the server
  const safeQuery = async (label: string, sql: string, params?: any[]) => {
    try {
      await dataSource.query(sql, params);
    } catch (err) {
      console.warn(`[SchemaEvolution] WARN (${label}): ${err.message}`);
    }
  };

  try {
    // ============================================
    // MATCHES TABLE MIGRATIONS
    // ============================================

    // Team match support columns
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_match BOOLEAN DEFAULT false`,
    );
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS creator_team_id UUID`,
    );
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent_team_id UUID`,
    );
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_type VARCHAR(10) DEFAULT '1v1'`,
    );

    // Score and completion columns
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_creator INTEGER`,
    );
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_opponent INTEGER`,
    );
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`,
    );
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_id UUID`,
    );
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_submitter_id VARCHAR`,
    );
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS status_id INTEGER`,
    );

    // ============================================
    // TEAMS TABLE MIGRATIONS
    // ============================================

    await dataSource.query(
      `ALTER TABLE teams ADD COLUMN IF NOT EXISTS wins INTEGER DEFAULT 0`,
    );
    await dataSource.query(
      `ALTER TABLE teams ADD COLUMN IF NOT EXISTS losses INTEGER DEFAULT 0`,
    );
    await dataSource.query(
      `ALTER TABLE teams ADD COLUMN IF NOT EXISTS rating DECIMAL(3,2) DEFAULT 3.00`,
    );
    await dataSource.query(
      `ALTER TABLE teams ADD COLUMN IF NOT EXISTS age_group TEXT`,
    );
    await dataSource.query(
      `ALTER TABLE teams ADD COLUMN IF NOT EXISTS gender TEXT`,
    );
    await dataSource.query(
      `ALTER TABLE teams ADD COLUMN IF NOT EXISTS skill_level TEXT`,
    );
    await dataSource.query(
      `ALTER TABLE teams ADD COLUMN IF NOT EXISTS home_court_id TEXT`,
    );
    await dataSource.query(
      `ALTER TABLE teams ADD COLUMN IF NOT EXISTS city TEXT`,
    );
    await dataSource.query(
      `ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT`,
    );

    // ============================================
    // USERS TABLE MIGRATIONS
    // ============================================

    // Age column for rankings filter
    await dataSource.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER`,
    );

    // Games contested counter
    await dataSource.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS games_contested INT DEFAULT 0`,
    );

    // Onboarding progress — JSONB column for checklist state synced from mobile app
    await dataSource.query(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_progress JSONB DEFAULT '{}'`,
    );

    // Standardize rating precision to DECIMAL(3,2) — only if columns exist
    const alterColumnTypeIfExists = async (
      table: string,
      column: string,
      type: string,
    ) => {
      const exists = await dataSource.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
        [table, column],
      );
      if (exists.length > 0) {
        await dataSource.query(
          `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE ${type}`,
        );
      }
    };
    await alterColumnTypeIfExists("users", "hoop_rank", "DECIMAL(3,2)");
    await alterColumnTypeIfExists("users", "reputation", "DECIMAL(3,2)");
    await alterColumnTypeIfExists("teams", "rating", "DECIMAL(3,2)");

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
    await dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_matches_creator_id ON matches(creator_id)`,
    );
    await dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_matches_opponent_id ON matches(opponent_id)`,
    );
    await dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status)`,
    );
    await dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_matches_court_id ON matches(court_id)`,
    );
    await dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_matches_team_match ON matches(team_match) WHERE team_match = true`,
    );

    // Player statuses indexes
    await dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_player_statuses_court_id ON player_statuses(court_id)`,
    );
    await dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_player_statuses_user_id ON player_statuses(user_id)`,
    );

    // Users indexes (only create if column exists)
    const hoopRankExists = await dataSource.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'hoop_rank'`,
    );
    if (hoopRankExists.length > 0) {
      await dataSource.query(
        `CREATE INDEX IF NOT EXISTS idx_users_hoop_rank ON users(hoop_rank) WHERE hoop_rank IS NOT NULL`,
      );
    }

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
    await dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_team_events_team_id ON team_events(team_id)`,
    );
    await dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_team_events_event_date ON team_events(event_date)`,
    );
    await dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_team_event_attendance_event_id ON team_event_attendance(event_id)`,
    );
    await dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_team_event_attendance_user_id ON team_event_attendance(user_id)`,
    );

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
    await dataSource.query(
      `ALTER TABLE team_events ADD COLUMN IF NOT EXISTS match_id UUID`,
    );

    // Store rating changes on matches for feed display (e.g. "3.0 → 3.2")
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_old_rating DECIMAL(4,2)`,
    );
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_new_rating DECIMAL(4,2)`,
    );
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS loser_old_rating DECIMAL(4,2)`,
    );
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS loser_new_rating DECIMAL(4,2)`,
    );

    // Store custom opponent name for unregistered teams
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent_name TEXT`,
    );

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
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS submitted_by_team_id TEXT`,
    );
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS amended_score_creator INT`,
    );
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS amended_score_opponent INT`,
    );
    await dataSource.query(
      `ALTER TABLE matches ADD COLUMN IF NOT EXISTS amended_by_team_id TEXT`,
    );

    // Update status constraint to include pending_confirmation and pending_amendment
    await dataSource.query(
      `ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check`,
    );
    await dataSource.query(`
            ALTER TABLE matches ADD CONSTRAINT matches_status_check
            CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled', 'ended', 'score_submitted', 'contested', 'pending_confirmation', 'pending_amendment'))
        `);
    // ============================================
    // ENGAGEMENT TABLE COLUMN TYPE FIXES
    // ============================================
    // These tables may have been created with INTEGER user_id
    // but need VARCHAR for Firebase UIDs.
    const engagementTables = [
      "status_likes",
      "status_comments",
      "event_attendees",
    ];
    for (const table of engagementTables) {
      try {
        const tableExists = await dataSource.query(
          `
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_name = $1
                    )
                `,
          [table],
        );

        if (!tableExists[0]?.exists) continue;

        const columnInfo = await dataSource.query(
          `
                    SELECT data_type FROM information_schema.columns
                    WHERE table_name = $1 AND column_name = 'user_id'
                `,
          [table],
        );

        if (columnInfo.length > 0 && columnInfo[0]?.data_type === "integer") {
          await dataSource.query(
            `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_user_id_fkey`,
          );
          await dataSource.query(
            `ALTER TABLE ${table} ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::VARCHAR(255)`,
          );
        }

        // Ensure status_id FK points to player_statuses
        await dataSource
          .query(
            `ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_status_id_fkey`,
          )
          .catch(() => {});
        await dataSource
          .query(
            `
                    ALTER TABLE ${table}
                    ADD CONSTRAINT ${table}_status_id_fkey
                    FOREIGN KEY (status_id) REFERENCES player_statuses(id) ON DELETE CASCADE
                `,
          )
          .catch(() => {});
      } catch (tableError) {
        console.error(
          `[SchemaEvolution] Error fixing ${table}:`,
          tableError.message,
        );
      }
    }

    // ============================================
    // MESSAGE MEDIA COLUMNS
    // ============================================
    await dataSource.query(
      `ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT`,
    );
    await dataSource.query(
      `ALTER TABLE team_messages ADD COLUMN IF NOT EXISTS image_url TEXT`,
    );

    // ============================================
    // COURT HERO IMAGES
    // ============================================
    await dataSource.query(
      `ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_url TEXT`,
    );
    await dataSource.query(
      `ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_source_url TEXT`,
    );
    await dataSource.query(
      `ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_source_label TEXT`,
    );
    await dataSource.query(
      `ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMP`,
    );
    await dataSource.query(`
            UPDATE courts
            SET
                image_url = COALESCE(NULLIF(image_url, ''), seed.image_url),
                image_source_url = COALESCE(NULLIF(image_source_url, ''), seed.image_source_url),
                image_source_label = COALESCE(NULLIF(image_source_label, ''), seed.image_source_label),
                image_updated_at = COALESCE(image_updated_at, NOW())
            FROM (VALUES
                ('39bbaf2e-7393-d1d4-e7b8-f90d1e53fadc', 'https://www.bayclubs.com/bc-cdn/w_800/https%3A//cdn.prod.website-files.com/6881e0680b14937cf2a11855/68877a507f22eea742600ad5_BC_Hero_SanFrancisco-300x188.jpg', 'https://www.bayclubs.com/amenity/basketball', 'Bay Club official image'),
                ('6b1b9162-842e-cb1d-23cc-577999cc3c15', 'https://catholiccharitiessf.org/wp-content/uploads/elementor/thumbs/st-vincents-1-1-q3066x730ugy9jeti3zviomlx7a8rq336guafdvoug.jpg', 'https://catholiccharitiessf.org/st-vincents-school-for-boys/', 'Catholic Charities official image'),
                ('88f85c04-8e09-3217-1818-6adc818c784b', 'https://www.ci.gladstone.or.us/sites/g/files/vyhlif13701/files/media/publicworks/image/17061/08_25_17_senior_center.jpg', 'https://www.ci.gladstone.or.us/publicworks/page/city-facilities', 'City of Gladstone official venue image'),
                ('9c3e1ca0-6200-281b-5f44-45b774f7b6f1', 'https://bbk12e1-cdn.myschoolcdn.com/612/photo/2015/11/orig_photo319598_3280620.png?w=1920', 'https://www.marincatholic.org/about/our-facilities', 'Marin Catholic official gym image'),
                ('9d0e8a13-fd3c-39b5-e765-82e765c7a3fd', 'https://www.bayclubs.com/bc-cdn/w_800/https://cdn.prod.website-files.com/6881e0680b14937cf2a11855/6889f2e1a67beafa5961dca2_Marin_Basketball_3.jpg', 'https://www.bayclubs.com/clubs/marin', 'Bay Club Marin official basketball image'),
                ('b638a8a8-1df2-ec14-a864-6d4d3986e84b', 'https://www.usfca.edu/sites/default/files/styles/3_4_960x1280/public/2025-12/Koret%20Basketball.jpg.jpeg?h=af525af9&itok=YuqiphiX', 'https://www.usfca.edu/koret', 'USF Koret official image'),
                ('cb4b8982-4f42-8c11-01f6-f46401069022', 'https://www.bellevueclub.com/wp-content/uploads/2019/12/Recreation_basketball.jpg', 'https://www.bellevueclub.com/move/recreation/', 'Bellevue Club official basketball image'),
                ('d6f0a3f1-8bed-13fa-5d3f-a12dc704cff0', 'https://d2rzw8waxoxhv2.cloudfront.net/facilities/medium/2eda1609585525a9632a/1512329870699-690-66.jpg', 'https://facilities.facilitron.com/5970cb8207238f0020f56f2b', 'Hamilton gym facility image'),
                ('e72bb902-08f6-4dc0-acc3-fa85a6aa1b10', 'https://www.olyclub.com/wp-content/uploads/2025/12/CC-4-scaled-e1764871526289-1024x685.jpg', 'https://www.olyclub.com/public-homepage/guest-info/', 'Olympic Club official image'),
                ('ed6afa5f-f077-4868-9e50-8c71b3d703cf', 'https://www.instagram.com/p/DYbA2F9GSud/media/?size=l', 'https://www.instagram.com/p/DYbA2F9GSud/', 'Novato Parks open-gym image'),
                ('f65ce342-6b75-7faa-7205-47ea5cc0ba43', 'https://d2rzw8waxoxhv2.cloudfront.net/imagine/medium/mcms94903/1706148769819-834-33.jpg', 'https://facilities.facilitron.com/65a97676438e4ad58f9926ea', 'Miller Creek facility image'),
                ('fc74ef72-1ad1-0c4d-b7cc-019c010f1e68', 'https://images.ctfassets.net/drib7o8rcbyf/6wnKeePmucptvirOG8mvb/8923cb89403b898d5bb45374d46b6e7e/Equinox_ClubPage_Spaces_DT_ESCSanFran_3200x2133_____7.jpg', 'https://www.equinox.com/clubs/northern-california/sportsclubsanfrancisco', 'Equinox official image')
            ) AS seed(id, image_url, image_source_url, image_source_label)
            WHERE courts.id::text = seed.id
        `);

    console.log("[SchemaEvolution] All migrations completed successfully");
  } catch (error) {
    console.error(
      "[SchemaEvolution] Migration error (non-fatal):",
      error.message,
    );
    // Fail-open: log the error but let the server start.
    // Critical schema issues will surface as runtime query errors.
  }
}

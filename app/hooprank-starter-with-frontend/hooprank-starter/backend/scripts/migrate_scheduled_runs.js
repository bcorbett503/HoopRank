/**
 * Database Migration: Scheduled Runs Feature
 * 
 * Creates tables for scheduling pickup games at courts
 */
const { Client } = require('pg');

async function migrate() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== SCHEDULED RUNS MIGRATION ===\n');

        // 1. Create scheduled_runs table
        console.log('1. Creating scheduled_runs table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS scheduled_runs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
                created_by TEXT NOT NULL REFERENCES users(id),
                title VARCHAR(100),
                game_mode VARCHAR(10) DEFAULT '5v5',
                scheduled_at TIMESTAMPTZ NOT NULL,
                duration_minutes INT DEFAULT 120,
                max_players INT DEFAULT 10,
                is_recurring BOOLEAN DEFAULT false,
                recurrence_rule VARCHAR(50),
                notes TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        console.log('   ✅ scheduled_runs table created');

        // 2. Create scheduled_run_attendees table
        console.log('2. Creating scheduled_run_attendees table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS scheduled_run_attendees (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                run_id UUID NOT NULL REFERENCES scheduled_runs(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id),
                status VARCHAR(20) DEFAULT 'going',
                joined_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(run_id, user_id)
            )
        `);
        console.log('   ✅ scheduled_run_attendees table created');

        // 3. Create indexes for performance
        console.log('3. Creating indexes...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_scheduled_runs_court 
            ON scheduled_runs(court_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_scheduled_runs_time 
            ON scheduled_runs(scheduled_at)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_scheduled_runs_upcoming 
            ON scheduled_runs(scheduled_at) 
            WHERE scheduled_at > NOW()
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_run_attendees_run 
            ON scheduled_run_attendees(run_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_run_attendees_user 
            ON scheduled_run_attendees(user_id)
        `);
        console.log('   ✅ Indexes created');

        // 4. Verify tables exist
        console.log('\n4. Verifying tables...');
        const tables = await client.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_name LIKE 'scheduled%'
            ORDER BY table_name
        `);
        console.log('   Tables:', tables.rows.map(r => r.table_name).join(', '));

        console.log('\n=== MIGRATION COMPLETE ===');

    } catch (error) {
        console.error('Migration error:', error.message);
    } finally {
        await client.end();
    }
}

migrate();

/**
 * Migration: Add scheduled events and attendance support
 * Run with: node migrations/add_feed_engagement.js
 */

const { Client } = require('pg');

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    await client.connect();
    console.log('Connected to database');

    try {
        // Add scheduled_at column to player_statuses if it doesn't exist
        await client.query(`
            ALTER TABLE player_statuses 
            ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP NULL
        `);
        console.log('✓ Added scheduled_at column to player_statuses');

        // Create event_attendees table for I'm IN functionality
        await client.query(`
            CREATE TABLE IF NOT EXISTS event_attendees (
                id SERIAL PRIMARY KEY,
                status_id INTEGER NOT NULL REFERENCES player_statuses(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(status_id, user_id)
            )
        `);
        console.log('✓ Created event_attendees table');

        // Create index for faster lookups
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_event_attendees_status_id ON event_attendees(status_id)
        `);
        console.log('✓ Created index on event_attendees');

        // Ensure user_followed_courts table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_followed_courts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                court_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(user_id, court_id)
            )
        `);
        console.log('✓ Ensured user_followed_courts table exists');

        // Ensure user_followed_players table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS user_followed_players (
                id SERIAL PRIMARY KEY,
                follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                followed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(follower_id, followed_id)
            )
        `);
        console.log('✓ Ensured user_followed_players table exists');

        // Ensure status_likes table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS status_likes (
                id SERIAL PRIMARY KEY,
                status_id INTEGER NOT NULL REFERENCES player_statuses(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(status_id, user_id)
            )
        `);
        console.log('✓ Ensured status_likes table exists');

        // Ensure status_comments table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS status_comments (
                id SERIAL PRIMARY KEY,
                status_id INTEGER NOT NULL REFERENCES player_statuses(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✓ Ensured status_comments table exists');

        // Ensure court_check_ins table exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS court_check_ins (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                court_id TEXT NOT NULL,
                checked_in_at TIMESTAMP DEFAULT NOW(),
                checked_out_at TIMESTAMP
            )
        `);
        console.log('✓ Ensured court_check_ins table exists');

        console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

migrate().catch(console.error);

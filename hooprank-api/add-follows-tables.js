// Migration to add user follows tables
// Run with: node add-follows-tables.js

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('Creating user_followed_courts table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS user_followed_courts (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        court_id TEXT NOT NULL,
        alerts_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, court_id)
      )
    `);
        console.log('✓ user_followed_courts table created');

        console.log('Creating user_followed_players table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS user_followed_players (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        player_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, player_id)
      )
    `);
        console.log('✓ user_followed_players table created');

        // Create indexes for faster lookups
        console.log('Creating indexes...');
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_followed_courts_user ON user_followed_courts(user_id);
      CREATE INDEX IF NOT EXISTS idx_followed_players_user ON user_followed_players(user_id);
    `);
        console.log('✓ Indexes created');

        console.log('Migration complete!');
    } catch (err) {
        console.error('Migration failed:', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

migrate().catch(console.error);

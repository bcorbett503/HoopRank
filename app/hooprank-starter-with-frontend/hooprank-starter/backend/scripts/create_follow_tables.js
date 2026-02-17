// Script to create follow tables in production database
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:YCSWhJfsGHwgErOUfqMDyWDzoKOQbQpy@shuttle.proxy.rlwy.net:48496/railway',
    ssl: false
});

async function createTables() {
    const client = await pool.connect();
    try {
        console.log('Connected to database...');

        // Create user_followed_courts table
        await client.query(`
      CREATE TABLE IF NOT EXISTS user_followed_courts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        court_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, court_id)
      );
    `);
        console.log('Created user_followed_courts table');

        // Create user_followed_players table
        await client.query(`
      CREATE TABLE IF NOT EXISTS user_followed_players (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        followed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(follower_id, followed_id)
      );
    `);
        console.log('Created user_followed_players table');

        // Create indexes
        await client.query(`CREATE INDEX IF NOT EXISTS idx_followed_courts_user ON user_followed_courts(user_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_followed_players_follower ON user_followed_players(follower_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_followed_players_followed ON user_followed_players(followed_id);`);
        console.log('Created indexes');

        console.log('All tables created successfully!');
    } catch (err) {
        console.error('Error creating tables:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

createTables();

// Script to add court alerts table and fcm_token column
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:YCSWhJfsGHwgErOUfqMDyWDzoKOQbQpy@shuttle.proxy.rlwy.net:48496/railway',
    ssl: false
});

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Connected to database...');

        // Add fcm_token column to users
        await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(255);
    `);
        console.log('Added fcm_token column to users');

        // Create user_court_alerts table
        await client.query(`
      CREATE TABLE IF NOT EXISTS user_court_alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        court_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, court_id)
      );
    `);
        console.log('Created user_court_alerts table');

        // Create index
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_court_alerts_court ON user_court_alerts(court_id);
    `);
        console.log('Created index on court_id');

        // Verify
        const result = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'fcm_token';
    `);
        console.log('\n✅ Migration complete!');
        console.log('fcm_token column exists:', result.rows.length > 0);

    } catch (err) {
        console.error('Error during migration:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();

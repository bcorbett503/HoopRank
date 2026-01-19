// Migration to add score columns to matches table for team matches
import 'dotenv/config';
import pg from 'pg';

// Railway may or may not require SSL depending on setup
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

async function migrate() {
    try {
        console.log('Adding score_creator and score_opponent columns to matches table...');

        await pool.query(`
      ALTER TABLE matches 
      ADD COLUMN IF NOT EXISTS score_creator INTEGER,
      ADD COLUMN IF NOT EXISTS score_opponent INTEGER
    `);

        console.log('Migration completed successfully!');

        // Verify columns were added
        const result = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'matches' 
      ORDER BY ordinal_position
    `);
        console.log('Columns in matches table:', result.rows.map(r => r.column_name).join(', '));
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrate();

// Migration script to add video columns to player_statuses table
// Run with: node add_video_columns.js

const { Client } = require('pg');

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Add video columns
        const alterQuery = `
      ALTER TABLE player_statuses 
      ADD COLUMN IF NOT EXISTS video_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS video_thumbnail_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS video_duration_ms INTEGER;
    `;

        await client.query(alterQuery);
        console.log('Successfully added video columns to player_statuses');

        // Verify columns exist
        const checkQuery = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'player_statuses' 
      AND column_name IN ('video_url', 'video_thumbnail_url', 'video_duration_ms');
    `;
        const result = await client.query(checkQuery);
        console.log('Verified columns:', result.rows);

    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();

/**
 * Quick migration script to add access column
 * Usage: DATABASE_URL="postgresql://..." node migrate_add_access.js
 */

const { Client } = require('pg');

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Add access column if it doesn't exist
        await client.query(`
      ALTER TABLE courts ADD COLUMN IF NOT EXISTS access TEXT DEFAULT 'public'
    `);
        console.log('✅ Added access column');

        // Verify
        const result = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'courts' AND column_name = 'access'
    `);
        console.log('Verification:', result.rows);

    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();

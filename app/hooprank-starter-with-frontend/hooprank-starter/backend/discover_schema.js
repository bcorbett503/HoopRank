/**
 * Discover production database schema
 */

const { Client } = require('pg');

async function discoverSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();
        console.log('Connected to database\n');

        // Get courts table schema
        const result = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'courts'
      ORDER BY ordinal_position
    `);

        console.log('=== COURTS TABLE SCHEMA ===');
        for (const row of result.rows) {
            console.log(`${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default || 'none'})`);
        }

        // Get sample data
        console.log('\n=== SAMPLE DATA ===');
        const sample = await client.query('SELECT * FROM courts LIMIT 3');
        console.log(JSON.stringify(sample.rows, null, 2));

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

discoverSchema();

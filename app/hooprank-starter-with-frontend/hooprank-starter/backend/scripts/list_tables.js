// Script to check what tables exist in the database
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres:YCSWhJfsGHwgErOUfqMDyWDzoKOQbQpy@shuttle.proxy.rlwy.net:48496/railway',
    ssl: false
});

async function listTables() {
    const client = await pool.connect();
    try {
        console.log('Connected to database...');

        // List all tables
        const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

        console.log('Tables in database:');
        result.rows.forEach(row => console.log('  -', row.table_name));

        if (result.rows.length === 0) {
            console.log('  (No tables found)');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

listTables();

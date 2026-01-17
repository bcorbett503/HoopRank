import pg from 'pg';
import fs from 'fs';
const { Client } = pg;

const DATABASE_URL = 'postgres://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway';

async function runInit() {
    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log('Connected!');

    // Read and run 0001_init.sql - strip BOM if present
    let sql = fs.readFileSync('c:/Users/brett/OneDrive/Desktop/WebWorking/HoopRank/backend/sql/migrations/0001_init.sql', 'utf8');

    // Strip BOM if present
    if (sql.charCodeAt(0) === 0xFEFF) {
        sql = sql.slice(1);
        console.log('Stripped BOM from SQL file');
    }

    console.log('Running 0001_init.sql...');
    console.log('First 50 chars:', sql.substring(0, 50));

    try {
        await client.query(sql);
        console.log('SUCCESS!');
    } catch (err) {
        console.error('Error:', err.message);
    }

    // Check tables
    const r = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
    console.log('\nTables in database:');
    r.rows.forEach(t => console.log(`  - ${t.tablename}`));
    console.log(`\nTotal: ${r.rows.length} tables`);

    await client.end();
}

runInit();

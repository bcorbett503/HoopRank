import pg from 'pg';
const client = new pg.Client({
    connectionString: 'postgresql://postgres:YCSWhJfsGHwgErOUfqMDyWDzoKOQbQpy@shuttle.proxy.rlwy.net:48496/railway',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    console.log('Connected to Railway database');

    try {
        // Check what tables exist
        const result = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
        console.log('Tables in database:');
        result.rows.forEach(r => console.log('  -', r.tablename));
        console.log(`\nTotal: ${result.rows.length} tables`);
    } catch (e) {
        console.log('Error:', e.message);
    } finally {
        await client.end();
    }
}

run();

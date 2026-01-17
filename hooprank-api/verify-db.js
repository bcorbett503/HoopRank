import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = 'postgres://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway';

async function verify() {
    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();

    const r = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
    console.log('Tables in database:');
    r.rows.forEach(t => console.log(`  - ${t.tablename}`));
    console.log(`\nTotal: ${r.rows.length} tables`);

    await client.end();
}

verify();

import pg from 'pg';
const client = new pg.Client({
    connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    console.log('Connected to Railway database');

    try {
        await client.query('ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_url TEXT');
        console.log('✓ Migration success! logo_url column added to teams table');
    } catch (e) {
        console.log('Error:', e.message);
    } finally {
        await client.end();
    }
}

run();

import pg from 'pg';
const client = new pg.Client({
    connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    console.log('Connected to Railway database');

    try {
        // Drop old constraint
        await client.query('ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check');
        console.log('✓ Dropped old constraint');

        // Add new constraint with all statuses
        await client.query(`
      ALTER TABLE matches ADD CONSTRAINT matches_status_check 
      CHECK (status IN (
        'waiting', 'live', 'ended',
        'challenge_pending', 'accepted', 'declined',
        'pending_confirmation', 'completed', 'disputed', 'cancelled'
      ))
    `);
        console.log('✓ Added new status constraint with team challenge statuses');
    } catch (e) {
        console.log('Error:', e.message);
    } finally {
        await client.end();
    }
}

run();

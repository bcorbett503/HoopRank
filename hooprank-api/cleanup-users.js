import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway';
const pool = new Pool({ connectionString: DATABASE_URL });

async function cleanupUsers() {
    try {
        console.log('Connecting to database...');

        // Delete dev/test users (those with 00000000 UUIDs)
        const deleteResult = await pool.query(
            `DELETE FROM users WHERE id LIKE '00000000-0000-0000-0000-%'`
        );
        console.log('Deleted', deleteResult.rowCount, 'dev/test users');

        // Show remaining users
        const usersResult = await pool.query(
            'SELECT id, name, username, email, hoop_rank FROM users ORDER BY name'
        );

        console.log('\nRemaining users:');
        usersResult.rows.forEach(row => {
            console.log(`  - ${row.name} (${row.email}) - Rating: ${row.hoop_rank}`);
        });
        console.log('\nTotal:', usersResult.rows.length, 'users');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

cleanupUsers();

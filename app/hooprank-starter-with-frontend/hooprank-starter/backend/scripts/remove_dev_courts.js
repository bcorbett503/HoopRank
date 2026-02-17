// remove_dev_courts.js - Remove dev courts from production database
require('dotenv').config();
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL not set. Please set it in .env or environment.');
    process.exit(1);
}

async function main() {
    console.log('Connecting to production database...');

    const pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // First, list all courts that look like dev courts
        console.log('\n=== Current Dev Courts ===');
        const listResult = await pool.query(`
      SELECT id, name, city 
      FROM courts 
      WHERE name ILIKE '%dev%' 
         OR name ILIKE '%test%'
         OR id LIKE '11111111%'
         OR id LIKE '00000000%'
    `);

        if (listResult.rows.length === 0) {
            console.log('No dev courts found!');
            return;
        }

        console.log('Found dev courts:');
        listResult.rows.forEach(c => console.log(`  - ${c.id}: ${c.name} (${c.city || 'no city'})`));

        // Delete the dev courts
        console.log('\n=== Deleting Dev Courts ===');

        // First delete any related records (foreign key constraints)
        console.log('Cleaning up related records...');

        // Delete court check-ins
        await pool.query(`DELETE FROM check_ins WHERE court_id IN (SELECT id FROM courts WHERE name ILIKE '%dev%' OR id LIKE '11111111%')`);
        console.log('  - Deleted related check-ins');

        // Delete court follows
        await pool.query(`DELETE FROM user_followed_courts WHERE court_id IN (SELECT id FROM courts WHERE name ILIKE '%dev%' OR id LIKE '11111111%')`);
        console.log('  - Deleted related follows');

        // Delete court alerts
        await pool.query(`DELETE FROM user_court_alerts WHERE court_id IN (SELECT id FROM courts WHERE name ILIKE '%dev%' OR id LIKE '11111111%')`);
        console.log('  - Deleted related alerts');

        // Now delete the courts themselves
        const deleteResult = await pool.query(`
      DELETE FROM courts 
      WHERE name ILIKE '%dev%' 
         OR id LIKE '11111111%'
      RETURNING id, name
    `);

        console.log('\nDeleted courts:');
        deleteResult.rows.forEach(c => console.log(`  - ${c.id}: ${c.name}`));
        console.log(`\nTotal deleted: ${deleteResult.rowCount} courts`);

        // Verify remaining courts
        console.log('\n=== Remaining Courts ===');
        const remaining = await pool.query('SELECT id, name FROM courts ORDER BY name');
        remaining.rows.forEach(c => console.log(`  - ${c.id}: ${c.name}`));
        console.log(`Total: ${remaining.rowCount} courts`);

    } catch (err) {
        console.error('Error:', err.message);
        if (err.message.includes('does not exist')) {
            console.log('Some tables may not exist, but that\'s okay.');
        }
    } finally {
        await pool.end();
        console.log('\nDone!');
    }
}

main();

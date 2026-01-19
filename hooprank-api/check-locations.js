// Debug script to check user locations in database
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkLocations() {
    console.log('Checking user locations...\n');

    const users = await pool.query(`
    SELECT id, name, zip, city, lat, lng 
    FROM users 
    ORDER BY name
    LIMIT 20
  `);

    console.log('Users in database:');
    console.log('='.repeat(80));

    for (const user of users.rows) {
        const hasLocation = user.lat !== null && user.lng !== null;
        console.log(`${user.name}:`);
        console.log(`  ZIP: ${user.zip || 'not set'}`);
        console.log(`  City: ${user.city || 'not set'}`);
        console.log(`  Location: ${hasLocation ? `${user.lat}, ${user.lng}` : 'NOT SET'}`);
        console.log('');
    }

    // Count users missing location
    const missing = await pool.query(`
    SELECT COUNT(*) as count FROM users 
    WHERE zip IS NOT NULL AND zip != '' 
    AND (lat IS NULL OR lng IS NULL)
  `);
    console.log(`\nUsers with ZIP but missing lat/lng: ${missing.rows[0].count}`);
}

checkLocations()
    .then(() => pool.end())
    .catch(e => { console.error(e); pool.end(); });

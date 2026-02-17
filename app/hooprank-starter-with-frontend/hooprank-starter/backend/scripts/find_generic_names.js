/**
 * Find generic court names that need better naming
 */
const { Client } = require('pg');

async function findGenericNames() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();

        // Find courts with generic names in NY area
        const result = await client.query(`
      SELECT id, name, city, 
             ST_Y(geog::geometry) as lat,
             ST_X(geog::geometry) as lng
      FROM courts 
      WHERE city LIKE '%NY'
        AND (
          name ILIKE '%basketball court%' 
          OR name ILIKE '%outdoor court%' 
          OR name ILIKE '%park court%'
          OR name ILIKE '%courts'
          OR LENGTH(name) < 12
        )
      ORDER BY name
    `);

        console.log('=== GENERIC COURT NAMES IN NY ===\n');
        console.log(`Found: ${result.rows.length} courts with potentially generic names\n`);

        result.rows.forEach((row, i) => {
            console.log(`${i + 1}. "${row.name}" - ${row.city}`);
            console.log(`   Lat/Lng: ${row.lat}, ${row.lng}`);
            console.log(`   ID: ${row.id}`);
            console.log('');
        });

        // Also show all NY courts for review
        console.log('\n=== ALL NY COURTS ===\n');
        const all = await client.query(`
      SELECT name, city, indoor, access
      FROM courts 
      WHERE city LIKE '%NY'
      ORDER BY city, name
    `);

        all.rows.forEach((row, i) => {
            const type = row.indoor ? '🏠 Indoor' : '🌳 Outdoor';
            const access = row.access === 'public' ? '🔓' : row.access === 'members' ? '🔑' : '💵';
            console.log(`${i + 1}. ${row.name} (${row.city}) ${type} ${access}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

findGenericNames();

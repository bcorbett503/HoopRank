/**
 * Get detailed court data for a specific city/region
 */
const { Client } = require('pg');

async function getCityCourts(cityPattern) {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();

        // Get all courts matching the city pattern
        const result = await client.query(`
      SELECT 
        id,
        name,
        city,
        indoor,
        access,
        source,
        ST_Y(geog::geometry) as lat,
        ST_X(geog::geometry) as lng
      FROM courts 
      WHERE city LIKE $1
      ORDER BY city, name
    `, [cityPattern]);

        console.log(`=== COURTS MATCHING "${cityPattern}" ===\n`);
        console.log(`Found: ${result.rows.length} courts\n`);

        result.rows.forEach((row, i) => {
            console.log(`${i + 1}. ${row.name}`);
            console.log(`   City: ${row.city}`);
            console.log(`   Indoor: ${row.indoor}`);
            console.log(`   Access: ${row.access}`);
            console.log(`   Lat/Lng: ${row.lat}, ${row.lng}`);
            console.log(`   Source: ${row.source}`);
            console.log(`   ID: ${row.id}`);
            console.log('');
        });

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

// Get city pattern from command line args
const cityPattern = process.argv[2] || '%New York%';
getCityCourts(cityPattern);

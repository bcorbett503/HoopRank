/**
 * Get all cities in database with court counts
 */
const { Client } = require('pg');

async function getCities() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();

        // Get cities with court counts, ordered by count descending
        const result = await client.query(`
      SELECT 
        city, 
        COUNT(*) as court_count,
        COUNT(CASE WHEN access = 'public' THEN 1 END) as public_count,
        COUNT(CASE WHEN access = 'members' THEN 1 END) as member_count,
        COUNT(CASE WHEN access = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN indoor = true THEN 1 END) as indoor_count,
        COUNT(CASE WHEN indoor = false THEN 1 END) as outdoor_count
      FROM courts 
      WHERE city IS NOT NULL AND city != ''
      GROUP BY city 
      ORDER BY COUNT(*) DESC, city
    `);

        console.log('=== CITIES IN DATABASE ===\n');
        console.log(`Total unique cities: ${result.rows.length}\n`);

        console.log('City | Total | Public | Member | Paid | Indoor | Outdoor');
        console.log('-----|-------|--------|--------|------|--------|--------');

        result.rows.forEach(row => {
            console.log(`${row.city} | ${row.court_count} | ${row.public_count} | ${row.member_count} | ${row.paid_count} | ${row.indoor_count} | ${row.outdoor_count}`);
        });

        // Summary stats
        const totalCourts = result.rows.reduce((sum, r) => sum + parseInt(r.court_count), 0);
        console.log(`\n=== SUMMARY ===`);
        console.log(`Total courts: ${totalCourts}`);
        console.log(`Total cities: ${result.rows.length}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

getCities();

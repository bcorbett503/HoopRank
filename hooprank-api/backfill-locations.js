// Migration script to backfill user lat/lng from ZIP codes
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

async function backfillLocations() {
    console.log('Backfilling user locations from ZIP codes...');

    // Get all users with zip but no lat/lng
    const users = await pool.query(`
    SELECT id, zip FROM users 
    WHERE zip IS NOT NULL AND zip != '' 
    AND (lat IS NULL OR lng IS NULL)
  `);

    console.log(`Found ${users.rowCount} users to update`);

    let updated = 0;
    for (const user of users.rows) {
        const zip = user.zip.substring(0, 5);

        try {
            // Use Zippopotam API to get coordinates
            const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
            if (response.ok) {
                const data = await response.json();
                const place = data.places?.[0];
                if (place) {
                    const lat = parseFloat(place.latitude);
                    const lng = parseFloat(place.longitude);
                    const city = place['place name'];
                    const state = place['state abbreviation'];

                    await pool.query(`
            UPDATE users 
            SET lat = $2, lng = $3, city = $4
            WHERE id = $1
          `, [user.id, lat, lng, `${city}, ${state}`]);

                    updated++;
                    console.log(`Updated ${user.id}: ${zip} -> ${lat}, ${lng} (${city}, ${state})`);
                }
            }
        } catch (e) {
            console.error(`Failed to lookup ${zip} for user ${user.id}:`, e);
        }

        // Throttle API calls
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`Backfill complete! Updated ${updated} users.`);
}

backfillLocations()
    .then(() => pool.end())
    .catch(e => { console.error(e); pool.end(); });

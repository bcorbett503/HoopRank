/**
 * NYC Venues Import - Comprehensive
 */
const { Client } = require('pg');
const crypto = require('crypto');

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

const NYC_VENUES = [
    // BROOKLYN - Premium Courts
    { name: "Brooklyn Stuy Dome", city: "Brooklyn, NY", lat: 40.6862, lng: -73.9385, indoor: true, access: "paid" },
    { name: "Major Owens Community Center", city: "Brooklyn, NY", lat: 40.6678, lng: -73.9437, indoor: true, access: "public" },
    { name: "The OG Post BK", city: "Brooklyn, NY", lat: 40.7128, lng: -73.9575, indoor: true, access: "paid" },
    { name: "The New Post BK", city: "Brooklyn, NY", lat: 40.6944, lng: -73.9213, indoor: true, access: "paid" },
    { name: "Hoops Klub Brooklyn", city: "Brooklyn, NY", lat: 40.6892, lng: -73.9442, indoor: true, access: "members" },
    { name: "MatchPoint NYC Williamsburg", city: "Brooklyn, NY", lat: 40.7081, lng: -73.9571, indoor: true, access: "members" },
    { name: "MatchPoint NYC Park Slope", city: "Brooklyn, NY", lat: 40.6710, lng: -73.9777, indoor: true, access: "members" },

    // MANHATTAN - Major Facilities
    { name: "Basketball City NYC", city: "New York, NY", lat: 40.7411, lng: -74.0087, indoor: true, access: "paid" },
    { name: "One Manhattan Square Basketball", city: "New York, NY", lat: 40.7111, lng: -73.9858, indoor: true, access: "members" },
    { name: "Manny Cantor Center", city: "New York, NY", lat: 40.7181, lng: -73.9866, indoor: true, access: "members" },

    // EQUINOX NYC Locations
    { name: "Equinox Bryant Park", city: "New York, NY", lat: 40.7536, lng: -73.9832, indoor: true, access: "members" },
    { name: "Equinox Brookfield Place", city: "New York, NY", lat: 40.7131, lng: -74.0147, indoor: true, access: "members" },
    { name: "Equinox Upper East Side", city: "New York, NY", lat: 40.7754, lng: -73.9562, indoor: true, access: "members" },
    { name: "Equinox SoHo", city: "New York, NY", lat: 40.7254, lng: -73.9984, indoor: true, access: "members" },
    { name: "Equinox Flatiron", city: "New York, NY", lat: 40.7410, lng: -73.9897, indoor: true, access: "members" },

    // YMCA NYC Locations
    { name: "Vanderbilt YMCA", city: "New York, NY", lat: 40.7513, lng: -73.9750, indoor: true, access: "members" },
    { name: "West Side YMCA", city: "New York, NY", lat: 40.7876, lng: -73.9765, indoor: true, access: "members" },
    { name: "Harlem YMCA", city: "New York, NY", lat: 40.8103, lng: -73.9453, indoor: true, access: "members" },
    { name: "McBurney YMCA", city: "New York, NY", lat: 40.7407, lng: -73.9942, indoor: true, access: "members" },
    { name: "Bedford-Stuyvesant YMCA", city: "Brooklyn, NY", lat: 40.6838, lng: -73.9494, indoor: true, access: "members" },

    // NYC Parks Recreation Centers
    { name: "Hamilton Fish Recreation Center", city: "New York, NY", lat: 40.7221, lng: -73.9778, indoor: true, access: "public" },
    { name: "Carmine Street Recreation Center", city: "New York, NY", lat: 40.7297, lng: -74.0025, indoor: true, access: "public" },
    { name: "Jackie Robinson Recreation Center", city: "New York, NY", lat: 40.8143, lng: -73.9400, indoor: true, access: "public" },
    { name: "Gertrude Ederle Recreation Center", city: "New York, NY", lat: 40.7386, lng: -74.0047, indoor: true, access: "public" },
    { name: "Hansborough Recreation Center", city: "New York, NY", lat: 40.8026, lng: -73.9441, indoor: true, access: "public" },

    // BRONX
    { name: "Bronx YMCA", city: "Bronx, NY", lat: 40.8449, lng: -73.9012, indoor: true, access: "members" },
    { name: "St. Mary's Recreation Center", city: "Bronx, NY", lat: 40.8123, lng: -73.9196, indoor: true, access: "public" },

    // QUEENS
    { name: "Flushing YMCA", city: "Queens, NY", lat: 40.7631, lng: -73.8249, indoor: true, access: "members" },
    { name: "Long Island City YMCA", city: "Queens, NY", lat: 40.7509, lng: -73.9406, indoor: true, access: "members" },
    { name: "Lost Battalion Hall Recreation Center", city: "Queens, NY", lat: 40.7166, lng: -73.8251, indoor: true, access: "public" },

    // STATEN ISLAND
    { name: "South Shore YMCA", city: "Staten Island, NY", lat: 40.5455, lng: -74.1528, indoor: true, access: "members" },
    { name: "Broadway YMCA Staten Island", city: "Staten Island, NY", lat: 40.6249, lng: -74.1148, indoor: true, access: "members" },

    // FAMOUS OUTDOOR COURTS
    { name: "The Cage (West 4th Street)", city: "New York, NY", lat: 40.7323, lng: -73.9999, indoor: false, access: "public" },
    { name: "Dyckman Park", city: "New York, NY", lat: 40.8658, lng: -73.9233, indoor: false, access: "public" },
    { name: "Gersh Park", city: "Brooklyn, NY", lat: 40.7115, lng: -73.9527, indoor: false, access: "public" },
    { name: "Herbert Von King Park", city: "Brooklyn, NY", lat: 40.6889, lng: -73.9434, indoor: false, access: "public" },
    { name: "Tompkins Square Park", city: "New York, NY", lat: 40.7267, lng: -73.9816, indoor: false, access: "public" },
];

async function importNYC() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== NYC VENUES IMPORT ===\n');

        let added = 0, skipped = 0;

        for (const venue of NYC_VENUES) {
            const id = generateUUID(venue.name + venue.city);

            try {
                const result = await client.query(`
          INSERT INTO courts (id, name, city, indoor, access, source, geog)
          VALUES ($1, $2, $3, $4, $5, 'curated', ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography)
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        `, [id, venue.name, venue.city, venue.indoor, venue.access, venue.lng, venue.lat]);

                if (result.rowCount > 0) {
                    console.log(`✅ ${venue.name} (${venue.city}) - ${venue.access}`);
                    added++;
                } else {
                    console.log(`⏭️  ${venue.name} - already exists`);
                    skipped++;
                }
            } catch (err) {
                console.error(`❌ ${venue.name}: ${err.message}`);
            }
        }

        console.log(`\n=== NYC RESULTS ===`);
        console.log(`✅ Added: ${added}`);
        console.log(`⏭️  Skipped: ${skipped}`);

        // Count NYC courts
        const nycCount = await client.query(`
      SELECT COUNT(*) as count FROM courts 
      WHERE city ILIKE '%New York%' OR city ILIKE '%Brooklyn%' 
      OR city ILIKE '%Queens%' OR city ILIKE '%Bronx%' OR city ILIKE '%Staten Island%'
    `);
        console.log(`📍 Total NYC area courts: ${nycCount.rows[0].count}`);

        // Total
        const total = await client.query('SELECT COUNT(*) as count FROM courts');
        console.log(`📊 Total courts in database: ${total.rows[0].count}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

importNYC();

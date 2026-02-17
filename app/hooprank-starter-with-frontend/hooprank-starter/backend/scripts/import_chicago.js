/**
 * Chicago Venues Import - Comprehensive
 */
const { Client } = require('pg');
const crypto = require('crypto');

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

const CHICAGO_VENUES = [
    // PREMIUM FACILITIES
    { name: "Lakeshore Sport & Fitness Illinois Center", city: "Chicago, IL", lat: 41.8870, lng: -87.6188, indoor: true, access: "members" },
    { name: "Lakeshore Sport & Fitness Lincoln Park", city: "Chicago, IL", lat: 41.9257, lng: -87.6363, indoor: true, access: "members" },
    { name: "Midtown Athletic Club Chicago", city: "Chicago, IL", lat: 41.9192, lng: -87.6714, indoor: true, access: "members" },
    { name: "Life Time River North", city: "Chicago, IL", lat: 41.8929, lng: -87.6308, indoor: true, access: "members" },
    { name: "Supreme Courts Aurora", city: "Aurora, IL", lat: 41.7842, lng: -88.2901, indoor: true, access: "paid" },
    { name: "Swish House Chicago", city: "Chicago, IL", lat: 41.8819, lng: -87.6278, indoor: true, access: "paid" },

    // XSport Fitness
    { name: "XSport Fitness Brickyard", city: "Chicago, IL", lat: 41.9282, lng: -87.7667, indoor: true, access: "members" },
    { name: "XSport Fitness Norridge", city: "Norridge, IL", lat: 41.9631, lng: -87.8217, indoor: true, access: "members" },
    { name: "XSport Fitness Lincoln Park", city: "Chicago, IL", lat: 41.9215, lng: -87.6486, indoor: true, access: "members" },

    // FFC (Fitness Formula Clubs)
    { name: "FFC East Lakeview", city: "Chicago, IL", lat: 41.9456, lng: -87.6437, indoor: true, access: "members" },
    { name: "FFC Elmhurst", city: "Elmhurst, IL", lat: 41.8995, lng: -87.9403, indoor: true, access: "members" },
    { name: "FFC Oak Park", city: "Oak Park, IL", lat: 41.8850, lng: -87.7845, indoor: true, access: "members" },
    { name: "FFC Park Ridge", city: "Park Ridge, IL", lat: 42.0111, lng: -87.8406, indoor: true, access: "members" },

    // Ray and Joan Kroc Center
    { name: "Ray and Joan Kroc Corps Community Center", city: "Chicago, IL", lat: 41.6924, lng: -87.6226, indoor: true, access: "members" },

    // East Bank Club
    { name: "East Bank Club", city: "Chicago, IL", lat: 41.8894, lng: -87.6407, indoor: true, access: "members" },

    // University of Chicago
    { name: "UChicago Ratner Athletics Center", city: "Chicago, IL", lat: 41.7922, lng: -87.6006, indoor: true, access: "members" },
    { name: "UChicago Henry Crown Field House", city: "Chicago, IL", lat: 41.7910, lng: -87.5987, indoor: true, access: "members" },

    // Chicago Park District
    { name: "Altgeld Park Gymnasium", city: "Chicago, IL", lat: 41.8426, lng: -87.7130, indoor: true, access: "public" },
    { name: "Broadway Armory Park", city: "Chicago, IL", lat: 41.9857, lng: -87.6609, indoor: true, access: "public" },
    { name: "Welles Park Gymnasium", city: "Chicago, IL", lat: 41.9631, lng: -87.6888, indoor: true, access: "public" },
    { name: "Foster Park Gymnasium", city: "Chicago, IL", lat: 41.7480, lng: -87.6859, indoor: true, access: "public" },
    { name: "Portage Park Gymnasium", city: "Chicago, IL", lat: 41.9590, lng: -87.7653, indoor: true, access: "public" },
    { name: "McFetridge Sports Center", city: "Chicago, IL", lat: 41.9425, lng: -87.6358, indoor: true, access: "public" },
    { name: "Gill Park Gymnasium", city: "Chicago, IL", lat: 41.9397, lng: -87.6628, indoor: true, access: "public" },

    // YMCA
    { name: "YMCA Lakeview", city: "Chicago, IL", lat: 41.9406, lng: -87.6518, indoor: true, access: "members" },
    { name: "YMCA South Side", city: "Chicago, IL", lat: 41.7912, lng: -87.6006, indoor: true, access: "members" },
    { name: "McGaw YMCA Evanston", city: "Evanston, IL", lat: 42.0451, lng: -87.6877, indoor: true, access: "members" },

    // Famous Outdoor Courts
    { name: "Foster Beach Courts", city: "Chicago, IL", lat: 41.9768, lng: -87.6499, indoor: false, access: "public" },
    { name: "Washington Park Courts", city: "Chicago, IL", lat: 41.7943, lng: -87.6177, indoor: false, access: "public" },
    { name: "Humboldt Park Courts", city: "Chicago, IL", lat: 41.9024, lng: -87.7008, indoor: false, access: "public" },
    { name: "Oz Park Courts", city: "Chicago, IL", lat: 41.9201, lng: -87.6463, indoor: false, access: "public" },
];

async function importChicago() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== CHICAGO VENUES IMPORT ===\n');

        let added = 0, skipped = 0;

        for (const venue of CHICAGO_VENUES) {
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

        console.log(`\n=== CHICAGO RESULTS ===`);
        console.log(`✅ Added: ${added}`);
        console.log(`⏭️  Skipped: ${skipped}`);

        const total = await client.query('SELECT COUNT(*) as count FROM courts');
        console.log(`📊 Total courts in database: ${total.rows[0].count}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

importChicago();

/**
 * Los Angeles Venues Import - Comprehensive
 */
const { Client } = require('pg');
const crypto = require('crypto');

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

const LA_VENUES = [
    // PREMIUM FACILITIES
    { name: "Los Angeles Athletic Club", city: "Los Angeles, CA", lat: 34.0480, lng: -118.2552, indoor: true, access: "members" },
    { name: "Crosscourt DTLA", city: "Los Angeles, CA", lat: 34.0407, lng: -118.2468, indoor: true, access: "paid" },
    { name: "Academy USA LA", city: "Los Angeles, CA", lat: 34.0219, lng: -118.3965, indoor: true, access: "paid" },
    { name: "Sports Academy Thousand Oaks", city: "Thousand Oaks, CA", lat: 34.1706, lng: -118.8376, indoor: true, access: "paid" },

    // EQUINOX Locations
    { name: "Equinox Century City", city: "Los Angeles, CA", lat: 34.0577, lng: -118.4177, indoor: true, access: "members" },
    { name: "Equinox Beverly Hills", city: "Beverly Hills, CA", lat: 34.0714, lng: -118.4001, indoor: true, access: "members" },
    { name: "Equinox Westwood", city: "Los Angeles, CA", lat: 34.0628, lng: -118.4442, indoor: true, access: "members" },
    { name: "Equinox Hollywood", city: "Los Angeles, CA", lat: 34.0988, lng: -118.3453, indoor: true, access: "members" },
    { name: "Equinox Pasadena", city: "Pasadena, CA", lat: 34.1465, lng: -118.1432, indoor: true, access: "members" },

    // 24 Hour Fitness (with courts)
    { name: "24 Hour Fitness Wilshire", city: "Los Angeles, CA", lat: 34.0625, lng: -118.3082, indoor: true, access: "members" },
    { name: "24 Hour Fitness West LA", city: "Los Angeles, CA", lat: 34.0387, lng: -118.4391, indoor: true, access: "members" },
    { name: "24 Hour Fitness Torrance", city: "Torrance, CA", lat: 33.8368, lng: -118.3439, indoor: true, access: "members" },

    // YMCA Locations
    { name: "Hollywood Wilshire YMCA", city: "Los Angeles, CA", lat: 34.0973, lng: -118.3376, indoor: true, access: "members" },
    { name: "YMCA of Metropolitan LA", city: "Los Angeles, CA", lat: 34.0520, lng: -118.2517, indoor: true, access: "members" },
    { name: "Pasadena YMCA", city: "Pasadena, CA", lat: 34.1388, lng: -118.1395, indoor: true, access: "members" },
    { name: "Crenshaw YMCA", city: "Los Angeles, CA", lat: 33.9942, lng: -118.3305, indoor: true, access: "members" },
    { name: "Weingart East LA YMCA", city: "Los Angeles, CA", lat: 34.0233, lng: -118.1726, indoor: true, access: "members" },

    // LA Parks & Recreation Centers
    { name: "Poinsettia Recreation Center", city: "Los Angeles, CA", lat: 34.0837, lng: -118.3581, indoor: true, access: "public" },
    { name: "Van Nuys Sherman Oaks Recreation Center", city: "Sherman Oaks, CA", lat: 34.1488, lng: -118.4473, indoor: true, access: "public" },
    { name: "Westchester Recreation Center", city: "Los Angeles, CA", lat: 33.9567, lng: -118.4106, indoor: true, access: "public" },
    { name: "Mar Vista Recreation Center", city: "Los Angeles, CA", lat: 34.0028, lng: -118.4265, indoor: true, access: "public" },
    { name: "Eagle Rock Recreation Center", city: "Los Angeles, CA", lat: 34.1292, lng: -118.2151, indoor: true, access: "public" },
    { name: "Sun Valley Recreation Center", city: "Sun Valley, CA", lat: 34.2235, lng: -118.3907, indoor: true, access: "public" },
    { name: "Pan Pacific Recreation Center", city: "Los Angeles, CA", lat: 34.0837, lng: -118.3542, indoor: true, access: "public" },
    { name: "Cheviot Hills Recreation Center", city: "Los Angeles, CA", lat: 34.0398, lng: -118.4119, indoor: true, access: "public" },

    // University Courts
    { name: "USC Lyon Center", city: "Los Angeles, CA", lat: 34.0241, lng: -118.2868, indoor: true, access: "members" },
    { name: "LMU Burns Recreation Center", city: "Los Angeles, CA", lat: 33.9693, lng: -118.4160, indoor: true, access: "members" },

    // McCambridge (Burbank)
    { name: "McCambridge Park Recreation Center", city: "Burbank, CA", lat: 34.1800, lng: -118.3238, indoor: true, access: "public" },

    // Famous Outdoor Courts
    { name: "Pan Pacific Park Courts", city: "Los Angeles, CA", lat: 34.0836, lng: -118.3545, indoor: false, access: "public" },
    { name: "Westwood Recreation Center Courts", city: "Los Angeles, CA", lat: 34.0578, lng: -118.4465, indoor: false, access: "public" },
    { name: "Kenneth Hahn State Recreation Area", city: "Los Angeles, CA", lat: 34.0057, lng: -118.3712, indoor: false, access: "public" },
    { name: "Echo Park Courts", city: "Los Angeles, CA", lat: 34.0754, lng: -118.2606, indoor: false, access: "public" },
    { name: "Lincoln Park Courts LA", city: "Los Angeles, CA", lat: 34.0681, lng: -118.1934, indoor: false, access: "public" },
    { name: "Silver Lake Recreation Center Courts", city: "Los Angeles, CA", lat: 34.0875, lng: -118.2703, indoor: false, access: "public" },
];

async function importLA() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== LA VENUES IMPORT ===\n');

        let added = 0, skipped = 0;

        for (const venue of LA_VENUES) {
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

        console.log(`\n=== LA RESULTS ===`);
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

importLA();

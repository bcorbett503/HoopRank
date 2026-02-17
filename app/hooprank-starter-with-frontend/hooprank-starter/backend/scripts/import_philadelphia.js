/**
 * Philadelphia Venues Import - Comprehensive
 */
const { Client } = require('pg');
const crypto = require('crypto');

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

const PHILADELPHIA_VENUES = [
    // PREMIUM FACILITIES
    { name: "AFC Fitness Sports Complex", city: "Bala Cynwyd, PA", lat: 40.0104, lng: -75.2176, indoor: true, access: "members" },
    { name: "Phield House Indoor Sports", city: "Philadelphia, PA", lat: 39.9809, lng: -75.1552, indoor: true, access: "paid" },
    { name: "Elite Sports Factory", city: "Philadelphia, PA", lat: 39.9526, lng: -75.1652, indoor: true, access: "paid" },
    { name: "Courts Philly", city: "Philadelphia, PA", lat: 39.9742, lng: -75.1287, indoor: true, access: "paid" },
    { name: "Fusion Gyms Philadelphia", city: "Philadelphia, PA", lat: 39.9891, lng: -75.0898, indoor: true, access: "members" },
    { name: "Fusion Gyms Bucks County", city: "Bensalem, PA", lat: 40.1046, lng: -74.9518, indoor: true, access: "members" },

    // University Recreation
    { name: "Drexel Recreation Center", city: "Philadelphia, PA", lat: 39.9541, lng: -75.1869, indoor: true, access: "members" },
    { name: "Temple Pearson-McGonigle Hall", city: "Philadelphia, PA", lat: 39.9784, lng: -75.1533, indoor: true, access: "members" },
    { name: "Penn Pottruck Center", city: "Philadelphia, PA", lat: 39.9511, lng: -75.1937, indoor: true, access: "members" },

    // Kroc Center
    { name: "Philadelphia Salvation Army Kroc Center", city: "Philadelphia, PA", lat: 39.9898, lng: -75.0795, indoor: true, access: "members" },

    // Recreation Centers
    { name: "Cobbs Creek Recreation Center", city: "Philadelphia, PA", lat: 39.9534, lng: -75.2394, indoor: true, access: "public" },
    { name: "Lloyd Hall Recreation Center", city: "Philadelphia, PA", lat: 39.9669, lng: -75.1869, indoor: true, access: "public" },
    { name: "Murphy Recreation Center", city: "Philadelphia, PA", lat: 39.9871, lng: -75.1416, indoor: true, access: "public" },
    { name: "Rivera Recreation Center", city: "Philadelphia, PA", lat: 40.0024, lng: -75.1413, indoor: true, access: "public" },
    { name: "Northern Liberties Rec Center", city: "Philadelphia, PA", lat: 39.9656, lng: -75.1381, indoor: true, access: "public" },
    { name: "Crane Community Center", city: "Philadelphia, PA", lat: 39.9589, lng: -75.1543, indoor: true, access: "public" },
    { name: "Marian Anderson Recreation Center", city: "Philadelphia, PA", lat: 39.9542, lng: -75.1722, indoor: true, access: "public" },

    // YMCA & Community
    { name: "Christian Street YMCA", city: "Philadelphia, PA", lat: 39.9396, lng: -75.1551, indoor: true, access: "members" },
    { name: "Roxborough YMCA", city: "Philadelphia, PA", lat: 40.0377, lng: -75.2268, indoor: true, access: "members" },

    // Athletic Clubs
    { name: "Northeast Racquet Club & Fitness", city: "Philadelphia, PA", lat: 40.0630, lng: -75.0524, indoor: true, access: "members" },
    { name: "The Sporting Club", city: "Philadelphia, PA", lat: 39.9506, lng: -75.1702, indoor: true, access: "members" },
    { name: "KleinLife", city: "Philadelphia, PA", lat: 40.0818, lng: -75.1218, indoor: true, access: "members" },

    // LA Fitness
    { name: "LA Fitness Center City Philadelphia", city: "Philadelphia, PA", lat: 39.9526, lng: -75.1613, indoor: true, access: "members" },
    { name: "LA Fitness King of Prussia", city: "King of Prussia, PA", lat: 40.0878, lng: -75.3837, indoor: true, access: "members" },

    // Famous Outdoor Courts
    { name: "South Philadelphia Playground Courts", city: "Philadelphia, PA", lat: 39.9227, lng: -75.1648, indoor: false, access: "public" },
    { name: "Pop Kern Playground", city: "Philadelphia, PA", lat: 39.9634, lng: -75.1447, indoor: false, access: "public" },
    { name: "Ralph Brooks Park Courts", city: "Philadelphia, PA", lat: 40.0185, lng: -75.0865, indoor: false, access: "public" },
    { name: "Smith Playground Courts", city: "Philadelphia, PA", lat: 39.9353, lng: -75.1714, indoor: false, access: "public" },
];

async function importPhiladelphia() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== PHILADELPHIA VENUES IMPORT ===\n');

        let added = 0, skipped = 0;

        for (const venue of PHILADELPHIA_VENUES) {
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

        console.log(`\n=== PHILADELPHIA RESULTS ===`);
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

importPhiladelphia();

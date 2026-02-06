/**
 * Phoenix Venues Import - Comprehensive
 */
const { Client } = require('pg');
const crypto = require('crypto');

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

const PHOENIX_VENUES = [
    // PREMIUM FACILITIES
    { name: "Ray & Joan Kroc Corps Community Center Phoenix", city: "Phoenix, AZ", lat: 33.3878, lng: -112.0890, indoor: true, access: "members" },
    { name: "Battleground AZ", city: "Tempe, AZ", lat: 33.4255, lng: -111.9400, indoor: true, access: "paid" },
    { name: "Swysh Den Basketball", city: "Scottsdale, AZ", lat: 33.5083, lng: -111.9312, indoor: true, access: "paid" },
    { name: "BEST Sport Scottsdale", city: "Scottsdale, AZ", lat: 33.4942, lng: -111.9261, indoor: true, access: "paid" },
    { name: "Inspire Courts AZ", city: "Phoenix, AZ", lat: 33.5787, lng: -112.1218, indoor: true, access: "paid" },
    { name: "The Basketball Garage", city: "Phoenix, AZ", lat: 33.4484, lng: -111.9831, indoor: true, access: "paid" },
    { name: "Avondale Sports Center", city: "Avondale, AZ", lat: 33.4356, lng: -112.3496, indoor: true, access: "paid" },

    // EOS Fitness (with courts)
    { name: "EoS Fitness Chandler", city: "Chandler, AZ", lat: 33.3062, lng: -111.8413, indoor: true, access: "members" },
    { name: "EoS Fitness Gilbert", city: "Gilbert, AZ", lat: 33.3528, lng: -111.7890, indoor: true, access: "members" },
    { name: "EoS Fitness Mesa", city: "Mesa, AZ", lat: 33.4152, lng: -111.8315, indoor: true, access: "members" },
    { name: "EoS Fitness Scottsdale", city: "Scottsdale, AZ", lat: 33.4847, lng: -111.9260, indoor: true, access: "members" },

    // LA Fitness / Esporta
    { name: "LA Fitness Phoenix Laveen", city: "Phoenix, AZ", lat: 33.3625, lng: -112.1582, indoor: true, access: "members" },
    { name: "LA Fitness Tempe", city: "Tempe, AZ", lat: 33.4148, lng: -111.9090, indoor: true, access: "members" },
    { name: "Esporta Fitness Phoenix", city: "Phoenix, AZ", lat: 33.5203, lng: -112.0542, indoor: true, access: "members" },

    // City Recreation Centers
    { name: "Kiwanis Park Recreation Center", city: "Tempe, AZ", lat: 33.3820, lng: -111.9388, indoor: true, access: "public" },
    { name: "Escalante Community Center", city: "Tempe, AZ", lat: 33.3954, lng: -111.9089, indoor: true, access: "public" },
    { name: "Longview Recreation Center", city: "Phoenix, AZ", lat: 33.4729, lng: -112.0884, indoor: true, access: "public" },
    { name: "Washington Activity Center", city: "Phoenix, AZ", lat: 33.4524, lng: -112.0711, indoor: true, access: "public" },
    { name: "Foothills Recreation Center", city: "Phoenix, AZ", lat: 33.6560, lng: -112.1841, indoor: true, access: "public" },
    { name: "Rio Vista Recreation Center", city: "Peoria, AZ", lat: 33.6442, lng: -112.2417, indoor: true, access: "public" },
    { name: "Desert West Community Center", city: "Phoenix, AZ", lat: 33.4836, lng: -112.2191, indoor: true, access: "public" },
    { name: "Goodyear Recreation Campus", city: "Goodyear, AZ", lat: 33.4353, lng: -112.3955, indoor: true, access: "public" },
    { name: "Surprise Community Park", city: "Surprise, AZ", lat: 33.6306, lng: -112.3680, indoor: true, access: "public" },

    // Universities
    { name: "ASU Sun Devil Fitness Complex", city: "Tempe, AZ", lat: 33.4203, lng: -111.9342, indoor: true, access: "members" },
    { name: "Grand Canyon University Arena", city: "Phoenix, AZ", lat: 33.5049, lng: -112.1098, indoor: true, access: "members" },

    // YMCA
    { name: "Valley of the Sun YMCA", city: "Phoenix, AZ", lat: 33.5134, lng: -112.0715, indoor: true, access: "members" },
    { name: "Chandler/Gilbert Family YMCA", city: "Chandler, AZ", lat: 33.3062, lng: -111.8233, indoor: true, access: "members" },

    // Famous Outdoor Courts
    { name: "Encanto Park Courts", city: "Phoenix, AZ", lat: 33.4749, lng: -112.0820, indoor: false, access: "public" },
    { name: "Tempe Beach Park Courts", city: "Tempe, AZ", lat: 33.4304, lng: -111.9433, indoor: false, access: "public" },
    { name: "Indian School Park Courts", city: "Phoenix, AZ", lat: 33.4979, lng: -112.0542, indoor: false, access: "public" },
];

async function importPhoenix() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== PHOENIX VENUES IMPORT ===\n');

        let added = 0, skipped = 0;

        for (const venue of PHOENIX_VENUES) {
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

        console.log(`\n=== PHOENIX RESULTS ===`);
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

importPhoenix();

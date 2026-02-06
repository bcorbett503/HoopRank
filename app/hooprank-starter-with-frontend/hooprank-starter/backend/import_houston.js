/**
 * Houston Venues Import - Comprehensive
 */
const { Client } = require('pg');
const crypto = require('crypto');

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

const HOUSTON_VENUES = [
    // PREMIUM TRAINING FACILITIES
    { name: "Just Play Sports Houston", city: "Houston, TX", lat: 29.7327, lng: -95.4938, indoor: true, access: "paid" },
    { name: "Just Play Sports Katy", city: "Katy, TX", lat: 29.7858, lng: -95.8245, indoor: true, access: "paid" },
    { name: "Hoopston Athletics", city: "Houston, TX", lat: 29.7604, lng: -95.3698, indoor: true, access: "paid" },
    { name: "Tha Hoop Spot Training Center", city: "Houston, TX", lat: 29.6800, lng: -95.4088, indoor: true, access: "paid" },
    { name: "Reps Up Basketball", city: "Houston, TX", lat: 29.7185, lng: -95.5210, indoor: true, access: "paid" },
    { name: "Ark Sports Center", city: "Houston, TX", lat: 29.8168, lng: -95.4122, indoor: true, access: "paid" },
    { name: "PlayGround Global Houston", city: "Houston, TX", lat: 29.6907, lng: -95.3854, indoor: true, access: "paid" },

    // PREMIUM CLUBS
    { name: "The Met Downtown", city: "Houston, TX", lat: 29.7589, lng: -95.3655, indoor: true, access: "members" },
    { name: "The Zone on Stella Link", city: "Houston, TX", lat: 29.6766, lng: -95.4221, indoor: true, access: "members" },
    { name: "The Houstonian Club", city: "Houston, TX", lat: 29.7632, lng: -95.4618, indoor: true, access: "members" },

    // 24 Hour Fitness & LA Fitness (with courts)
    { name: "24 Hour Fitness Meyerland", city: "Houston, TX", lat: 29.6730, lng: -95.4442, indoor: true, access: "members" },
    { name: "24 Hour Fitness Memorial", city: "Houston, TX", lat: 29.7724, lng: -95.5563, indoor: true, access: "members" },
    { name: "LA Fitness Westheimer", city: "Houston, TX", lat: 29.7390, lng: -95.5150, indoor: true, access: "members" },
    { name: "LA Fitness Sugar Land", city: "Sugar Land, TX", lat: 29.6197, lng: -95.6349, indoor: true, access: "members" },

    // Universities
    { name: "UH Campus Recreation Center", city: "Houston, TX", lat: 29.7199, lng: -95.3422, indoor: true, access: "members" },
    { name: "Rice Recreation Center", city: "Houston, TX", lat: 29.7174, lng: -95.4018, indoor: true, access: "members" },

    // Community Centers
    { name: "Community Fieldhouse", city: "Houston, TX", lat: 29.7358, lng: -95.3872, indoor: true, access: "paid" },
    { name: "Clear Lake City Community Association", city: "Houston, TX", lat: 29.5609, lng: -95.1261, indoor: true, access: "members" },
    { name: "Prime Time Sports Complex", city: "Houston, TX", lat: 29.8523, lng: -95.4798, indoor: true, access: "paid" },

    // YMCA
    { name: "YMCA Downtown Houston", city: "Houston, TX", lat: 29.7569, lng: -95.3622, indoor: true, access: "members" },
    { name: "YMCA Tellepsen", city: "Houston, TX", lat: 29.7437, lng: -95.3932, indoor: true, access: "members" },
    { name: "YMCA Memorial", city: "Houston, TX", lat: 29.7816, lng: -95.5606, indoor: true, access: "members" },
    { name: "YMCA Katy", city: "Katy, TX", lat: 29.7785, lng: -95.7698, indoor: true, access: "members" },

    // Famous Outdoor Courts
    { name: "MacGregor Park Courts", city: "Houston, TX", lat: 29.7095, lng: -95.3422, indoor: false, access: "public" },
    { name: "Emancipation Park Courts", city: "Houston, TX", lat: 29.7406, lng: -95.3507, indoor: false, access: "public" },
    { name: "Fonde Recreation Center Courts", city: "Houston, TX", lat: 29.7463, lng: -95.3353, indoor: false, access: "public" },
    { name: "Memorial Park Courts", city: "Houston, TX", lat: 29.7661, lng: -95.4381, indoor: false, access: "public" },
];

async function importHouston() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== HOUSTON VENUES IMPORT ===\n');

        let added = 0, skipped = 0;

        for (const venue of HOUSTON_VENUES) {
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

        console.log(`\n=== HOUSTON RESULTS ===`);
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

importHouston();

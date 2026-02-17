/**
 * Tier 1 Remaining Cities Import (San Antonio, San Diego, Dallas, San Jose)
 */
const { Client } = require('pg');
const crypto = require('crypto');

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

const TIER1_REMAINING = [
    // === SAN ANTONIO ===
    { name: "Premier Athletics San Antonio", city: "San Antonio, TX", lat: 29.5538, lng: -98.5682, indoor: true, access: "paid" },
    { name: "YMCA Downtown San Antonio", city: "San Antonio, TX", lat: 29.4241, lng: -98.4936, indoor: true, access: "members" },
    { name: "YMCA Mays Family", city: "San Antonio, TX", lat: 29.5520, lng: -98.4932, indoor: true, access: "members" },
    { name: "UTSA Recreation Center", city: "San Antonio, TX", lat: 29.5844, lng: -98.6198, indoor: true, access: "members" },
    { name: "SA Sports", city: "San Antonio, TX", lat: 29.4632, lng: -98.5281, indoor: true, access: "paid" },
    { name: "Hardberger Park Urban Ecology Center", city: "San Antonio, TX", lat: 29.5332, lng: -98.5307, indoor: true, access: "public" },
    { name: "Pearsall Park Pavilion", city: "San Antonio, TX", lat: 29.3615, lng: -98.5815, indoor: true, access: "public" },
    { name: "Pittman-Sullivan Park Courts", city: "San Antonio, TX", lat: 29.4344, lng: -98.4741, indoor: false, access: "public" },
    { name: "Woodlawn Lake Park Courts", city: "San Antonio, TX", lat: 29.4683, lng: -98.5231, indoor: false, access: "public" },

    // === SAN DIEGO ===
    { name: "Mission Valley YMCA", city: "San Diego, CA", lat: 32.7713, lng: -117.1644, indoor: true, access: "members" },
    { name: "Copley-Price Family YMCA", city: "San Diego, CA", lat: 32.7596, lng: -117.0984, indoor: true, access: "members" },
    { name: "Peninsula Family YMCA", city: "San Diego, CA", lat: 32.7524, lng: -117.2306, indoor: true, access: "members" },
    { name: "San Diego City College Gym", city: "San Diego, CA", lat: 32.7253, lng: -117.1663, indoor: true, access: "members" },
    { name: "SDSU Aztec Recreation Center", city: "San Diego, CA", lat: 32.7759, lng: -117.0749, indoor: true, access: "members" },
    { name: "Chuze Fitness Chula Vista", city: "Chula Vista, CA", lat: 32.6401, lng: -117.0846, indoor: true, access: "members" },
    { name: "Martin Luther King Jr. Community Center", city: "San Diego, CA", lat: 32.7123, lng: -117.1144, indoor: true, access: "public" },
    { name: "Golden Hill Recreation Center", city: "San Diego, CA", lat: 32.7149, lng: -117.1304, indoor: true, access: "public" },
    { name: "Memorial Recreation Center", city: "San Diego, CA", lat: 32.7461, lng: -117.1295, indoor: true, access: "public" },
    { name: "Robb Field Courts", city: "San Diego, CA", lat: 32.7562, lng: -117.2393, indoor: false, access: "public" },

    // === DALLAS ===
    { name: "Mavs Gaming Hub", city: "Dallas, TX", lat: 32.7873, lng: -96.8010, indoor: true, access: "paid" },
    { name: "The Courts at Craig Ranch", city: "McKinney, TX", lat: 33.1490, lng: -96.7503, indoor: true, access: "paid" },
    { name: "SMU Dedman Center", city: "Dallas, TX", lat: 32.8444, lng: -96.7857, indoor: true, access: "members" },
    { name: "UTD Activity Center", city: "Richardson, TX", lat: 32.9880, lng: -96.7509, indoor: true, access: "members" },
    { name: "YMCA Downtown Dallas", city: "Dallas, TX", lat: 32.7872, lng: -96.8035, indoor: true, access: "members" },
    { name: "YMCA Park South", city: "Dallas, TX", lat: 32.7157, lng: -96.7997, indoor: true, access: "members" },
    { name: "Moody Family YMCA", city: "Dallas, TX", lat: 32.8503, lng: -96.8466, indoor: true, access: "members" },
    { name: "Bachman Lake Recreation Center", city: "Dallas, TX", lat: 32.8657, lng: -96.8748, indoor: true, access: "public" },
    { name: "Samuell Grand Recreation Center", city: "Dallas, TX", lat: 32.7978, lng: -96.7229, indoor: true, access: "public" },
    { name: "Kidd Springs Recreation Center", city: "Dallas, TX", lat: 32.7648, lng: -96.8475, indoor: true, access: "public" },
    { name: "Willie B. Johnson Recreation Center", city: "Dallas, TX", lat: 32.7340, lng: -96.8267, indoor: true, access: "public" },
    { name: "Fair Oaks Recreation Center", city: "Dallas, TX", lat: 32.7116, lng: -96.7461, indoor: true, access: "public" },
    { name: "Reverchon Park Courts", city: "Dallas, TX", lat: 32.7992, lng: -96.8131, indoor: false, access: "public" },

    // === SAN JOSE ===
    { name: "SJSU Event Center", city: "San Jose, CA", lat: 37.3361, lng: -121.8806, indoor: true, access: "members" },
    { name: "Santa Clara University Leavey Center", city: "Santa Clara, CA", lat: 37.3496, lng: -121.9389, indoor: true, access: "members" },
    { name: "Bay Club Santa Clara", city: "Santa Clara, CA", lat: 37.3762, lng: -121.9860, indoor: true, access: "members" },
    { name: "South Bay Sports Arena", city: "San Jose, CA", lat: 37.2859, lng: -121.8475, indoor: true, access: "paid" },
    { name: "Campbell Community Center Gym", city: "Campbell, CA", lat: 37.2872, lng: -121.9500, indoor: true, access: "public" },
    { name: "Camden Community Center", city: "San Jose, CA", lat: 37.2517, lng: -121.9296, indoor: true, access: "public" },
    { name: "Mayfair Community Center", city: "San Jose, CA", lat: 37.3538, lng: -121.8429, indoor: true, access: "public" },
    { name: "Almaden Community Center", city: "San Jose, CA", lat: 37.2254, lng: -121.8574, indoor: true, access: "public" },
    { name: "Roosevelt Community Center", city: "San Jose, CA", lat: 37.3451, lng: -121.9003, indoor: true, access: "public" },
    { name: "YMCA Southwest San Jose", city: "San Jose, CA", lat: 37.2516, lng: -121.9341, indoor: true, access: "members" },
    { name: "YMCA Central San Jose", city: "San Jose, CA", lat: 37.3403, lng: -121.8945, indoor: true, access: "members" },
    { name: "Backesto Park Courts", city: "San Jose, CA", lat: 37.3591, lng: -121.8881, indoor: false, access: "public" },
    { name: "St. James Park Courts", city: "San Jose, CA", lat: 37.3404, lng: -121.8880, indoor: false, access: "public" },
];

async function importTier1Remaining() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== TIER 1 REMAINING CITIES IMPORT ===\n');

        let added = 0, skipped = 0;

        for (const venue of TIER1_REMAINING) {
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

        console.log(`\n=== TIER 1 REMAINING RESULTS ===`);
        console.log(`✅ Added: ${added}`);
        console.log(`⏭️  Skipped: ${skipped}`);

        const total = await client.query('SELECT COUNT(*) as count FROM courts');
        console.log(`📊 Total courts in database: ${total.rows[0].count}`);

        const cityCount = await client.query('SELECT COUNT(DISTINCT city) as count FROM courts');
        console.log(`📍 Total cities represented: ${cityCount.rows[0].count}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

importTier1Remaining();

/**
 * Tier 2 Cities Import (Austin, Jacksonville, Fort Worth, Columbus, Charlotte, 
 * Indianapolis, San Francisco, Seattle, Denver, Washington DC)
 */
const { Client } = require('pg');
const crypto = require('crypto');

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

const TIER2_CITIES = [
    // === AUSTIN ===
    { name: "Austin Sports Center North", city: "Austin, TX", lat: 30.4171, lng: -97.7235, indoor: true, access: "paid" },
    { name: "Austin Sports Center South", city: "Austin, TX", lat: 30.1870, lng: -97.8186, indoor: true, access: "paid" },
    { name: "UT Gregory Gym", city: "Austin, TX", lat: 30.2849, lng: -97.7341, indoor: true, access: "members" },
    { name: "YMCA TownLake Austin", city: "Austin, TX", lat: 30.2594, lng: -97.7556, indoor: true, access: "members" },
    { name: "YMCA SW Austin", city: "Austin, TX", lat: 30.2155, lng: -97.8549, indoor: true, access: "members" },
    { name: "Gus Garcia Recreation Center", city: "Austin, TX", lat: 30.3425, lng: -97.6723, indoor: true, access: "public" },
    { name: "Givens Recreation Center", city: "Austin, TX", lat: 30.2714, lng: -97.7106, indoor: true, access: "public" },
    { name: "Pan Am Recreation Center", city: "Austin, TX", lat: 30.2573, lng: -97.7141, indoor: true, access: "public" },
    { name: "Rosewood-Zaragosa Recreation Center", city: "Austin, TX", lat: 30.2731, lng: -97.6978, indoor: true, access: "public" },

    // === JACKSONVILLE ===
    { name: "JU Health & Sports Center", city: "Jacksonville, FL", lat: 30.3497, lng: -81.6018, indoor: true, access: "members" },
    { name: "YMCA Downtown Jacksonville", city: "Jacksonville, FL", lat: 30.3269, lng: -81.6561, indoor: true, access: "members" },
    { name: "YMCA Dye Clay", city: "Jacksonville, FL", lat: 30.1752, lng: -81.7127, indoor: true, access: "members" },
    { name: "FSCJ Gymnasium", city: "Jacksonville, FL", lat: 30.3154, lng: -81.6831, indoor: true, access: "members" },
    { name: "Legends Sports Complex", city: "Jacksonville, FL", lat: 30.2209, lng: -81.5425, indoor: true, access: "paid" },
    { name: "Mandarin Sports & Entertainment Complex", city: "Jacksonville, FL", lat: 30.1589, lng: -81.6389, indoor: true, access: "public" },

    // === FORT WORTH ===
    { name: "The Original Gym Fort Worth", city: "Fort Worth, TX", lat: 32.7555, lng: -97.3308, indoor: true, access: "paid" },
    { name: "TCU University Recreation Center", city: "Fort Worth, TX", lat: 32.7101, lng: -97.3629, indoor: true, access: "members" },
    { name: "YMCA Downtown Fort Worth", city: "Fort Worth, TX", lat: 32.7517, lng: -97.3307, indoor: true, access: "members" },
    { name: "YMCA Ryan Family", city: "Fort Worth, TX", lat: 32.6880, lng: -97.4250, indoor: true, access: "members" },
    { name: "Sycamore Recreation Center", city: "Fort Worth, TX", lat: 32.7325, lng: -97.2907, indoor: true, access: "public" },
    { name: "Worth Heights Community Center", city: "Fort Worth, TX", lat: 32.7188, lng: -97.3104, indoor: true, access: "public" },

    // === COLUMBUS ===
    { name: "Ohio State RPAC", city: "Columbus, OH", lat: 40.0062, lng: -83.0313, indoor: true, access: "members" },
    { name: "The Schott North Athletic Facility", city: "Columbus, OH", lat: 40.0076, lng: -83.0249, indoor: true, access: "members" },
    { name: "YMCA Downtown Columbus", city: "Columbus, OH", lat: 39.9639, lng: -82.9970, indoor: true, access: "members" },
    { name: "YMCA Northside Columbus", city: "Columbus, OH", lat: 40.0618, lng: -82.9828, indoor: true, access: "members" },
    { name: "Dodge Recreation Center", city: "Columbus, OH", lat: 39.9697, lng: -83.0211, indoor: true, access: "public" },
    { name: "Gillie Recreation Center", city: "Columbus, OH", lat: 39.9283, lng: -82.9579, indoor: true, access: "public" },

    // === CHARLOTTE ===
    { name: "Spectrum Center Practice Facility", city: "Charlotte, NC", lat: 35.2251, lng: -80.8395, indoor: true, access: "members" },
    { name: "UNC Charlotte Student Recreation Center", city: "Charlotte, NC", lat: 35.3040, lng: -80.7310, indoor: true, access: "members" },
    { name: "YMCA Dowd", city: "Charlotte, NC", lat: 35.2270, lng: -80.8429, indoor: true, access: "members" },
    { name: "YMCA Morrison", city: "Charlotte, NC", lat: 35.1171, lng: -80.8647, indoor: true, access: "members" },
    { name: "Revolution Park Community Center", city: "Charlotte, NC", lat: 35.1969, lng: -80.8566, indoor: true, access: "public" },
    { name: "Belmont Recreation Center", city: "Charlotte, NC", lat: 35.2469, lng: -80.8136, indoor: true, access: "public" },

    // === INDIANAPOLIS ===
    { name: "Pacers Training Center", city: "Indianapolis, IN", lat: 39.7650, lng: -86.1579, indoor: true, access: "members" },
    { name: "IUPUI Natatorium Sports Complex", city: "Indianapolis, IN", lat: 39.7750, lng: -86.1706, indoor: true, access: "members" },
    { name: "YMCA Downtown Indy", city: "Indianapolis, IN", lat: 39.7766, lng: -86.1559, indoor: true, access: "members" },
    { name: "YMCA Jordan", city: "Indianapolis, IN", lat: 39.8070, lng: -86.1299, indoor: true, access: "members" },
    { name: "Garfield Park Family Center", city: "Indianapolis, IN", lat: 39.7289, lng: -86.1420, indoor: true, access: "public" },
    { name: "Brookside Community Center", city: "Indianapolis, IN", lat: 39.7976, lng: -86.1058, indoor: true, access: "public" },

    // === SAN FRANCISCO ===
    { name: "24 Hour Fitness SOMA", city: "San Francisco, CA", lat: 37.7789, lng: -122.4038, indoor: true, access: "members" },
    { name: "YMCA Embarcadero", city: "San Francisco, CA", lat: 37.7922, lng: -122.3917, indoor: true, access: "members" },
    { name: "YMCA Presidio", city: "San Francisco, CA", lat: 37.7885, lng: -122.4620, indoor: true, access: "members" },
    { name: "Kezar Pavilion", city: "San Francisco, CA", lat: 37.7675, lng: -122.4539, indoor: true, access: "public" },
    { name: "Hamilton Recreation Center", city: "San Francisco, CA", lat: 37.7647, lng: -122.4333, indoor: true, access: "public" },
    { name: "Potrero Hill Recreation Center", city: "San Francisco, CA", lat: 37.7589, lng: -122.4014, indoor: true, access: "public" },
    { name: "Mission Recreation Center", city: "San Francisco, CA", lat: 37.7599, lng: -122.4218, indoor: true, access: "public" },

    // === SEATTLE ===
    { name: "Seattle Pacific Rec Center", city: "Seattle, WA", lat: 47.6507, lng: -122.3616, indoor: true, access: "members" },
    { name: "UW Intramural Activities Building", city: "Seattle, WA", lat: 47.6554, lng: -122.3055, indoor: true, access: "members" },
    { name: "YMCA Downtown Seattle", city: "Seattle, WA", lat: 47.6094, lng: -122.3347, indoor: true, access: "members" },
    { name: "YMCA Northgate", city: "Seattle, WA", lat: 47.7063, lng: -122.3287, indoor: true, access: "members" },
    { name: "Rainier Community Center", city: "Seattle, WA", lat: 47.5479, lng: -122.2895, indoor: true, access: "public" },
    { name: "Garfield Community Center", city: "Seattle, WA", lat: 47.6119, lng: -122.2976, indoor: true, access: "public" },
    { name: "Bitter Lake Community Center", city: "Seattle, WA", lat: 47.7206, lng: -122.3468, indoor: true, access: "public" },

    // === DENVER ===
    { name: "Glendale Sports Arena", city: "Glendale, CO", lat: 39.7047, lng: -104.9358, indoor: true, access: "paid" },
    { name: "CU Denver Wellness Center", city: "Denver, CO", lat: 39.7455, lng: -104.9989, indoor: true, access: "members" },
    { name: "Metro Denver YMCA", city: "Denver, CO", lat: 39.7392, lng: -104.9903, indoor: true, access: "members" },
    { name: "YMCA Southwest Denver", city: "Denver, CO", lat: 39.6659, lng: -105.0373, indoor: true, access: "members" },
    { name: "Montbello Recreation Center", city: "Denver, CO", lat: 39.7834, lng: -104.8403, indoor: true, access: "public" },
    { name: "Martin Luther King Jr Recreation Center", city: "Denver, CO", lat: 39.7459, lng: -104.9447, indoor: true, access: "public" },
    { name: "Harvey Park Recreation Center", city: "Denver, CO", lat: 39.6740, lng: -105.0449, indoor: true, access: "public" },

    // === WASHINGTON DC ===
    { name: "Verizon Center Practice Facility", city: "Washington, DC", lat: 38.8981, lng: -77.0209, indoor: true, access: "members" },
    { name: "Georgetown McDonough Arena", city: "Washington, DC", lat: 38.9081, lng: -77.0755, indoor: true, access: "members" },
    { name: "GW Lerner Health Center", city: "Washington, DC", lat: 38.8996, lng: -77.0479, indoor: true, access: "members" },
    { name: "YMCA Anthony Bowen", city: "Washington, DC", lat: 38.9023, lng: -77.0343, indoor: true, access: "members" },
    { name: "YMCA National Capital", city: "Washington, DC", lat: 38.8987, lng: -77.0368, indoor: true, access: "members" },
    { name: "Turkey Thicket Recreation Center", city: "Washington, DC", lat: 38.9262, lng: -77.0030, indoor: true, access: "public" },
    { name: "Deanwood Recreation Center", city: "Washington, DC", lat: 38.9045, lng: -76.9365, indoor: true, access: "public" },
    { name: "Rumsey Aquatic Center", city: "Washington, DC", lat: 38.8841, lng: -76.9970, indoor: true, access: "public" },
];

async function importTier2() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== TIER 2 CITIES IMPORT ===\n');

        let added = 0, skipped = 0;

        for (const venue of TIER2_CITIES) {
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

        console.log(`\n=== TIER 2 RESULTS ===`);
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

importTier2();

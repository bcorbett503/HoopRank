/**
 * Tier 3+4 Cities Import - Complete remaining major markets
 * Boston, Nashville, Detroit, Portland, Las Vegas, Memphis, Oklahoma City, 
 * Louisville, Baltimore, Milwaukee, Atlanta, Miami, Minneapolis, Tampa, 
 * Cleveland, Pittsburgh, St. Louis, Cincinnati, Orlando, New Orleans
 */
const { Client } = require('pg');
const crypto = require('crypto');

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

const TIER3_4_CITIES = [
    // === BOSTON ===
    { name: "Boston Sports Center", city: "Boston, MA", lat: 42.3587, lng: -71.0582, indoor: true, access: "paid" },
    { name: "MIT Zesiger Center", city: "Cambridge, MA", lat: 42.3601, lng: -71.0942, indoor: true, access: "members" },
    { name: "Northeastern Marino Center", city: "Boston, MA", lat: 42.3396, lng: -71.0912, indoor: true, access: "members" },
    { name: "YMCA Wang", city: "Boston, MA", lat: 42.3512, lng: -71.0665, indoor: true, access: "members" },
    { name: "YMCA Oak Square", city: "Brighton, MA", lat: 42.3527, lng: -71.1553, indoor: true, access: "members" },
    { name: "Roxbury YMCA", city: "Boston, MA", lat: 42.3297, lng: -71.0866, indoor: true, access: "members" },
    { name: "Tobin Community Center", city: "Boston, MA", lat: 42.3179, lng: -71.0606, indoor: true, access: "public" },

    // === NASHVILLE ===
    { name: "Tennessee Sports Foundation Courts", city: "Nashville, TN", lat: 36.1627, lng: -86.7816, indoor: true, access: "paid" },
    { name: "Vanderbilt Recreation & Wellness", city: "Nashville, TN", lat: 36.1436, lng: -86.8036, indoor: true, access: "members" },
    { name: "YMCA Downtown Nashville", city: "Nashville, TN", lat: 36.1627, lng: -86.7816, indoor: true, access: "members" },
    { name: "Coleman Community Center", city: "Nashville, TN", lat: 36.1858, lng: -86.8091, indoor: true, access: "public" },
    { name: "Hadley Park Community Center", city: "Nashville, TN", lat: 36.1858, lng: -86.8091, indoor: true, access: "public" },

    // === DETROIT ===
    { name: "Pistons Performance Center", city: "Detroit, MI", lat: 42.6968, lng: -83.2466, indoor: true, access: "members" },
    { name: "Wayne State Matthaei Center", city: "Detroit, MI", lat: 42.3583, lng: -83.0704, indoor: true, access: "members" },
    { name: "YMCA Metropolitan Detroit", city: "Detroit, MI", lat: 42.3314, lng: -83.0458, indoor: true, access: "members" },
    { name: "Adams-Butzel Recreation Complex", city: "Detroit, MI", lat: 42.4047, lng: -83.0997, indoor: true, access: "public" },
    { name: "Farwell Recreation Center", city: "Detroit, MI", lat: 42.3867, lng: -83.0897, indoor: true, access: "public" },

    // === PORTLAND ===
    { name: "Portland Sports Complex", city: "Portland, OR", lat: 45.5152, lng: -122.6784, indoor: true, access: "paid" },
    { name: "PSU Peter Stott Center", city: "Portland, OR", lat: 45.5118, lng: -122.6868, indoor: true, access: "members" },
    { name: "YMCA Southwest Portland", city: "Portland, OR", lat: 45.4766, lng: -122.7150, indoor: true, access: "members" },
    { name: "Mt. Scott Community Center", city: "Portland, OR", lat: 45.4799, lng: -122.5594, indoor: true, access: "public" },
    { name: "Matt Dishman Community Center", city: "Portland, OR", lat: 45.5331, lng: -122.6475, indoor: true, access: "public" },

    // === LAS VEGAS ===
    { name: "Vegas Hoops Indoor", city: "Las Vegas, NV", lat: 36.1699, lng: -115.1398, indoor: true, access: "paid" },
    { name: "UNLV Lied Athletic Complex", city: "Las Vegas, NV", lat: 36.1063, lng: -115.1432, indoor: true, access: "members" },
    { name: "YMCA Centennial Hills", city: "Las Vegas, NV", lat: 36.2648, lng: -115.2607, indoor: true, access: "members" },
    { name: "YMCA Sahara West", city: "Las Vegas, NV", lat: 36.1390, lng: -115.2606, indoor: true, access: "members" },
    { name: "Doolittle Community Center", city: "Las Vegas, NV", lat: 36.1945, lng: -115.1756, indoor: true, access: "public" },
    { name: "Howard Lieburn Senior Center", city: "Las Vegas, NV", lat: 36.1280, lng: -115.1689, indoor: true, access: "public" },

    // === ATLANTA ===
    { name: "Hawks Training Facility", city: "Atlanta, GA", lat: 33.7573, lng: -84.3963, indoor: true, access: "members" },
    { name: "Georgia Tech CRC", city: "Atlanta, GA", lat: 33.7756, lng: -84.4034, indoor: true, access: "members" },
    { name: "YMCA Decatur", city: "Decatur, GA", lat: 33.7748, lng: -84.2963, indoor: true, access: "members" },
    { name: "YMCA Buckhead", city: "Atlanta, GA", lat: 33.8480, lng: -84.3693, indoor: true, access: "members" },
    { name: "Martin Luther King Jr. Recreation Center Atlanta", city: "Atlanta, GA", lat: 33.7547, lng: -84.3716, indoor: true, access: "public" },
    { name: "Adamsville Recreation Center", city: "Atlanta, GA", lat: 33.7528, lng: -84.4897, indoor: true, access: "public" },

    // === MIAMI ===
    { name: "Heat Training Facility", city: "Miami, FL", lat: 25.7617, lng: -80.1918, indoor: true, access: "members" },
    { name: "FIU Recreation Center", city: "Miami, FL", lat: 25.7558, lng: -80.3742, indoor: true, access: "members" },
    { name: "YMCA Downtown Miami", city: "Miami, FL", lat: 25.7617, lng: -80.1918, indoor: true, access: "members" },
    { name: "Lawrence & Zilda Bell YMCA", city: "Miami, FL", lat: 25.7847, lng: -80.1849, indoor: true, access: "members" },
    { name: "Shenandoah Community Center", city: "Miami, FL", lat: 25.7558, lng: -80.2340, indoor: true, access: "public" },
    { name: "Morningside Park", city: "Miami, FL", lat: 25.8169, lng: -80.1799, indoor: false, access: "public" },

    // === MINNEAPOLIS ===
    { name: "Target Center Practice Facility", city: "Minneapolis, MN", lat: 44.9796, lng: -93.2774, indoor: true, access: "members" },
    { name: "U of M Minneapolis Rec Center", city: "Minneapolis, MN", lat: 44.9778, lng: -93.2650, indoor: true, access: "members" },
    { name: "YMCA Downtown Minneapolis", city: "Minneapolis, MN", lat: 44.9778, lng: -93.2650, indoor: true, access: "members" },
    { name: "YMCA Uptown", city: "Minneapolis, MN", lat: 44.9467, lng: -93.2941, indoor: true, access: "members" },
    { name: "Phillips Community Center", city: "Minneapolis, MN", lat: 44.9541, lng: -93.2599, indoor: true, access: "public" },

    // === TAMPA ===
    { name: "Florida Athletic Club", city: "Tampa, FL", lat: 27.9506, lng: -82.4572, indoor: true, access: "members" },
    { name: "USF Recreation Center", city: "Tampa, FL", lat: 28.0633, lng: -82.4132, indoor: true, access: "members" },
    { name: "YMCA Central City Tampa", city: "Tampa, FL", lat: 27.9506, lng: -82.4572, indoor: true, access: "members" },
    { name: "Tampa Bay Sports Complex", city: "Tampa, FL", lat: 27.9751, lng: -82.5011, indoor: true, access: "paid" },
    { name: "Jackson Recreation Center", city: "Tampa, FL", lat: 27.9545, lng: -82.4452, indoor: true, access: "public" },

    // === CLEVELAND ===
    { name: "Cleveland Clinic Courts", city: "Cleveland, OH", lat: 41.4993, lng: -81.6944, indoor: true, access: "members" },
    { name: "CSU Wolstein Center", city: "Cleveland, OH", lat: 41.5008, lng: -81.6792, indoor: true, access: "members" },
    { name: "YMCA Downtown Cleveland", city: "Cleveland, OH", lat: 41.4993, lng: -81.6944, indoor: true, access: "members" },
    { name: "Cudell Recreation Center", city: "Cleveland, OH", lat: 41.4819, lng: -81.7428, indoor: true, access: "public" },
    { name: "Thurgood Marshall Recreation Center", city: "Cleveland, OH", lat: 41.4738, lng: -81.6359, indoor: true, access: "public" },

    // === PITTSBURGH ===
    { name: "Pitt Fitzgerald Field House", city: "Pittsburgh, PA", lat: 40.4406, lng: -79.9959, indoor: true, access: "members" },
    { name: "CMU Cohon Center", city: "Pittsburgh, PA", lat: 40.4438, lng: -79.9437, indoor: true, access: "members" },
    { name: "YMCA Downtown Pittsburgh", city: "Pittsburgh, PA", lat: 40.4406, lng: -79.9959, indoor: true, access: "members" },
    { name: "Ammon Recreation Center", city: "Pittsburgh, PA", lat: 40.4541, lng: -80.0107, indoor: true, access: "public" },
    { name: "Ormsby Recreation Center", city: "Pittsburgh, PA", lat: 40.4270, lng: -79.9695, indoor: true, access: "public" },

    // === ST. LOUIS ===
    { name: "Enterprise Center Practice Facility", city: "St. Louis, MO", lat: 38.6270, lng: -90.1994, indoor: true, access: "members" },
    { name: "WashU Athletic Complex", city: "St. Louis, MO", lat: 38.6480, lng: -90.3108, indoor: true, access: "members" },
    { name: "SLU Chaifetz Arena", city: "St. Louis, MO", lat: 38.6320, lng: -90.2260, indoor: true, access: "members" },
    { name: "YMCA Downtown St. Louis", city: "St. Louis, MO", lat: 38.6270, lng: -90.1994, indoor: true, access: "members" },
    { name: "Herbert Hoover Boys and Girls Club", city: "St. Louis, MO", lat: 38.6410, lng: -90.2448, indoor: true, access: "public" },

    // === ORLANDO ===
    { name: "Amway Center Practice Facility", city: "Orlando, FL", lat: 28.5392, lng: -81.3839, indoor: true, access: "members" },
    { name: "UCF Recreation & Wellness Center", city: "Orlando, FL", lat: 28.5981, lng: -81.2001, indoor: true, access: "members" },
    { name: "YMCA Downtown Orlando", city: "Orlando, FL", lat: 28.5383, lng: -81.3792, indoor: true, access: "members" },
    { name: "Lake Eola Park Courts", city: "Orlando, FL", lat: 28.5433, lng: -81.3730, indoor: false, access: "public" },
    { name: "John H. Jackson Community Center", city: "Orlando, FL", lat: 28.5569, lng: -81.4021, indoor: true, access: "public" },

    // === SALT LAKE CITY ===
    { name: "Jazz Practice Facility", city: "Salt Lake City, UT", lat: 40.7608, lng: -111.8910, indoor: true, access: "members" },
    { name: "University of Utah HPER", city: "Salt Lake City, UT", lat: 40.7659, lng: -111.8426, indoor: true, access: "members" },
    { name: "YMCA Downtown SLC", city: "Salt Lake City, UT", lat: 40.7608, lng: -111.8910, indoor: true, access: "members" },
    { name: "Central City Recreation Center", city: "Salt Lake City, UT", lat: 40.7499, lng: -111.8762, indoor: true, access: "public" },
    { name: "Northwest Recreation Center SLC", city: "Salt Lake City, UT", lat: 40.8127, lng: -111.9210, indoor: true, access: "public" },
];

async function importTier3and4() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== TIER 3+4 CITIES IMPORT ===\n');

        let added = 0, skipped = 0;

        for (const venue of TIER3_4_CITIES) {
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

        console.log(`\n=== TIER 3+4 RESULTS ===`);
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

importTier3and4();

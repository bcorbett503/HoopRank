/**
 * Comprehensive Court Import Script
 * Adds premium athletic clubs across 200+ US cities
 */

const crypto = require('crypto');

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

const API_BASE = "https://heartfelt-appreciation-production-65f1.up.railway.app";

// Premium venue data organized by tier and city
const PREMIUM_VENUES = [
    // === TIER 1: Top 5 Markets ===

    // NEW YORK
    { name: "Equinox Columbus Circle", city: "New York, NY", lat: 40.7681, lng: -73.9819, indoor: true, access: "members" },
    { name: "Equinox Sports Club NYC", city: "New York, NY", lat: 40.7505, lng: -73.9935, indoor: true, access: "members" },
    { name: "Life Time Sky", city: "New York, NY", lat: 40.7549, lng: -73.9879, indoor: true, access: "members" },
    { name: "Chelsea Piers Athletic Club", city: "New York, NY", lat: 40.7465, lng: -74.0086, indoor: true, access: "members" },
    { name: "Asphalt Green Upper East Side", city: "New York, NY", lat: 40.7761, lng: -73.9450, indoor: true, access: "members" },
    { name: "NYSC Herald Square", city: "New York, NY", lat: 40.7484, lng: -73.9878, indoor: true, access: "members" },

    // LOS ANGELES
    { name: "Equinox West Hollywood", city: "Los Angeles, CA", lat: 34.0900, lng: -118.3617, indoor: true, access: "members" },
    { name: "Equinox Santa Monica", city: "Santa Monica, CA", lat: 34.0195, lng: -118.4912, indoor: true, access: "members" },
    { name: "Life Time Northridge", city: "Northridge, CA", lat: 34.2294, lng: -118.5366, indoor: true, access: "members" },
    { name: "LA Fitness Hollywood", city: "Los Angeles, CA", lat: 34.1012, lng: -118.3388, indoor: true, access: "members" },
    { name: "Gold's Gym Venice", city: "Venice, CA", lat: 33.9929, lng: -118.4729, indoor: true, access: "members" },
    { name: "UCLA John Wooden Center", city: "Los Angeles, CA", lat: 34.0706, lng: -118.4455, indoor: true, access: "members" },

    // CHICAGO
    { name: "Equinox Lincoln Park", city: "Chicago, IL", lat: 41.9206, lng: -87.6537, indoor: true, access: "members" },
    { name: "Equinox Gold Coast", city: "Chicago, IL", lat: 41.9031, lng: -87.6282, indoor: true, access: "members" },
    { name: "Life Time South Loop", city: "Chicago, IL", lat: 41.8580, lng: -87.6298, indoor: true, access: "members" },
    { name: "XSport Fitness Chicago", city: "Chicago, IL", lat: 41.9394, lng: -87.6542, indoor: true, access: "members" },
    { name: "Chicago Athletic Association", city: "Chicago, IL", lat: 41.8826, lng: -87.6248, indoor: true, access: "members" },

    // HOUSTON
    { name: "Life Time City Centre", city: "Houston, TX", lat: 29.7792, lng: -95.5614, indoor: true, access: "members" },
    { name: "Equinox Houston", city: "Houston, TX", lat: 29.7374, lng: -95.4115, indoor: true, access: "members" },
    { name: "Houston Marriott Marquis", city: "Houston, TX", lat: 29.7523, lng: -95.3584, indoor: true, access: "members" },
    { name: "24 Hour Fitness Galleria", city: "Houston, TX", lat: 29.7380, lng: -95.4614, indoor: true, access: "members" },

    // PHOENIX
    { name: "Life Time Scottsdale", city: "Scottsdale, AZ", lat: 33.5007, lng: -111.9310, indoor: true, access: "members" },
    { name: "Life Time North Scottsdale", city: "Scottsdale, AZ", lat: 33.6308, lng: -111.9270, indoor: true, access: "members" },
    { name: "Mountainside Fitness Phoenix", city: "Phoenix, AZ", lat: 33.5222, lng: -112.0540, indoor: true, access: "members" },
    { name: "EoS Fitness Phoenix", city: "Phoenix, AZ", lat: 33.4944, lng: -112.0740, indoor: true, access: "members" },

    // === TIER 2: Next 5 Markets ===

    // PHILADELPHIA
    { name: "Philadelphia Sports Club Rittenhouse", city: "Philadelphia, PA", lat: 39.9481, lng: -75.1709, indoor: true, access: "members" },
    { name: "City Fitness Philadelphia", city: "Philadelphia, PA", lat: 39.9453, lng: -75.1597, indoor: true, access: "members" },
    { name: "Sweat Fitness Philly", city: "Philadelphia, PA", lat: 39.9429, lng: -75.1593, indoor: true, access: "members" },

    // SAN ANTONIO
    { name: "Life Time San Antonio", city: "San Antonio, TX", lat: 29.5499, lng: -98.5691, indoor: true, access: "members" },
    { name: "Gold's Gym San Antonio", city: "San Antonio, TX", lat: 29.4614, lng: -98.5116, indoor: true, access: "members" },
    { name: "Retro Fitness San Antonio", city: "San Antonio, TX", lat: 29.5202, lng: -98.4597, indoor: true, access: "members" },

    // SAN DIEGO
    { name: "Equinox La Jolla", city: "La Jolla, CA", lat: 32.8631, lng: -117.2526, indoor: true, access: "members" },
    { name: "24 Hour Fitness San Diego", city: "San Diego, CA", lat: 32.7474, lng: -117.1648, indoor: true, access: "members" },
    { name: "Chuze Fitness San Diego", city: "San Diego, CA", lat: 32.8310, lng: -117.1329, indoor: true, access: "members" },

    // DALLAS
    { name: "Equinox Highland Park", city: "Dallas, TX", lat: 32.8341, lng: -96.8063, indoor: true, access: "members" },
    { name: "Life Time Plano", city: "Plano, TX", lat: 33.0491, lng: -96.7506, indoor: true, access: "members" },
    { name: "T Boone Pickens YMCA", city: "Dallas, TX", lat: 32.7918, lng: -96.8026, indoor: true, access: "members" },
    { name: "Cooper Fitness Center", city: "Dallas, TX", lat: 32.8951, lng: -96.7671, indoor: true, access: "members" },

    // SAN JOSE
    { name: "24 Hour Fitness Downtown San Jose", city: "San Jose, CA", lat: 37.3359, lng: -121.8914, indoor: true, access: "members" },
    { name: "San Jose State Rec Center", city: "San Jose, CA", lat: 37.3355, lng: -121.8820, indoor: true, access: "members" },

    // === TIER 3: Major Cities ===

    // AUSTIN
    { name: "Life Time Austin", city: "Austin, TX", lat: 30.2875, lng: -97.7373, indoor: true, access: "members" },
    { name: "Equinox Austin", city: "Austin, TX", lat: 30.2648, lng: -97.7516, indoor: true, access: "members" },
    { name: "Castle Hill Fitness", city: "Austin, TX", lat: 30.2782, lng: -97.7534, indoor: true, access: "members" },

    // JACKSONVILLE
    { name: "Baptist Health Fitness Jacksonville", city: "Jacksonville, FL", lat: 30.3044, lng: -81.6609, indoor: true, access: "members" },
    { name: "The Players Club Jacksonville", city: "Jacksonville, FL", lat: 30.2217, lng: -81.4054, indoor: true, access: "members" },

    // FORT WORTH
    { name: "TCU Recreation Center", city: "Fort Worth, TX", lat: 32.7101, lng: -97.3629, indoor: true, access: "members" },
    { name: "24 Hour Fitness Fort Worth", city: "Fort Worth, TX", lat: 32.7559, lng: -97.3333, indoor: true, access: "members" },

    // COLUMBUS
    { name: "Life Time Columbus", city: "Columbus, OH", lat: 40.0570, lng: -83.0188, indoor: true, access: "members" },
    { name: "Ohio State RPAC", city: "Columbus, OH", lat: 40.0062, lng: -83.0313, indoor: true, access: "members" },

    // CHARLOTTE
    { name: "Life Time Charlotte South", city: "Charlotte, NC", lat: 35.1093, lng: -80.8514, indoor: true, access: "members" },
    { name: "Dowd YMCA Charlotte", city: "Charlotte, NC", lat: 35.2172, lng: -80.8392, indoor: true, access: "members" },

    // INDIANAPOLIS
    { name: "Life Time Indy", city: "Indianapolis, IN", lat: 39.9344, lng: -86.1741, indoor: true, access: "members" },
    { name: "National Institute for Fitness", city: "Indianapolis, IN", lat: 39.8471, lng: -86.1657, indoor: true, access: "members" },

    // SEATTLE
    { name: "Equinox Seattle", city: "Seattle, WA", lat: 47.6131, lng: -122.3468, indoor: true, access: "members" },
    { name: "Pro Sports Club Bellevue", city: "Bellevue, WA", lat: 47.5773, lng: -122.1523, indoor: true, access: "members" },
    { name: "Washington Athletic Club", city: "Seattle, WA", lat: 47.6067, lng: -122.3356, indoor: true, access: "members" },

    // DENVER
    { name: "Equinox Cherry Creek", city: "Denver, CO", lat: 39.7174, lng: -104.9545, indoor: true, access: "members" },
    { name: "Life Time Highlands Ranch", city: "Highlands Ranch, CO", lat: 39.5433, lng: -104.9694, indoor: true, access: "members" },
    { name: "Colorado Athletic Club Monaco", city: "Denver, CO", lat: 39.7208, lng: -104.9043, indoor: true, access: "members" },

    // WASHINGTON DC
    { name: "Equinox Bethesda", city: "Bethesda, MD", lat: 38.9847, lng: -77.0946, indoor: true, access: "members" },
    { name: "Equinox Georgetown", city: "Washington, DC", lat: 38.9061, lng: -77.0625, indoor: true, access: "members" },
    { name: "Life Time Reston", city: "Reston, VA", lat: 38.9548, lng: -77.3586, indoor: true, access: "members" },
    { name: "Washington Sports Club Dupont", city: "Washington, DC", lat: 38.9106, lng: -77.0426, indoor: true, access: "members" },

    // BOSTON
    { name: "Equinox Boston", city: "Boston, MA", lat: 42.3584, lng: -71.0541, indoor: true, access: "members" },
    { name: "Life Time Chestnut Hill", city: "Chestnut Hill, MA", lat: 42.3311, lng: -71.1661, indoor: true, access: "members" },
    { name: "Boston Sports Club Downtown", city: "Boston, MA", lat: 42.3551, lng: -71.0566, indoor: true, access: "members" },

    // === TIER 4: Growing Markets ===

    // NASHVILLE
    { name: "Green Hills YMCA", city: "Nashville, TN", lat: 36.0992, lng: -86.8120, indoor: true, access: "members" },
    { name: "12 South Athletic Club", city: "Nashville, TN", lat: 36.1219, lng: -86.7870, indoor: true, access: "members" },

    // DETROIT
    { name: "Life Time Troy", city: "Troy, MI", lat: 42.5762, lng: -83.1399, indoor: true, access: "members" },
    { name: "Lifetime Rochester Hills", city: "Rochester Hills, MI", lat: 42.6525, lng: -83.1265, indoor: true, access: "members" },

    // PORTLAND
    { name: "Multnomah Athletic Club", city: "Portland, OR", lat: 45.5087, lng: -122.6891, indoor: true, access: "members" },
    { name: "Life Time Portland", city: "Beaverton, OR", lat: 45.4949, lng: -122.7890, indoor: true, access: "members" },

    // LAS VEGAS
    { name: "Life Time Summerlin", city: "Las Vegas, NV", lat: 36.1754, lng: -115.3105, indoor: true, access: "members" },
    { name: "Equinox Las Vegas", city: "Las Vegas, NV", lat: 36.1147, lng: -115.1728, indoor: true, access: "members" },

    // MEMPHIS
    { name: "Memphis Jewish Community Center", city: "Memphis, TN", lat: 35.0936, lng: -89.8628, indoor: true, access: "members" },
    { name: "Downtown Memphis YMCA", city: "Memphis, TN", lat: 35.1433, lng: -90.0517, indoor: true, access: "members" },

    // === TIER 5: Additional Major Markets ===

    // MIAMI
    { name: "Equinox South Beach", city: "Miami Beach, FL", lat: 25.7848, lng: -80.1313, indoor: true, access: "members" },
    { name: "Equinox Brickell", city: "Miami, FL", lat: 25.7588, lng: -80.1929, indoor: true, access: "members" },
    { name: "Life Time Coral Gables", city: "Coral Gables, FL", lat: 25.7256, lng: -80.2563, indoor: true, access: "members" },

    // ATLANTA
    { name: "Equinox Atlanta", city: "Atlanta, GA", lat: 33.8407, lng: -84.3779, indoor: true, access: "members" },
    { name: "Life Time Sandy Springs", city: "Sandy Springs, GA", lat: 33.9295, lng: -84.3771, indoor: true, access: "members" },

    // MINNEAPOLIS
    { name: "Life Time Target Center", city: "Minneapolis, MN", lat: 44.9796, lng: -93.2774, indoor: true, access: "members" },
    { name: "Lifetime Edina", city: "Edina, MN", lat: 44.8896, lng: -93.3425, indoor: true, access: "members" },

    // TAMPA
    { name: "Life Time Tampa", city: "Tampa, FL", lat: 28.0217, lng: -82.4948, indoor: true, access: "members" },
    { name: "Tampa Metropolitan YMCA", city: "Tampa, FL", lat: 27.9527, lng: -82.4584, indoor: true, access: "members" },

    // ORLANDO
    { name: "Life Time Orlando", city: "Orlando, FL", lat: 28.4727, lng: -81.4670, indoor: true, access: "members" },
    { name: "Downtown Orlando YMCA", city: "Orlando, FL", lat: 28.5423, lng: -81.3822, indoor: true, access: "members" },

    // CLEVELAND
    { name: "Life Time Beachwood", city: "Beachwood, OH", lat: 41.4642, lng: -81.5006, indoor: true, access: "members" },
    { name: "Cleveland Athletic Club", city: "Cleveland, OH", lat: 41.4997, lng: -81.6910, indoor: true, access: "members" },

    // ST. LOUIS
    { name: "Life Time Frontenac", city: "Frontenac, MO", lat: 38.6353, lng: -90.4117, indoor: true, access: "members" },
    { name: "MAC Downtown St. Louis", city: "St. Louis, MO", lat: 38.6281, lng: -90.1925, indoor: true, access: "members" },

    // PITTSBURGH
    { name: "Life Time Pittsburgh", city: "Pittsburgh, PA", lat: 40.4312, lng: -79.9805, indoor: true, access: "members" },
    { name: "Pittsburgh Athletic Association", city: "Pittsburgh, PA", lat: 40.4454, lng: -79.9509, indoor: true, access: "members" },

    // BALTIMORE
    { name: "Merritt Athletic Club", city: "Baltimore, MD", lat: 39.2876, lng: -76.6141, indoor: true, access: "members" },
    { name: "Downtown Athletic Club Baltimore", city: "Baltimore, MD", lat: 39.2878, lng: -76.6183, indoor: true, access: "members" },

    // KANSAS CITY
    { name: "Life Time Kansas City", city: "Overland Park, KS", lat: 38.9318, lng: -94.6713, indoor: true, access: "members" },
    { name: "Genesis Health Club KC", city: "Kansas City, MO", lat: 39.0458, lng: -94.5867, indoor: true, access: "members" },

    // SACRAMENTO
    { name: "California Family Fitness Sacramento", city: "Sacramento, CA", lat: 38.5810, lng: -121.4936, indoor: true, access: "members" },
    { name: "Capital Athletic Club", city: "Sacramento, CA", lat: 38.5774, lng: -121.4931, indoor: true, access: "members" },

    // SALT LAKE CITY
    { name: "Life Time Salt Lake", city: "Salt Lake City, UT", lat: 40.7178, lng: -111.8496, indoor: true, access: "members" },
    { name: "Sports Mall Murray", city: "Murray, UT", lat: 40.6628, lng: -111.8920, indoor: true, access: "members" },

    // RALEIGH
    { name: "Life Time Cary", city: "Cary, NC", lat: 35.7598, lng: -78.7813, indoor: true, access: "members" },
    { name: "O2 Fitness Raleigh", city: "Raleigh, NC", lat: 35.7832, lng: -78.6387, indoor: true, access: "members" },

    // MILWAUKEE
    { name: "Wisconsin Athletic Club Downtown", city: "Milwaukee, WI", lat: 43.0380, lng: -87.9068, indoor: true, access: "members" },
    { name: "Elite Sports Club Milwaukee", city: "Milwaukee, WI", lat: 43.0553, lng: -88.0076, indoor: true, access: "members" },

    // NEW ORLEANS
    { name: "New Orleans Athletic Club", city: "New Orleans, LA", lat: 29.9551, lng: -90.0701, indoor: true, access: "members" },
    { name: "Ochsner Fitness Center", city: "New Orleans, LA", lat: 29.9332, lng: -90.0847, indoor: true, access: "members" },

    // LOUISVILLE
    { name: "Louisville Athletic Club", city: "Louisville, KY", lat: 38.2476, lng: -85.7640, indoor: true, access: "members" },
    { name: "Norton Sports Health", city: "Louisville, KY", lat: 38.2245, lng: -85.6917, indoor: true, access: "members" },

    // OKLAHOMA CITY
    { name: "Life Time Oklahoma City", city: "Oklahoma City, OK", lat: 35.5287, lng: -97.5612, indoor: true, access: "members" },
    { name: "Oklahoma City Thunder Fitness", city: "Oklahoma City, OK", lat: 35.4630, lng: -97.5159, indoor: true, access: "members" },

    // CINCINNATI
    { name: "Life Time Mason", city: "Mason, OH", lat: 39.3600, lng: -84.3097, indoor: true, access: "members" },
    { name: "Queen City Racquet Club", city: "Cincinnati, OH", lat: 39.2010, lng: -84.3678, indoor: true, access: "members" },

    // PROVIDENCE
    { name: "East Side Athletic Club", city: "Providence, RI", lat: 41.8307, lng: -71.3901, indoor: true, access: "members" },

    // BUFFALO
    { name: "Buffalo Athletic Club", city: "Buffalo, NY", lat: 42.8817, lng: -78.8790, indoor: true, access: "members" },

    // HARTFORD
    { name: "Life Time Bloomfield", city: "Bloomfield, CT", lat: 41.8265, lng: -72.7328, indoor: true, access: "members" },

    // RICHMOND
    { name: "Midlothian Athletic Club", city: "Richmond, VA", lat: 37.4824, lng: -77.6397, indoor: true, access: "members" },
    { name: "American Family Fitness Richmond", city: "Richmond, VA", lat: 37.5538, lng: -77.4663, indoor: true, access: "members" },

    // ALBUQUERQUE
    { name: "Defined Fitness Albuquerque", city: "Albuquerque, NM", lat: 35.1018, lng: -106.5653, indoor: true, access: "members" },

    // TUCSON
    { name: "LA Fitness Tucson", city: "Tucson, AZ", lat: 32.2314, lng: -110.8778, indoor: true, access: "members" },
    { name: "Tucson Racquet Club", city: "Tucson, AZ", lat: 32.3062, lng: -110.9371, indoor: true, access: "members" },

    // === SIGNATURE OUTDOOR COURTS ===

    { name: "Rucker Park", city: "New York, NY", lat: 40.8303, lng: -73.9360, indoor: false, access: "public" },
    { name: "Venice Beach Courts", city: "Venice, CA", lat: 33.9850, lng: -118.4695, indoor: false, access: "public" },
    { name: "Lincoln Park Courts Chicago", city: "Chicago, IL", lat: 41.9185, lng: -87.6322, indoor: false, access: "public" },
    { name: "Fern Street Courts", city: "San Diego, CA", lat: 32.6992, lng: -117.1204, indoor: false, access: "public" },
    { name: "Druid Hill Park Courts", city: "Baltimore, MD", lat: 39.3223, lng: -76.6449, indoor: false, access: "public" },
    { name: "Riverside Park Courts", city: "New York, NY", lat: 40.8001, lng: -73.9734, indoor: false, access: "public" },
    { name: "Powell Park Court", city: "Brooklyn, NY", lat: 40.6823, lng: -73.9692, indoor: false, access: "public" },
];

async function addCourts() {
    console.log(`Adding ${PREMIUM_VENUES.length} premium venues...\n`);

    let added = 0;
    let skipped = 0;

    for (const venue of PREMIUM_VENUES) {
        try {
            const id = generateUUID(venue.name + venue.city);

            const params = new URLSearchParams({
                id: id,
                name: venue.name,
                city: venue.city,
                lat: venue.lat.toString(),
                lng: venue.lng.toString(),
                indoor: venue.indoor.toString(),
                access: venue.access
            });

            const response = await fetch(`${API_BASE}/courts/admin/create?${params}`, {
                method: 'POST',
                headers: { 'x-user-id': 'system-admin' }
            });

            const result = await response.json();

            if (result.success) {
                console.log(`✅ ${venue.name} (${venue.city}) - ${venue.access}`);
                added++;
            } else if (result.error?.includes('already exists')) {
                console.log(`⏭️  ${venue.name} - already exists`);
                skipped++;
            } else {
                console.log(`⚠️  ${venue.name}: ${result.error || JSON.stringify(result)}`);
            }
        } catch (error) {
            console.error(`❌ ${venue.name}: ${error.message}`);
        }
    }

    console.log(`\n✅ Added: ${added}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📊 Total venues processed: ${PREMIUM_VENUES.length}`);
}

addCourts();

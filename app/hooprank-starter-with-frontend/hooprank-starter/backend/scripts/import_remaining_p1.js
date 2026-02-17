/**
 * Indoor Courts Import — Remaining US Cities Part 1
 * Covers: Boston, Washington DC, Miami, Tampa, Orlando, Minneapolis, 
 * St. Louis, Baltimore, San Diego, San Jose/Bay Area, San Antonio, Austin
 */
const https = require('https');
const crypto = require('crypto');
const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const UID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

function uuid(n) { const h = crypto.createHash('md5').update(n).digest('hex'); return h.substr(0, 8) + '-' + h.substr(8, 4) + '-' + h.substr(12, 4) + '-' + h.substr(16, 4) + '-' + h.substr(20, 12); }
function post(court) {
    return new Promise((resolve, reject) => {
        const id = uuid(court.name + court.city);
        const p = new URLSearchParams({ id, name: court.name, city: court.city, lat: String(court.lat), lng: String(court.lng), indoor: 'true', access: court.access || 'public' });
        const opts = { hostname: BASE, path: '/courts/admin/create?' + p.toString(), method: 'POST', headers: { 'x-user-id': UID }, timeout: 10000 };
        const req = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ s: res.statusCode })); });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
    });
}

const ALL = {
    'Boston': [
        { name: "YMCA of Greater Boston", city: "Boston, MA", lat: 42.3519, lng: -71.0682, access: "members" },
        { name: "Roxbury YMCA", city: "Boston, MA", lat: 42.3295, lng: -71.0843, access: "members" },
        { name: "Wang YMCA Chinatown", city: "Boston, MA", lat: 42.3512, lng: -71.0619, access: "members" },
        { name: "Huntington Avenue YMCA", city: "Boston, MA", lat: 42.3428, lng: -71.0875, access: "members" },
        { name: "Dorchester House YMCA", city: "Boston, MA", lat: 42.3177, lng: -71.0527, access: "members" },
        { name: "Equinox Boston", city: "Boston, MA", lat: 42.3584, lng: -71.0541, access: "members" },
        { name: "Life Time Chestnut Hill", city: "Chestnut Hill, MA", lat: 42.3311, lng: -71.1661, access: "members" },
        { name: "Boston Sports Club Downtown", city: "Boston, MA", lat: 42.3551, lng: -71.0566, access: "members" },
        { name: "MIT Zesiger Sports Center", city: "Cambridge, MA", lat: 42.3573, lng: -71.0956, access: "members" },
        { name: "Harvard Malkin Athletic Center", city: "Cambridge, MA", lat: 42.3720, lng: -71.1175, access: "members" },
        { name: "Boston Centers for Youth & Families Vine Street", city: "Boston, MA", lat: 42.3276, lng: -71.0845, access: "public" },
        { name: "BCYF Paris Street Community Center", city: "Boston, MA", lat: 42.3750, lng: -71.0352, access: "public" },
        { name: "BCYF Tobin Community Center", city: "Boston, MA", lat: 42.3283, lng: -71.0839, access: "public" },
        { name: "BCYF Hyde Park Community Center", city: "Boston, MA", lat: 42.2554, lng: -71.1246, access: "public" },
    ],
    'Washington DC': [
        { name: "Equinox Georgetown", city: "Washington, DC", lat: 38.9061, lng: -77.0625, access: "members" },
        { name: "Equinox Bethesda", city: "Bethesda, MD", lat: 38.9847, lng: -77.0946, access: "members" },
        { name: "Life Time Reston", city: "Reston, VA", lat: 38.9548, lng: -77.3586, access: "members" },
        { name: "Washington Athletic Club DC", city: "Washington, DC", lat: 38.9050, lng: -77.0365, access: "members" },
        { name: "Turkey Thicket Recreation Center", city: "Washington, DC", lat: 38.9284, lng: -76.9903, access: "public" },
        { name: "Deanwood Recreation Center", city: "Washington, DC", lat: 38.9039, lng: -76.9355, access: "public" },
        { name: "Takoma Recreation Center", city: "Washington, DC", lat: 38.9588, lng: -77.0148, access: "public" },
        { name: "Barry Farms Recreation Center", city: "Washington, DC", lat: 38.8562, lng: -76.9884, access: "public" },
        { name: "Benning Stoddert Recreation Center", city: "Washington, DC", lat: 38.8764, lng: -76.9572, access: "public" },
        { name: "Ferebee-Hope Recreation Center", city: "Washington, DC", lat: 38.8431, lng: -76.9951, access: "public" },
        { name: "Fort Davis Recreation Center", city: "Washington, DC", lat: 38.8649, lng: -76.9508, access: "public" },
        { name: "YMCA Anthony Bowen", city: "Washington, DC", lat: 38.9065, lng: -77.0222, access: "members" },
    ],
    'Miami': [
        { name: "Equinox South Beach", city: "Miami Beach, FL", lat: 25.7848, lng: -80.1313, access: "members" },
        { name: "Equinox Brickell", city: "Miami, FL", lat: 25.7588, lng: -80.1929, access: "members" },
        { name: "Life Time Coral Gables", city: "Coral Gables, FL", lat: 25.7256, lng: -80.2563, access: "members" },
        { name: "Overtown Youth Center", city: "Miami, FL", lat: 25.7842, lng: -80.2022, access: "public" },
        { name: "Gwen Cherry Park Community Center", city: "Miami, FL", lat: 25.8233, lng: -80.2193, access: "public" },
        { name: "Hadley Park Community Center", city: "Miami, FL", lat: 25.8145, lng: -80.2268, access: "public" },
        { name: "Shenandoah Park Community Center", city: "Miami, FL", lat: 25.7561, lng: -80.2289, access: "public" },
        { name: "Jose Marti Park Gym", city: "Miami, FL", lat: 25.7645, lng: -80.2338, access: "public" },
        { name: "YMCA Greater Miami Downtown", city: "Miami, FL", lat: 25.7714, lng: -80.1883, access: "members" },
        { name: "24 Hour Fitness Doral", city: "Doral, FL", lat: 25.8119, lng: -80.3389, access: "members" },
    ],
    'Tampa': [
        { name: "Life Time Tampa", city: "Tampa, FL", lat: 28.0217, lng: -82.4948, access: "members" },
        { name: "LA Fitness Tampa Westchase", city: "Tampa, FL", lat: 28.0609, lng: -82.5985, access: "members" },
        { name: "Cyrus Greene Community Center", city: "Tampa, FL", lat: 27.9597, lng: -82.4647, access: "public" },
        { name: "Jackson Heights Community Center", city: "Tampa, FL", lat: 27.9821, lng: -82.4457, access: "public" },
        { name: "Copeland Park Community Center", city: "Tampa, FL", lat: 27.9713, lng: -82.4825, access: "public" },
        { name: "Northwest Recreation Complex", city: "Tampa, FL", lat: 28.0224, lng: -82.4930, access: "public" },
        { name: "Bob Martinez Sports Center", city: "Tampa, FL", lat: 27.9683, lng: -82.5024, access: "public" },
        { name: "USF Recreation Center", city: "Tampa, FL", lat: 28.0649, lng: -82.4173, access: "members" },
    ],
    'Orlando': [
        { name: "Life Time Orlando", city: "Orlando, FL", lat: 28.4727, lng: -81.4670, access: "members" },
        { name: "Dover Shores Community Center", city: "Orlando, FL", lat: 28.5225, lng: -81.3413, access: "public" },
        { name: "Callahan Neighborhood Center", city: "Orlando, FL", lat: 28.5580, lng: -81.3994, access: "public" },
        { name: "John H. Jackson Community Center", city: "Orlando, FL", lat: 28.5499, lng: -81.3901, access: "public" },
        { name: "Englewood Neighborhood Center", city: "Orlando, FL", lat: 28.4959, lng: -81.3782, access: "public" },
        { name: "Meadow Woods Recreation Center", city: "Orlando, FL", lat: 28.4173, lng: -81.3660, access: "public" },
        { name: "YMCA Central Florida Downtown", city: "Orlando, FL", lat: 28.5380, lng: -81.3796, access: "members" },
        { name: "UCF Recreation Center", city: "Orlando, FL", lat: 28.6019, lng: -81.2002, access: "members" },
    ],
    'Minneapolis': [
        { name: "Life Time Target Center", city: "Minneapolis, MN", lat: 44.9796, lng: -93.2774, access: "members" },
        { name: "YMCA Downtown Minneapolis", city: "Minneapolis, MN", lat: 44.9755, lng: -93.2695, access: "members" },
        { name: "Blaisdell YMCA", city: "Minneapolis, MN", lat: 44.9562, lng: -93.2776, access: "members" },
        { name: "North Commons Recreation Center", city: "Minneapolis, MN", lat: 45.0017, lng: -93.2990, access: "public" },
        { name: "Phillips Community Center", city: "Minneapolis, MN", lat: 44.9604, lng: -93.2607, access: "public" },
        { name: "Peavey Park Recreation Center", city: "Minneapolis, MN", lat: 44.9581, lng: -93.2634, access: "public" },
        { name: "Harrison Park Recreation Center", city: "Minneapolis, MN", lat: 44.9787, lng: -93.3050, access: "public" },
        { name: "Folwell Park Recreation Center", city: "Minneapolis, MN", lat: 45.0204, lng: -93.3073, access: "public" },
        { name: "East Phillips Park Cultural Center", city: "Minneapolis, MN", lat: 44.9533, lng: -93.2563, access: "public" },
        { name: "University of Minnesota Recreation Center", city: "Minneapolis, MN", lat: 44.9734, lng: -93.2318, access: "members" },
    ],
    'St. Louis': [
        { name: "Life Time Frontenac", city: "Frontenac, MO", lat: 38.6353, lng: -90.4117, access: "members" },
        { name: "Mathews-Dickey Boys Club", city: "St. Louis, MO", lat: 38.6649, lng: -90.2324, access: "public" },
        { name: "YMCA Downtown St. Louis", city: "St. Louis, MO", lat: 38.6322, lng: -90.1948, access: "members" },
        { name: "Carondelet Park Recreation Complex", city: "St. Louis, MO", lat: 38.5689, lng: -90.2592, access: "public" },
        { name: "Herbert Hoover Boys & Girls Club", city: "St. Louis, MO", lat: 38.6399, lng: -90.2125, access: "public" },
        { name: "O'Fallon Park Recreation Center", city: "St. Louis, MO", lat: 38.6647, lng: -90.2150, access: "public" },
        { name: "Wohl Recreation Center", city: "St. Louis, MO", lat: 38.6475, lng: -90.2618, access: "public" },
        { name: "SLU Simon Recreation Center", city: "St. Louis, MO", lat: 38.6352, lng: -90.2320, access: "members" },
    ],
    'Baltimore': [
        { name: "Merritt Athletic Club", city: "Baltimore, MD", lat: 39.2876, lng: -76.6141, access: "members" },
        { name: "YMCA Greater Baltimore Central", city: "Baltimore, MD", lat: 39.2948, lng: -76.6147, access: "members" },
        { name: "Druid Hill Park Pool & Recreation", city: "Baltimore, MD", lat: 39.3223, lng: -76.6449, access: "public" },
        { name: "Cecil Kirk Recreation Center", city: "Baltimore, MD", lat: 39.3038, lng: -76.6366, access: "public" },
        { name: "Morrell Park Recreation Center", city: "Baltimore, MD", lat: 39.2602, lng: -76.6601, access: "public" },
        { name: "Northwood Recreation Center", city: "Baltimore, MD", lat: 39.3491, lng: -76.5917, access: "public" },
        { name: "Patterson Park Recreation Center", city: "Baltimore, MD", lat: 39.2911, lng: -76.5839, access: "public" },
        { name: "Cherry Hill Community Center", city: "Baltimore, MD", lat: 39.2454, lng: -76.6338, access: "public" },
    ],
    'San Diego': [
        { name: "Equinox La Jolla", city: "La Jolla, CA", lat: 32.8631, lng: -117.2526, access: "members" },
        { name: "24 Hour Fitness San Diego Sport", city: "San Diego, CA", lat: 32.7474, lng: -117.1648, access: "members" },
        { name: "City Heights Recreation Center", city: "San Diego, CA", lat: 32.7499, lng: -117.0994, access: "public" },
        { name: "Colina Del Sol Recreation Center", city: "San Diego, CA", lat: 32.7633, lng: -117.0870, access: "public" },
        { name: "Golden Hill Recreation Center", city: "San Diego, CA", lat: 32.7214, lng: -117.1374, access: "public" },
        { name: "Memorial Recreation Center", city: "San Diego, CA", lat: 32.7185, lng: -117.1618, access: "public" },
        { name: "Mountain View Recreation Center", city: "San Diego, CA", lat: 32.7025, lng: -117.1015, access: "public" },
        { name: "North Park Recreation Center", city: "San Diego, CA", lat: 32.7444, lng: -117.1315, access: "public" },
        { name: "Skyline Hills Recreation Center", city: "San Diego, CA", lat: 32.6920, lng: -117.0449, access: "public" },
        { name: "YMCA Mission Valley", city: "San Diego, CA", lat: 32.7684, lng: -117.1543, access: "members" },
    ],
    'Bay Area': [
        { name: "Berkeley YMCA", city: "Berkeley, CA", lat: 42.3697, lng: -71.1095, access: "members" },
        { name: "Oakland YMCA", city: "Oakland, CA", lat: 37.8086, lng: -122.2666, access: "members" },
        { name: "24 Hour Fitness Downtown San Jose", city: "San Jose, CA", lat: 37.3359, lng: -121.8914, access: "members" },
        { name: "San Jose YMCA", city: "San Jose, CA", lat: 37.3375, lng: -121.8862, access: "members" },
        { name: "Rainbow Recreation Center", city: "Oakland, CA", lat: 37.7747, lng: -122.1896, access: "public" },
        { name: "Bushrod Recreation Center", city: "Oakland, CA", lat: 37.8454, lng: -122.2622, access: "public" },
        { name: "Live Oak Recreation Center", city: "Oakland, CA", lat: 37.7729, lng: -122.1736, access: "public" },
        { name: "Fremont Family Resource Center", city: "Fremont, CA", lat: 37.5568, lng: -121.9843, access: "public" },
        { name: "Palo Alto Family YMCA", city: "Palo Alto, CA", lat: 37.4419, lng: -122.1430, access: "members" },
        { name: "Bay Club Redwood Shores", city: "Redwood City, CA", lat: 37.5324, lng: -122.2442, access: "members" },
    ],
    'San Antonio': [
        { name: "Life Time San Antonio", city: "San Antonio, TX", lat: 29.5499, lng: -98.5691, access: "members" },
        { name: "Gold's Gym San Antonio", city: "San Antonio, TX", lat: 29.4614, lng: -98.5116, access: "members" },
        { name: "Normoyle Community Center", city: "San Antonio, TX", lat: 29.3635, lng: -98.5226, access: "public" },
        { name: "Lincoln Community Center", city: "San Antonio, TX", lat: 29.4357, lng: -98.4633, access: "public" },
        { name: "Claude Black Community Center", city: "San Antonio, TX", lat: 29.4465, lng: -98.4668, access: "public" },
        { name: "Woodlawn Gym", city: "San Antonio, TX", lat: 29.4577, lng: -98.5152, access: "public" },
        { name: "YMCA Greater San Antonio Downtown", city: "San Antonio, TX", lat: 29.4310, lng: -98.4907, access: "members" },
        { name: "Converse Community Center", city: "Converse, TX", lat: 29.5170, lng: -98.3171, access: "public" },
    ],
    'Austin': [
        { name: "Life Time Austin", city: "Austin, TX", lat: 30.2875, lng: -97.7373, access: "members" },
        { name: "Equinox Austin", city: "Austin, TX", lat: 30.2648, lng: -97.7516, access: "members" },
        { name: "Castle Hill Fitness", city: "Austin, TX", lat: 30.2782, lng: -97.7534, access: "members" },
        { name: "Givens Recreation Center", city: "Austin, TX", lat: 30.2619, lng: -97.7142, access: "public" },
        { name: "Dottie Jordan Recreation Center", city: "Austin, TX", lat: 30.3119, lng: -97.6963, access: "public" },
        { name: "Dove Springs Recreation Center", city: "Austin, TX", lat: 30.2004, lng: -97.7339, access: "public" },
        { name: "Gus Garcia Recreation Center", city: "Austin, TX", lat: 30.3517, lng: -97.6753, access: "public" },
        { name: "Northwest Recreation Center", city: "Austin, TX", lat: 30.3679, lng: -97.7443, access: "public" },
        { name: "UT Gregory Gym", city: "Austin, TX", lat: 30.2841, lng: -97.7324, access: "members" },
        { name: "YMCA TownLake Austin", city: "Austin, TX", lat: 30.2616, lng: -97.7500, access: "members" },
    ],
};

async function main() {
    const cities = Object.keys(ALL);
    const total = cities.reduce((s, c) => s + ALL[c].length, 0);
    console.log(`\n=== PART 1: ${cities.length} CITIES, ${total} COURTS ===\n`);
    let ok = 0, fail = 0;
    for (const city of cities) {
        const courts = ALL[city];
        console.log(`📍 ${city} (${courts.length})`);
        for (const c of courts) {
            try { const r = await post(c); console.log(`  ✅ ${c.name}`); ok++; }
            catch (e) { console.log(`  ❌ ${c.name}: ${e.message}`); fail++; }
        }
    }
    console.log(`\nPART 1 DONE: ${ok} ok, ${fail} failed\n`);
}
main();

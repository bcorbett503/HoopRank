/**
 * 50k+ Cities Import — Part 3: Midwest & Northeast
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
    // ===== MIDWEST =====
    'Wichita, KS': [
        { name: "Orchard Recreation Center", city: "Wichita, KS", lat: 37.6821, lng: -97.3508, access: "public" },
        { name: "McAdams Recreation Center", city: "Wichita, KS", lat: 37.6991, lng: -97.3157, access: "public" },
        { name: "YMCA Downtown Wichita", city: "Wichita, KS", lat: 37.6876, lng: -97.3362, access: "members" },
    ],
    'Des Moines, IA': [
        { name: "Birdland Recreation Center", city: "Des Moines, IA", lat: 41.6213, lng: -93.5913, access: "public" },
        { name: "Evelyn K. Davis Center", city: "Des Moines, IA", lat: 41.5822, lng: -93.6402, access: "public" },
        { name: "YMCA Greater Des Moines", city: "Des Moines, IA", lat: 41.5868, lng: -93.6250, access: "members" },
    ],
    'Cedar Rapids, IA': [
        { name: "Ladd Library Recreation Center", city: "Cedar Rapids, IA", lat: 42.0138, lng: -91.6488, access: "public" },
        { name: "YMCA Cedar Rapids", city: "Cedar Rapids, IA", lat: 42.0035, lng: -91.6437, access: "members" },
    ],
    'Madison, WI': [
        { name: "Elver Park Shelter", city: "Madison, WI", lat: 43.0428, lng: -89.4636, access: "public" },
        { name: "Warner Park Community Center", city: "Madison, WI", lat: 43.1091, lng: -89.3713, access: "public" },
        { name: "YMCA Downtown Madison", city: "Madison, WI", lat: 43.0722, lng: -89.3856, access: "members" },
    ],
    'Springfield, IL': [
        { name: "Comer Cox Park Center", city: "Springfield, IL", lat: 39.7872, lng: -89.6368, access: "public" },
        { name: "YMCA Springfield", city: "Springfield, IL", lat: 39.7981, lng: -89.6540, access: "members" },
    ],
    'Aurora, IL': [
        { name: "Phillips Park Family Aquatic Center", city: "Aurora, IL", lat: 41.7537, lng: -88.2789, access: "public" },
        { name: "Vaughan Athletic Center", city: "Aurora, IL", lat: 41.7608, lng: -88.3205, access: "public" },
    ],
    'Naperville, IL': [
        { name: "Fort Hill Activity Center", city: "Naperville, IL", lat: 41.7624, lng: -88.1476, access: "public" },
        { name: "Naperville Park District Recreation Center", city: "Naperville, IL", lat: 41.7508, lng: -88.1535, access: "public" },
    ],
    'Joliet, IL': [
        { name: "Inwood Athletic Club", city: "Joliet, IL", lat: 41.5250, lng: -88.0834, access: "public" },
        { name: "Nowell Park Recreation Center", city: "Joliet, IL", lat: 41.5253, lng: -88.0976, access: "public" },
    ],
    'Rockford, IL': [
        { name: "Martin Luther King Center", city: "Rockford, IL", lat: 42.2775, lng: -89.0894, access: "public" },
        { name: "UW Health Sports Factory", city: "Rockford, IL", lat: 42.2722, lng: -89.1009, access: "members" },
    ],
    'Grand Rapids, MI': [
        { name: "Garfield Park Community Center", city: "Grand Rapids, MI", lat: 42.9356, lng: -85.6731, access: "public" },
        { name: "Kroc Center Grand Rapids", city: "Grand Rapids, MI", lat: 42.9448, lng: -85.6930, access: "public" },
        { name: "YMCA Grand Rapids", city: "Grand Rapids, MI", lat: 42.9625, lng: -85.6622, access: "members" },
    ],
    'Ann Arbor, MI': [
        { name: "Mack Indoor Pool & Gym", city: "Ann Arbor, MI", lat: 42.2654, lng: -83.7281, access: "public" },
        { name: "University of Michigan CCRB", city: "Ann Arbor, MI", lat: 42.2796, lng: -83.7422, access: "members" },
    ],
    'Lansing, MI': [
        { name: "Gier Park Community Center", city: "Lansing, MI", lat: 42.7108, lng: -84.5307, access: "public" },
        { name: "Foster Community Center", city: "Lansing, MI", lat: 42.7273, lng: -84.5601, access: "public" },
    ],
    'Toledo, OH': [
        { name: "Smith Park Recreation Center", city: "Toledo, OH", lat: 41.6618, lng: -83.5505, access: "public" },
        { name: "Savage Park Recreation Center", city: "Toledo, OH", lat: 41.6327, lng: -83.5779, access: "public" },
    ],
    'Akron, OH': [
        { name: "Ed Davis Community Center", city: "Akron, OH", lat: 41.0815, lng: -81.5260, access: "public" },
        { name: "LeBron James Family Foundation Community Center", city: "Akron, OH", lat: 41.0652, lng: -81.5110, access: "public" },
    ],
    'Dayton, OH': [
        { name: "Lohrey Recreation Center", city: "Dayton, OH", lat: 39.7545, lng: -84.2043, access: "public" },
        { name: "Kossuth Recreation Center", city: "Dayton, OH", lat: 39.7703, lng: -84.2161, access: "public" },
    ],
    'Sioux Falls, SD': [
        { name: "Midco Aquatic Center", city: "Sioux Falls, SD", lat: 43.5346, lng: -96.7467, access: "public" },
        { name: "YMCA Sioux Falls", city: "Sioux Falls, SD", lat: 43.5461, lng: -96.7313, access: "members" },
    ],
    'Lincoln, NE': [
        { name: "Belmont Recreation Center", city: "Lincoln, NE", lat: 40.8308, lng: -96.6647, access: "public" },
        { name: "YMCA Downtown Lincoln", city: "Lincoln, NE", lat: 40.8127, lng: -96.6993, access: "members" },
    ],
    // ===== MOUNTAIN WEST =====
    'Colorado Springs, CO': [
        { name: "Hillside Community Center", city: "Colorado Springs, CO", lat: 38.8199, lng: -104.8051, access: "public" },
        { name: "Deerfield Hills Community Center", city: "Colorado Springs, CO", lat: 38.7951, lng: -104.8181, access: "public" },
        { name: "YMCA Colorado Springs", city: "Colorado Springs, CO", lat: 38.8338, lng: -104.8255, access: "members" },
    ],
    'Boise, ID': [
        { name: "Fort Boise Community Center", city: "Boise, ID", lat: 43.6156, lng: -116.2114, access: "public" },
        { name: "South Boise Community Center", city: "Boise, ID", lat: 43.5791, lng: -116.1997, access: "public" },
        { name: "YMCA Downtown Boise", city: "Boise, ID", lat: 43.6172, lng: -116.2023, access: "members" },
    ],
    // ===== NORTHEAST =====
    'Newark, NJ': [
        { name: "Boylan Street Recreation Center", city: "Newark, NJ", lat: 40.7252, lng: -74.1975, access: "public" },
        { name: "Branch Brook Recreation Center", city: "Newark, NJ", lat: 40.7614, lng: -74.1714, access: "public" },
    ],
    'Jersey City, NJ': [
        { name: "Pershing Field Recreation Center", city: "Jersey City, NJ", lat: 40.7448, lng: -74.0562, access: "public" },
        { name: "Mary Benson Community Center", city: "Jersey City, NJ", lat: 40.7226, lng: -74.0685, access: "public" },
    ],
    'Paterson, NJ': [
        { name: "Wrigley Park Recreation Center", city: "Paterson, NJ", lat: 40.9148, lng: -74.1797, access: "public" },
    ],
    'Trenton, NJ': [
        { name: "Hetzel Field Community Center", city: "Trenton, NJ", lat: 40.2275, lng: -74.7582, access: "public" },
    ],
    'Stamford, CT': [
        { name: "Yerwood Center", city: "Stamford, CT", lat: 41.0564, lng: -73.5370, access: "public" },
        { name: "Chelsea Piers Stamford", city: "Stamford, CT", lat: 41.0547, lng: -73.5270, access: "members" },
    ],
    'New Haven, CT': [
        { name: "Trowbridge Community Center", city: "New Haven, CT", lat: 41.2978, lng: -72.9135, access: "public" },
        { name: "YMCA New Haven", city: "New Haven, CT", lat: 41.3072, lng: -72.9221, access: "members" },
    ],
    'Bridgeport, CT': [
        { name: "Cardinal Shehan Center", city: "Bridgeport, CT", lat: 41.1727, lng: -73.2010, access: "public" },
    ],
    'Worcester, MA': [
        { name: "Greendale Community Center", city: "Worcester, MA", lat: 42.2905, lng: -71.8097, access: "public" },
        { name: "YMCA Worcester Central", city: "Worcester, MA", lat: 42.2638, lng: -71.8018, access: "members" },
    ],
    'Springfield, MA': [
        { name: "Naismith Memorial Basketball Hall of Fame Courts", city: "Springfield, MA", lat: 42.0991, lng: -72.5913, access: "public" },
        { name: "Dunbar Community Center", city: "Springfield, MA", lat: 42.1093, lng: -72.5779, access: "public" },
    ],
    'Syracuse, NY': [
        { name: "Southwest Community Center", city: "Syracuse, NY", lat: 43.0352, lng: -76.1670, access: "public" },
        { name: "Beauchamp Branch Recreation Center", city: "Syracuse, NY", lat: 43.0502, lng: -76.1460, access: "public" },
    ],
    'Rochester, NY': [
        { name: "David F. Gantt Recreation Center", city: "Rochester, NY", lat: 43.1479, lng: -77.6236, access: "public" },
        { name: "Carter Street Recreation Center", city: "Rochester, NY", lat: 43.1629, lng: -77.5929, access: "public" },
    ],
    'Yonkers, NY': [
        { name: "Pelton Community Center", city: "Yonkers, NY", lat: 40.9316, lng: -73.8670, access: "public" },
        { name: "Nepperhan Community Center", city: "Yonkers, NY", lat: 40.9385, lng: -73.8756, access: "public" },
    ],
    'Albany, NY': [
        { name: "South End Community Center", city: "Albany, NY", lat: 42.6401, lng: -73.7586, access: "public" },
        { name: "West Hill Recreation Center", city: "Albany, NY", lat: 42.6716, lng: -73.7920, access: "public" },
    ],
    'Scranton, PA': [
        { name: "Weston Field Recreation Center", city: "Scranton, PA", lat: 41.4075, lng: -75.6705, access: "public" },
    ],
    'Allentown, PA': [
        { name: "Jordan Park Community Center", city: "Allentown, PA", lat: 40.6004, lng: -75.4794, access: "public" },
    ],
    'Wilmington, DE': [
        { name: "Hicks Anderson Community Center", city: "Wilmington, DE", lat: 39.7450, lng: -75.5507, access: "public" },
        { name: "Prices Run Community Center", city: "Wilmington, DE", lat: 39.7616, lng: -75.5676, access: "public" },
    ],
    // ===== MOUNTAIN / PLAINS =====
    'Tulsa, OK': [
        { name: "Whiteside Community Center", city: "Tulsa, OK", lat: 36.1361, lng: -95.9748, access: "public" },
        { name: "Reed Community Center", city: "Tulsa, OK", lat: 36.1247, lng: -95.9262, access: "public" },
        { name: "YMCA Downtown Tulsa", city: "Tulsa, OK", lat: 36.1510, lng: -95.9931, access: "members" },
    ],
};

async function main() {
    const cities = Object.keys(ALL);
    const total = cities.reduce((s, c) => s + ALL[c].length, 0);
    console.log(`\n=== 50K+ CITIES PART 3 (MIDWEST/NE): ${cities.length} CITIES, ${total} COURTS ===\n`);
    let ok = 0, fail = 0;
    for (const city of cities) {
        const courts = ALL[city];
        process.stdout.write(`📍 ${city} (${courts.length}): `);
        for (const c of courts) {
            try { await post(c); process.stdout.write('✅'); ok++; }
            catch (e) { process.stdout.write('❌'); fail++; }
        }
        console.log('');
    }
    console.log(`\nDONE: ${ok} ok, ${fail} failed of ${total}\n`);
}
main();

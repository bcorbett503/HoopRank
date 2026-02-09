/**
 * 50k+ Cities Import — Part 1: West Coast & Southwest
 * California, Oregon, Washington, Nevada, Arizona, Hawaii suburbs
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
    // ===== CALIFORNIA =====
    'San Rafael, CA': [
        { name: "San Rafael Community Center", city: "San Rafael, CA", lat: 37.9735, lng: -122.5310, access: "public" },
        { name: "Albert Park Recreation Center", city: "San Rafael, CA", lat: 37.9815, lng: -122.5120, access: "public" },
        { name: "Canal Alliance Community Center", city: "San Rafael, CA", lat: 37.9622, lng: -122.5082, access: "public" },
    ],
    'Novato, CA': [
        { name: "Novato Recreation Center", city: "Novato, CA", lat: 38.1074, lng: -122.5697, access: "public" },
        { name: "Hamilton Community Center", city: "Novato, CA", lat: 38.0654, lng: -122.5132, access: "public" },
    ],
    'Vallejo, CA': [
        { name: "Norman King Community Center", city: "Vallejo, CA", lat: 38.1073, lng: -122.2559, access: "public" },
        { name: "Vallejo Community Center", city: "Vallejo, CA", lat: 38.1046, lng: -122.2625, access: "public" },
    ],
    'Concord, CA': [
        { name: "Concord Community Center", city: "Concord, CA", lat: 37.9780, lng: -122.0312, access: "public" },
        { name: "24 Hour Fitness Concord", city: "Concord, CA", lat: 37.9758, lng: -122.0567, access: "members" },
    ],
    'Antioch, CA': [
        { name: "Antioch Community Center", city: "Antioch, CA", lat: 38.0049, lng: -121.8058, access: "public" },
        { name: "Prewett Family Park Gym", city: "Antioch, CA", lat: 37.9780, lng: -121.7745, access: "public" },
    ],
    'Richmond, CA': [
        { name: "Richmond Recreation Center", city: "Richmond, CA", lat: 37.9358, lng: -122.3477, access: "public" },
        { name: "Shield-Reid Community Center", city: "Richmond, CA", lat: 37.9456, lng: -122.3610, access: "public" },
    ],
    'Hayward, CA': [
        { name: "Matt Jimenez Community Center", city: "Hayward, CA", lat: 37.6688, lng: -122.0808, access: "public" },
        { name: "Hayward Area Recreation Center", city: "Hayward, CA", lat: 37.6711, lng: -122.0876, access: "public" },
    ],
    'Sunnyvale, CA': [
        { name: "Sunnyvale Community Center", city: "Sunnyvale, CA", lat: 37.3688, lng: -122.0363, access: "public" },
        { name: "Columbia Neighborhood Center", city: "Sunnyvale, CA", lat: 37.3525, lng: -122.0013, access: "public" },
    ],
    'Santa Clara, CA': [
        { name: "Santa Clara Recreation Center", city: "Santa Clara, CA", lat: 37.3541, lng: -121.9552, access: "public" },
        { name: "Life Time Santa Clara", city: "Santa Clara, CA", lat: 37.3727, lng: -121.9773, access: "members" },
    ],
    'Daly City, CA': [
        { name: "Doelger Senior Center Gym", city: "Daly City, CA", lat: 37.6879, lng: -122.4702, access: "public" },
        { name: "War Memorial Community Center", city: "Daly City, CA", lat: 37.6868, lng: -122.4666, access: "public" },
    ],
    'Santa Rosa, CA': [
        { name: "Finley Community Center", city: "Santa Rosa, CA", lat: 38.4384, lng: -122.7233, access: "public" },
        { name: "Southwest Community Park Gym", city: "Santa Rosa, CA", lat: 38.4214, lng: -122.7420, access: "public" },
        { name: "YMCA Santa Rosa", city: "Santa Rosa, CA", lat: 38.4501, lng: -122.7102, access: "members" },
    ],
    'Stockton, CA': [
        { name: "Cesar Chavez Community Center", city: "Stockton, CA", lat: 37.9539, lng: -121.2841, access: "public" },
        { name: "Stribley Community Center", city: "Stockton, CA", lat: 37.9697, lng: -121.3143, access: "public" },
        { name: "Arnold Rue Community Center", city: "Stockton, CA", lat: 37.9856, lng: -121.2762, access: "public" },
    ],
    'Modesto, CA': [
        { name: "Maddux Youth Center", city: "Modesto, CA", lat: 37.6328, lng: -120.9969, access: "public" },
        { name: "Martin Luther King Community Center", city: "Modesto, CA", lat: 37.6444, lng: -120.9818, access: "public" },
    ],
    'Bakersfield, CA': [
        { name: "MLK Jr Community Center", city: "Bakersfield, CA", lat: 35.3857, lng: -119.0073, access: "public" },
        { name: "Stiern Park Recreation Center", city: "Bakersfield, CA", lat: 35.3565, lng: -118.9847, access: "public" },
        { name: "YMCA Downtown Bakersfield", city: "Bakersfield, CA", lat: 35.3733, lng: -119.0187, access: "members" },
    ],
    'Riverside, CA': [
        { name: "Bobby Bonds Community Center", city: "Riverside, CA", lat: 33.9861, lng: -117.3708, access: "public" },
        { name: "Bordwell Park Community Center", city: "Riverside, CA", lat: 33.9700, lng: -117.3814, access: "public" },
        { name: "YMCA Riverside", city: "Riverside, CA", lat: 33.9817, lng: -117.3754, access: "members" },
    ],
    'San Bernardino, CA': [
        { name: "Ruben Campos Community Center", city: "San Bernardino, CA", lat: 34.1064, lng: -117.2973, access: "public" },
        { name: "Nunez Community Center", city: "San Bernardino, CA", lat: 34.1217, lng: -117.3003, access: "public" },
    ],
    'Irvine, CA': [
        { name: "Lakeview Senior Center Gym", city: "Irvine, CA", lat: 33.6912, lng: -117.7872, access: "public" },
        { name: "Los Olivos Community Center", city: "Irvine, CA", lat: 33.6696, lng: -117.7764, access: "public" },
        { name: "Life Time Laguna Niguel", city: "Laguna Niguel, CA", lat: 33.5367, lng: -117.7051, access: "members" },
    ],
    'Anaheim, CA': [
        { name: "Downtown Anaheim Community Center", city: "Anaheim, CA", lat: 33.8360, lng: -117.9126, access: "public" },
        { name: "Brookhurst Community Center", city: "Anaheim, CA", lat: 33.8203, lng: -117.9326, access: "public" },
    ],
    'Long Beach, CA': [
        { name: "Houghton Park Recreation Center", city: "Long Beach, CA", lat: 33.8820, lng: -118.1722, access: "public" },
        { name: "Martin Luther King Jr. Park", city: "Long Beach, CA", lat: 33.8634, lng: -118.1859, access: "public" },
        { name: "Silverado Park Recreation Center", city: "Long Beach, CA", lat: 33.8484, lng: -118.1918, access: "public" },
        { name: "YMCA Long Beach", city: "Long Beach, CA", lat: 33.7709, lng: -118.1932, access: "members" },
    ],
    'Pasadena, CA': [
        { name: "Robinson Park Recreation Center", city: "Pasadena, CA", lat: 34.1542, lng: -118.1383, access: "public" },
        { name: "Villa Parke Community Center", city: "Pasadena, CA", lat: 34.1383, lng: -118.1606, access: "public" },
    ],
    'Fresno, CA': [
        { name: "Dickey Recreation Center", city: "Fresno, CA", lat: 36.7507, lng: -119.7710, access: "public" },
        { name: "Pinedale Community Center", city: "Fresno, CA", lat: 36.7983, lng: -119.8091, access: "public" },
        { name: "Mary Ella Brown Community Center", city: "Fresno, CA", lat: 36.7374, lng: -119.8035, access: "public" },
        { name: "YMCA Fresno Central", city: "Fresno, CA", lat: 36.7468, lng: -119.7847, access: "members" },
    ],
    'Oxnard, CA': [
        { name: "South Oxnard Community Center", city: "Oxnard, CA", lat: 34.1771, lng: -119.1812, access: "public" },
        { name: "Wilson Park Community Center", city: "Oxnard, CA", lat: 34.2035, lng: -119.1812, access: "public" },
    ],
    'Visalia, CA': [
        { name: "Visalia Recreation Center", city: "Visalia, CA", lat: 36.3302, lng: -119.2921, access: "public" },
    ],
    'Elk Grove, CA': [
        { name: "Elk Grove Community Center", city: "Elk Grove, CA", lat: 38.4088, lng: -121.3716, access: "public" },
    ],
    // ===== OREGON & WASHINGTON SUBURBS =====
    'Eugene, OR': [
        { name: "Echo Hollow Pool & Fitness Center", city: "Eugene, OR", lat: 44.0666, lng: -123.1337, access: "public" },
        { name: "Sheldon Community Center", city: "Eugene, OR", lat: 44.0870, lng: -123.0319, access: "public" },
        { name: "Downtown Athletic Club Eugene", city: "Eugene, OR", lat: 44.0521, lng: -123.0868, access: "members" },
    ],
    'Salem, OR': [
        { name: "Kroc Community Center Salem", city: "Salem, OR", lat: 44.9356, lng: -123.0272, access: "public" },
        { name: "YMCA Salem", city: "Salem, OR", lat: 44.9440, lng: -123.0388, access: "members" },
    ],
    'Beaverton, OR': [
        { name: "Conestoga Recreation Center", city: "Beaverton, OR", lat: 45.4727, lng: -122.8345, access: "public" },
        { name: "24 Hour Fitness Beaverton", city: "Beaverton, OR", lat: 45.4864, lng: -122.8066, access: "members" },
    ],
    'Tacoma, WA': [
        { name: "People's Community Center", city: "Tacoma, WA", lat: 47.2398, lng: -122.4635, access: "public" },
        { name: "Eastside Community Center", city: "Tacoma, WA", lat: 47.2504, lng: -122.4208, access: "public" },
        { name: "STAR Center Tacoma", city: "Tacoma, WA", lat: 47.2477, lng: -122.4549, access: "public" },
    ],
    'Spokane, WA': [
        { name: "Northeast Community Center", city: "Spokane, WA", lat: 47.6856, lng: -117.3859, access: "public" },
        { name: "East Central Community Center", city: "Spokane, WA", lat: 47.6487, lng: -117.3864, access: "public" },
        { name: "YMCA Spokane Valley", city: "Spokane, WA", lat: 47.6573, lng: -117.2732, access: "members" },
    ],
    'Bellevue, WA': [
        { name: "Crossroads Community Center", city: "Bellevue, WA", lat: 47.6165, lng: -122.1260, access: "public" },
        { name: "Highland Community Center", city: "Bellevue, WA", lat: 47.6017, lng: -122.1634, access: "public" },
    ],
    'Kent, WA': [
        { name: "Kent Commons", city: "Kent, WA", lat: 47.3810, lng: -122.2349, access: "public" },
        { name: "Service Club Community Center", city: "Kent, WA", lat: 47.3868, lng: -122.2312, access: "public" },
    ],
    'Everett, WA': [
        { name: "Everett Community Center", city: "Everett, WA", lat: 47.9790, lng: -122.2024, access: "public" },
        { name: "YMCA Snohomish County", city: "Everett, WA", lat: 47.9773, lng: -122.2071, access: "members" },
    ],
    // ===== NEVADA =====
    'Reno, NV': [
        { name: "Evelyn Mount Northeast Community Center", city: "Reno, NV", lat: 39.5374, lng: -119.7794, access: "public" },
        { name: "Neil Road Recreation Center", city: "Reno, NV", lat: 39.4967, lng: -119.7771, access: "public" },
        { name: "YMCA Downtown Reno", city: "Reno, NV", lat: 39.5312, lng: -119.8138, access: "members" },
    ],
    'Henderson, NV': [
        { name: "Henderson Multigenerational Center", city: "Henderson, NV", lat: 36.0396, lng: -114.9817, access: "public" },
        { name: "Whitney Recreation Center Henderson", city: "Henderson, NV", lat: 36.0289, lng: -115.0614, access: "public" },
    ],
    'North Las Vegas, NV': [
        { name: "Silver Mesa Recreation Center", city: "North Las Vegas, NV", lat: 36.2262, lng: -115.1240, access: "public" },
        { name: "Neighborhood Recreation Center NLV", city: "North Las Vegas, NV", lat: 36.1986, lng: -115.1175, access: "public" },
    ],
    // ===== ARIZONA SUBURBS =====
    'Scottsdale, AZ': [
        { name: "Granite Reef Senior Center", city: "Scottsdale, AZ", lat: 33.4668, lng: -111.8868, access: "public" },
        { name: "Vista del Camino Park Center", city: "Scottsdale, AZ", lat: 33.4671, lng: -111.9201, access: "public" },
    ],
    'Gilbert, AZ': [
        { name: "McQueen Park Activity Center", city: "Gilbert, AZ", lat: 33.3528, lng: -111.8307, access: "public" },
        { name: "Gilbert Regional Park Gym", city: "Gilbert, AZ", lat: 33.3006, lng: -111.7553, access: "public" },
    ],
    'Surprise, AZ': [
        { name: "Surprise Recreation Campus Gym", city: "Surprise, AZ", lat: 33.6295, lng: -112.3321, access: "public" },
    ],
    'Peoria, AZ': [
        { name: "Peoria Community Center", city: "Peoria, AZ", lat: 33.5806, lng: -112.2373, access: "public" },
    ],
    'Goodyear, AZ': [
        { name: "Goodyear Community Center", city: "Goodyear, AZ", lat: 33.4475, lng: -112.3583, access: "public" },
    ],
    // ===== HAWAII =====
    'Kapolei, HI': [
        { name: "Kapolei Recreation Center", city: "Kapolei, HI", lat: 21.3381, lng: -158.0890, access: "public" },
    ],
    'Pearl City, HI': [
        { name: "Pearl City Recreation Center", city: "Pearl City, HI", lat: 21.3974, lng: -157.9730, access: "public" },
    ],
};

async function main() {
    const cities = Object.keys(ALL);
    const total = cities.reduce((s, c) => s + ALL[c].length, 0);
    console.log(`\n=== 50K+ CITIES PART 1 (WEST): ${cities.length} CITIES, ${total} COURTS ===\n`);
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

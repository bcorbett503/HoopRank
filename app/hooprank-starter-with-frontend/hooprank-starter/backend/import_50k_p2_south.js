/**
 * 50k+ Cities Import — Part 2: Texas & Florida suburbs + South
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
    // ===== TEXAS SUBURBS =====
    'El Paso, TX': [
        { name: "Galatzan Recreation Center", city: "El Paso, TX", lat: 31.7830, lng: -106.4450, access: "public" },
        { name: "Veterans Recreation Center", city: "El Paso, TX", lat: 31.7704, lng: -106.4512, access: "public" },
        { name: "Marty Robbins Recreation Center", city: "El Paso, TX", lat: 31.7280, lng: -106.3145, access: "public" },
        { name: "YMCA El Paso", city: "El Paso, TX", lat: 31.7587, lng: -106.4869, access: "members" },
    ],
    'Laredo, TX': [
        { name: "North Central Park Gym", city: "Laredo, TX", lat: 27.5625, lng: -99.4899, access: "public" },
        { name: "Cigarroa Recreation Center", city: "Laredo, TX", lat: 27.4936, lng: -99.5107, access: "public" },
    ],
    'Lubbock, TX': [
        { name: "Mae Simmons Community Center", city: "Lubbock, TX", lat: 33.5521, lng: -101.8315, access: "public" },
        { name: "YMCA Lubbock", city: "Lubbock, TX", lat: 33.5593, lng: -101.8442, access: "members" },
    ],
    'Corpus Christi, TX': [
        { name: "Lindale Park Recreation Center", city: "Corpus Christi, TX", lat: 27.7812, lng: -97.3981, access: "public" },
        { name: "Solomon Coles Community Center", city: "Corpus Christi, TX", lat: 27.7933, lng: -97.3913, access: "public" },
    ],
    'McKinney, TX': [
        { name: "Apex Centre", city: "McKinney, TX", lat: 33.1972, lng: -96.6397, access: "public" },
        { name: "McKinney Recreation Center", city: "McKinney, TX", lat: 33.2012, lng: -96.6152, access: "public" },
    ],
    'Frisco, TX': [
        { name: "Frisco Athletic Center", city: "Frisco, TX", lat: 33.1507, lng: -96.8236, access: "public" },
        { name: "Life Time Frisco", city: "Frisco, TX", lat: 33.1341, lng: -96.8040, access: "members" },
    ],
    'Round Rock, TX': [
        { name: "Clay Madsen Recreation Center", city: "Round Rock, TX", lat: 30.5065, lng: -97.6720, access: "public" },
    ],
    'Sugar Land, TX': [
        { name: "Sugar Land Community Center", city: "Sugar Land, TX", lat: 29.6219, lng: -95.6349, access: "public" },
    ],
    'Pearland, TX': [
        { name: "Pearland Recreation Center", city: "Pearland, TX", lat: 29.5636, lng: -95.2860, access: "public" },
    ],
    'Plano, TX': [
        { name: "Tom Muehlenbeck Recreation Center", city: "Plano, TX", lat: 33.0198, lng: -96.7498, access: "public" },
        { name: "Carpenter Park Recreation Center", city: "Plano, TX", lat: 33.0794, lng: -96.6950, access: "public" },
    ],
    'Irving, TX': [
        { name: "Mustang Park Recreation Center", city: "Irving, TX", lat: 32.8706, lng: -96.9580, access: "public" },
        { name: "Lee Park Recreation Center", city: "Irving, TX", lat: 32.8197, lng: -96.9453, access: "public" },
    ],
    'Garland, TX': [
        { name: "Holford Recreation Center", city: "Garland, TX", lat: 32.9226, lng: -96.6389, access: "public" },
        { name: "Bradfield Recreation Center", city: "Garland, TX", lat: 32.8982, lng: -96.6206, access: "public" },
    ],
    'Grand Prairie, TX': [
        { name: "Dalworth Recreation Center", city: "Grand Prairie, TX", lat: 32.7457, lng: -97.0008, access: "public" },
        { name: "The Summit Gym", city: "Grand Prairie, TX", lat: 32.7592, lng: -96.9960, access: "public" },
    ],
    // ===== FLORIDA =====
    'St. Petersburg, FL': [
        { name: "Childs Park Recreation Center", city: "St. Petersburg, FL", lat: 27.7361, lng: -82.6637, access: "public" },
        { name: "Frank Pierce Recreation Center", city: "St. Petersburg, FL", lat: 27.7639, lng: -82.6426, access: "public" },
        { name: "Willis S. Johns Recreation Center", city: "St. Petersburg, FL", lat: 27.7853, lng: -82.6781, access: "public" },
    ],
    'Fort Lauderdale, FL': [
        { name: "Carter Park Recreation Center", city: "Fort Lauderdale, FL", lat: 26.1359, lng: -80.1765, access: "public" },
        { name: "Joseph C. Carter Park Gym", city: "Fort Lauderdale, FL", lat: 26.1095, lng: -80.1669, access: "public" },
        { name: "YMCA Greater Fort Lauderdale", city: "Fort Lauderdale, FL", lat: 26.1186, lng: -80.1475, access: "members" },
    ],
    'Hialeah, FL': [
        { name: "Milander Park Recreation Center", city: "Hialeah, FL", lat: 25.8672, lng: -80.2877, access: "public" },
        { name: "Babcock Park Recreation Center", city: "Hialeah, FL", lat: 25.8542, lng: -80.3007, access: "public" },
    ],
    'Port St. Lucie, FL': [
        { name: "Port St. Lucie Community Center", city: "Port St. Lucie, FL", lat: 27.2936, lng: -80.3501, access: "public" },
    ],
    'Cape Coral, FL': [
        { name: "Cape Coral Sports Complex", city: "Cape Coral, FL", lat: 26.6134, lng: -81.9810, access: "public" },
    ],
    'Tallahassee, FL': [
        { name: "Walker-Ford Community Center", city: "Tallahassee, FL", lat: 30.4259, lng: -84.2743, access: "public" },
        { name: "Jack McLean Community Center", city: "Tallahassee, FL", lat: 30.4188, lng: -84.3121, access: "public" },
        { name: "FAMU Gaither Gym", city: "Tallahassee, FL", lat: 30.4258, lng: -84.2855, access: "members" },
    ],
    'Gainesville, FL': [
        { name: "Martin Luther King Jr. Center", city: "Gainesville, FL", lat: 29.6521, lng: -82.3186, access: "public" },
        { name: "UF Southwest Recreation Center", city: "Gainesville, FL", lat: 29.6399, lng: -82.3611, access: "members" },
    ],
    'Pembroke Pines, FL': [
        { name: "Charles F. Dodge City Center", city: "Pembroke Pines, FL", lat: 26.0063, lng: -80.3427, access: "public" },
    ],
    'Hollywood, FL': [
        { name: "David Park Community Center", city: "Hollywood, FL", lat: 26.0141, lng: -80.1474, access: "public" },
        { name: "Driftwood Community Center", city: "Hollywood, FL", lat: 26.0272, lng: -80.1722, access: "public" },
    ],
    'Clearwater, FL': [
        { name: "North Greenwood Recreation Center", city: "Clearwater, FL", lat: 27.9825, lng: -82.7898, access: "public" },
        { name: "Ross Norton Recreation Center", city: "Clearwater, FL", lat: 27.9687, lng: -82.7967, access: "public" },
    ],
    // ===== SOUTH =====
    'Winston-Salem, NC': [
        { name: "Happy Hill Recreation Center", city: "Winston-Salem, NC", lat: 36.0846, lng: -80.2642, access: "public" },
        { name: "Hanes Hosiery Recreation Center", city: "Winston-Salem, NC", lat: 36.1014, lng: -80.2677, access: "public" },
    ],
    'Durham, NC': [
        { name: "Lyon Park Community Center", city: "Durham, NC", lat: 35.9800, lng: -78.8978, access: "public" },
        { name: "Campus Hills Recreation Center", city: "Durham, NC", lat: 35.9839, lng: -78.8663, access: "public" },
    ],
    'Greensboro, NC': [
        { name: "Barber Park Recreation Center", city: "Greensboro, NC", lat: 36.0452, lng: -79.8118, access: "public" },
        { name: "Smith Recreation Center", city: "Greensboro, NC", lat: 36.0773, lng: -79.7916, access: "public" },
    ],
    'Fayetteville, NC': [
        { name: "Cliffdale Recreation Center", city: "Fayetteville, NC", lat: 35.0504, lng: -79.0183, access: "public" },
        { name: "Lake Rim Recreation Center", city: "Fayetteville, NC", lat: 35.0100, lng: -79.0260, access: "public" },
    ],
    'Savannah, GA': [
        { name: "Larry Haynes Gymnasium", city: "Savannah, GA", lat: 32.0555, lng: -81.1052, access: "public" },
        { name: "Pennsylvania Avenue Recreation Center", city: "Savannah, GA", lat: 32.0484, lng: -81.0921, access: "public" },
    ],
    'Augusta, GA': [
        { name: "McBean Community Center", city: "Augusta, GA", lat: 33.4535, lng: -82.0221, access: "public" },
        { name: "May Park Community Center", city: "Augusta, GA", lat: 33.4672, lng: -81.9612, access: "public" },
    ],
    'Columbia, SC': [
        { name: "Drew Park Community Center", city: "Columbia, SC", lat: 34.0007, lng: -81.0348, access: "public" },
        { name: "Greenview Park Community Center", city: "Columbia, SC", lat: 33.9798, lng: -81.0121, access: "public" },
    ],
    'Charleston, SC': [
        { name: "Harmon Field Community Center", city: "Charleston, SC", lat: 32.7918, lng: -79.9528, access: "public" },
        { name: "Charleston Gymnastics Center", city: "Charleston, SC", lat: 32.8032, lng: -79.9632, access: "public" },
    ],
    'Knoxville, TN': [
        { name: "Larry Cox Community Center", city: "Knoxville, TN", lat: 35.9722, lng: -83.9172, access: "public" },
        { name: "Milton Roberts Recreation Center", city: "Knoxville, TN", lat: 35.9604, lng: -83.9342, access: "public" },
    ],
    'Chattanooga, TN': [
        { name: "Avondale Youth Complex", city: "Chattanooga, TN", lat: 35.0358, lng: -85.2662, access: "public" },
        { name: "Brainerd Recreation Center", city: "Chattanooga, TN", lat: 35.0148, lng: -85.2471, access: "public" },
    ],
    'Huntsville, AL': [
        { name: "Brahan Spring Park Center", city: "Huntsville, AL", lat: 34.7178, lng: -86.5828, access: "public" },
        { name: "Cavalry Hill Community Center", city: "Huntsville, AL", lat: 34.7322, lng: -86.6030, access: "public" },
    ],
    'Birmingham, AL': [
        { name: "Bill Harris Arena", city: "Birmingham, AL", lat: 33.5272, lng: -86.8075, access: "public" },
        { name: "Ensley Community Center", city: "Birmingham, AL", lat: 33.5108, lng: -86.8853, access: "public" },
        { name: "Pratt City Community Center", city: "Birmingham, AL", lat: 33.5124, lng: -86.8693, access: "public" },
    ],
    'Mobile, AL': [
        { name: "Medal of Honor Park Community Center", city: "Mobile, AL", lat: 30.6816, lng: -88.1073, access: "public" },
        { name: "Langan Park Community Center", city: "Mobile, AL", lat: 30.7019, lng: -88.1238, access: "public" },
    ],
    'Jackson, MS': [
        { name: "Sykes Community Center", city: "Jackson, MS", lat: 32.3019, lng: -90.1970, access: "public" },
        { name: "Tougaloo Community Center", city: "Jackson, MS", lat: 32.3593, lng: -90.1544, access: "public" },
    ],
    'Little Rock, AR': [
        { name: "Dunbar Community Center", city: "Little Rock, AR", lat: 34.7429, lng: -92.2725, access: "public" },
        { name: "Southwest Community Center", city: "Little Rock, AR", lat: 34.7131, lng: -92.3333, access: "public" },
        { name: "YMCA Downtown Little Rock", city: "Little Rock, AR", lat: 34.7465, lng: -92.2839, access: "members" },
    ],
    'Baton Rouge, LA': [
        { name: "Howell Park Community Center", city: "Baton Rouge, LA", lat: 30.4686, lng: -91.1510, access: "public" },
        { name: "Independence Park Community Center", city: "Baton Rouge, LA", lat: 30.4546, lng: -91.1539, access: "public" },
        { name: "YMCA Greater Baton Rouge", city: "Baton Rouge, LA", lat: 30.4531, lng: -91.1511, access: "members" },
    ],
};

async function main() {
    const cities = Object.keys(ALL);
    const total = cities.reduce((s, c) => s + ALL[c].length, 0);
    console.log(`\n=== 50K+ CITIES PART 2 (TX/FL/SOUTH): ${cities.length} CITIES, ${total} COURTS ===\n`);
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

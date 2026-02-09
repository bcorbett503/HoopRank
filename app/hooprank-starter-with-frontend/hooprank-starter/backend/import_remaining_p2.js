/**
 * Indoor Courts Import — Remaining US Cities Part 2
 * Covers: Nashville, Charlotte, Indianapolis, Columbus, Detroit, 
 * Portland, Las Vegas, Memphis, Milwaukee, Jacksonville,
 * Kansas City, Oklahoma City, Sacramento, Raleigh, Salt Lake City,
 * Pittsburgh, Cincinnati, Cleveland, New Orleans, Louisville,
 * Richmond, Virginia Beach, Buffalo, Tucson, Albuquerque,
 * Omaha, Honolulu, Providence, Hartford
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
    'Nashville': [
        { name: "McCabe Community Center", city: "Nashville, TN", lat: 36.1330, lng: -86.8287, access: "public" },
        { name: "Coleman Community Center", city: "Nashville, TN", lat: 36.1651, lng: -86.7591, access: "public" },
        { name: "Hartman Park Community Center", city: "Nashville, TN", lat: 36.1879, lng: -86.7426, access: "public" },
        { name: "Hadley Park Community Center", city: "Nashville, TN", lat: 36.1791, lng: -86.8088, access: "public" },
        { name: "Southeast Community Center", city: "Nashville, TN", lat: 36.1154, lng: -86.7256, access: "public" },
        { name: "YMCA Maryland Farms", city: "Nashville, TN", lat: 36.0599, lng: -86.7913, access: "members" },
        { name: "YMCA Downtown Nashville", city: "Nashville, TN", lat: 36.1612, lng: -86.7837, access: "members" },
        { name: "Vanderbilt University Rec Center", city: "Nashville, TN", lat: 36.1444, lng: -86.8095, access: "members" },
    ],
    'Charlotte': [
        { name: "Beatties Ford Road Recreation Center", city: "Charlotte, NC", lat: 35.2684, lng: -80.8716, access: "public" },
        { name: "Billingsville Recreation Center", city: "Charlotte, NC", lat: 35.2101, lng: -80.8319, access: "public" },
        { name: "Revolution Park Recreation Center", city: "Charlotte, NC", lat: 35.1951, lng: -80.8616, access: "public" },
        { name: "Cordelia Park Recreation Center", city: "Charlotte, NC", lat: 35.2427, lng: -80.8259, access: "public" },
        { name: "Westerly Hills Recreation Center", city: "Charlotte, NC", lat: 35.2271, lng: -80.8928, access: "public" },
        { name: "Dowd YMCA Charlotte", city: "Charlotte, NC", lat: 35.2232, lng: -80.8502, access: "members" },
        { name: "Harris YMCA Charlotte", city: "Charlotte, NC", lat: 35.1489, lng: -80.8397, access: "members" },
        { name: "Life Time South Charlotte", city: "Charlotte, NC", lat: 35.1072, lng: -80.8539, access: "members" },
    ],
    'Indianapolis': [
        { name: "Thatcher Park Community Center", city: "Indianapolis, IN", lat: 39.7774, lng: -86.1826, access: "public" },
        { name: "Garfield Park Family Center", city: "Indianapolis, IN", lat: 39.7352, lng: -86.1367, access: "public" },
        { name: "Frederick Douglass Park", city: "Indianapolis, IN", lat: 39.7745, lng: -86.2037, access: "public" },
        { name: "Riverside Park Family Center", city: "Indianapolis, IN", lat: 39.8038, lng: -86.1931, access: "public" },
        { name: "OrthoIndy Foundation YMCA", city: "Indianapolis, IN", lat: 39.7686, lng: -86.1557, access: "members" },
        { name: "Fishers YMCA", city: "Fishers, IN", lat: 39.9566, lng: -86.0147, access: "members" },
        { name: "Life Time Carmel", city: "Carmel, IN", lat: 39.9747, lng: -86.1062, access: "members" },
        { name: "Indiana Pacers Athletic Center", city: "Indianapolis, IN", lat: 39.8001, lng: -86.1854, access: "members" },
    ],
    'Columbus': [
        { name: "YMCA Downtown Columbus", city: "Columbus, OH", lat: 39.9592, lng: -82.9884, access: "members" },
        { name: "YMCA Hilltop", city: "Columbus, OH", lat: 39.9588, lng: -83.0599, access: "members" },
        { name: "Linden Recreation Center", city: "Columbus, OH", lat: 39.9994, lng: -82.9622, access: "public" },
        { name: "Driving Park Recreation Center", city: "Columbus, OH", lat: 39.9303, lng: -82.9598, access: "public" },
        { name: "Glenwood Recreation Center", city: "Columbus, OH", lat: 39.9278, lng: -83.0087, access: "public" },
        { name: "Ohio State RPAC", city: "Columbus, OH", lat: 40.0116, lng: -83.0199, access: "members" },
        { name: "Life Time Easton", city: "Columbus, OH", lat: 40.0507, lng: -82.9154, access: "members" },
    ],
    'Detroit': [
        { name: "Heilmann Recreation Center", city: "Detroit, MI", lat: 42.3555, lng: -83.1060, access: "public" },
        { name: "Butzel Community Center", city: "Detroit, MI", lat: 42.3891, lng: -83.0541, access: "public" },
        { name: "Considine Recreation Center", city: "Detroit, MI", lat: 42.3363, lng: -83.0651, access: "public" },
        { name: "Adams Recreation Center", city: "Detroit, MI", lat: 42.3574, lng: -83.0759, access: "public" },
        { name: "Farwell Recreation Center", city: "Detroit, MI", lat: 42.3760, lng: -83.1249, access: "public" },
        { name: "Boll Family YMCA", city: "Detroit, MI", lat: 42.3353, lng: -83.0464, access: "members" },
        { name: "Life Time Rochester Hills", city: "Rochester Hills, MI", lat: 42.6632, lng: -83.1281, access: "members" },
    ],
    'Portland': [
        { name: "Matt Dishman Community Center", city: "Portland, OR", lat: 45.5365, lng: -122.6537, access: "public" },
        { name: "Charles Jordan Community Center", city: "Portland, OR", lat: 45.5823, lng: -122.7448, access: "public" },
        { name: "East Portland Community Center", city: "Portland, OR", lat: 45.5201, lng: -122.5573, access: "public" },
        { name: "Montavilla Community Center", city: "Portland, OR", lat: 45.5210, lng: -122.5640, access: "public" },
        { name: "Southwest Community Center", city: "Portland, OR", lat: 45.4671, lng: -122.7128, access: "public" },
        { name: "YMCA Clark County", city: "Vancouver, WA", lat: 45.6370, lng: -122.5983, access: "members" },
        { name: "24 Hour Fitness Portland Lloyd", city: "Portland, OR", lat: 45.5275, lng: -122.6456, access: "members" },
    ],
    'Las Vegas': [
        { name: "Doolittle Community Center", city: "Las Vegas, NV", lat: 36.1823, lng: -115.1591, access: "public" },
        { name: "Whitney Recreation Center", city: "Henderson, NV", lat: 36.0289, lng: -115.0614, access: "public" },
        { name: "Chuck Minker Sports Complex", city: "Las Vegas, NV", lat: 36.1466, lng: -115.1413, access: "public" },
        { name: "Cambridge Recreation Center", city: "Las Vegas, NV", lat: 36.0918, lng: -115.2115, access: "public" },
        { name: "Life Time Summerlin", city: "Las Vegas, NV", lat: 36.1659, lng: -115.2945, access: "members" },
        { name: "EoS Fitness Las Vegas", city: "Las Vegas, NV", lat: 36.1116, lng: -115.1723, access: "members" },
        { name: "UNLV Student Recreation Center", city: "Las Vegas, NV", lat: 36.1114, lng: -115.1528, access: "members" },
    ],
    'Memphis': [
        { name: "Glenview Community Center", city: "Memphis, TN", lat: 35.1175, lng: -90.0085, access: "public" },
        { name: "Ed Rice Community Center", city: "Memphis, TN", lat: 35.0680, lng: -89.9342, access: "public" },
        { name: "Hickory Hill Community Center", city: "Memphis, TN", lat: 35.0516, lng: -89.8744, access: "public" },
        { name: "Orange Mound Community Center", city: "Memphis, TN", lat: 35.1079, lng: -89.9731, access: "public" },
        { name: "YMCA Downtown Memphis", city: "Memphis, TN", lat: 35.1383, lng: -90.0490, access: "members" },
        { name: "Fogelman YMCA Memphis", city: "Memphis, TN", lat: 35.1021, lng: -89.8680, access: "members" },
    ],
    'Milwaukee': [
        { name: "Becher-Kinnickinnic Recreation Center", city: "Milwaukee, WI", lat: 43.0044, lng: -87.9096, access: "public" },
        { name: "Parklawn Recreation Center", city: "Milwaukee, WI", lat: 43.0695, lng: -87.9727, access: "public" },
        { name: "Kosciuszko Community Center", city: "Milwaukee, WI", lat: 43.0264, lng: -87.9169, access: "public" },
        { name: "COA Goldin Center", city: "Milwaukee, WI", lat: 43.0492, lng: -87.9128, access: "public" },
        { name: "YMCA Downtown Milwaukee", city: "Milwaukee, WI", lat: 43.0384, lng: -87.9065, access: "members" },
        { name: "Marquette University Rec Center", city: "Milwaukee, WI", lat: 43.0381, lng: -87.9362, access: "members" },
    ],
    'Jacksonville': [
        { name: "Clanzel T. Brown Community Center", city: "Jacksonville, FL", lat: 30.3601, lng: -81.6828, access: "public" },
        { name: "Jim Fortuna Community Center", city: "Jacksonville, FL", lat: 30.3153, lng: -81.7207, access: "public" },
        { name: "Joseph Lee Community Center", city: "Jacksonville, FL", lat: 30.3312, lng: -81.6376, access: "public" },
        { name: "Catherine Street Recreation Center", city: "Jacksonville, FL", lat: 30.3354, lng: -81.6520, access: "public" },
        { name: "YMCA Winston Family", city: "Jacksonville, FL", lat: 30.2747, lng: -81.5582, access: "members" },
        { name: "YMCA Brooks", city: "Jacksonville, FL", lat: 30.1720, lng: -81.5970, access: "members" },
    ],
    'Kansas City': [
        { name: "Tony Aguirre Community Center", city: "Kansas City, MO", lat: 39.0601, lng: -94.5529, access: "public" },
        { name: "Southeast Community Center", city: "Kansas City, MO", lat: 39.0300, lng: -94.5180, access: "public" },
        { name: "Gregg-Klice Community Center", city: "Kansas City, MO", lat: 39.1140, lng: -94.5647, access: "public" },
        { name: "Line Creek Community Center", city: "Kansas City, MO", lat: 39.1908, lng: -94.6429, access: "public" },
        { name: "YMCA Greater Kansas City", city: "Kansas City, MO", lat: 39.0924, lng: -94.5869, access: "members" },
        { name: "Genesis Health Clubs KC", city: "Kansas City, MO", lat: 39.0453, lng: -94.5929, access: "members" },
    ],
    'Oklahoma City': [
        { name: "Will Rogers Community Center", city: "Oklahoma City, OK", lat: 35.4609, lng: -97.5303, access: "public" },
        { name: "Douglass Recreation Center", city: "Oklahoma City, OK", lat: 35.4539, lng: -97.4980, access: "public" },
        { name: "Capitol Hill Community Center", city: "Oklahoma City, OK", lat: 35.4323, lng: -97.5185, access: "public" },
        { name: "Woodson Park Community Center", city: "Oklahoma City, OK", lat: 35.4832, lng: -97.5599, access: "public" },
        { name: "YMCA Downtown Oklahoma City", city: "Oklahoma City, OK", lat: 35.4687, lng: -97.5179, access: "members" },
        { name: "YMCA Earlywine Park", city: "Oklahoma City, OK", lat: 35.3717, lng: -97.5493, access: "members" },
    ],
    'Sacramento': [
        { name: "24 Hour Fitness Sacramento Midtown", city: "Sacramento, CA", lat: 38.5694, lng: -121.4692, access: "members" },
        { name: "Pannell Community Center", city: "Sacramento, CA", lat: 38.5395, lng: -121.4721, access: "public" },
        { name: "Hagginwood Community Center", city: "Sacramento, CA", lat: 38.6105, lng: -121.4456, access: "public" },
        { name: "Coloma Community Center", city: "Sacramento, CA", lat: 38.5612, lng: -121.4141, access: "public" },
        { name: "South Natomas Community Center", city: "Sacramento, CA", lat: 38.6155, lng: -121.5008, access: "public" },
        { name: "YMCA Central Sacramento", city: "Sacramento, CA", lat: 38.5812, lng: -121.4904, access: "members" },
    ],
    'Raleigh': [
        { name: "Chavis Community Center", city: "Raleigh, NC", lat: 35.7695, lng: -78.6309, access: "public" },
        { name: "Biltmore Hills Community Center", city: "Raleigh, NC", lat: 35.7420, lng: -78.6316, access: "public" },
        { name: "Roberts Park Community Center", city: "Raleigh, NC", lat: 35.8085, lng: -78.6449, access: "public" },
        { name: "Worthdale Community Center", city: "Raleigh, NC", lat: 35.7641, lng: -78.6658, access: "public" },
        { name: "YMCA A.E. Finley", city: "Raleigh, NC", lat: 35.8542, lng: -78.6373, access: "members" },
        { name: "Life Time Raleigh", city: "Raleigh, NC", lat: 35.8697, lng: -78.7508, access: "members" },
    ],
    'Salt Lake City': [
        { name: "Sorenson Recreation Center", city: "Salt Lake City, UT", lat: 40.7087, lng: -111.9132, access: "public" },
        { name: "Northwest Recreation Center", city: "Salt Lake City, UT", lat: 40.7902, lng: -111.9156, access: "public" },
        { name: "Central City Recreation Center", city: "Salt Lake City, UT", lat: 40.7504, lng: -111.8673, access: "public" },
        { name: "Fairmont Park Community Center", city: "Salt Lake City, UT", lat: 40.7234, lng: -111.8609, access: "public" },
        { name: "Life Time Sandy", city: "Sandy, UT", lat: 40.5753, lng: -111.8546, access: "members" },
        { name: "YMCA Downtown Salt Lake City", city: "Salt Lake City, UT", lat: 40.7644, lng: -111.8893, access: "members" },
    ],
    'Pittsburgh': [
        { name: "Ammon Recreation Center", city: "Pittsburgh, PA", lat: 40.4506, lng: -79.9671, access: "public" },
        { name: "Ormsby Recreation Center", city: "Pittsburgh, PA", lat: 40.4247, lng: -79.9698, access: "public" },
        { name: "Warrington Recreation Center", city: "Pittsburgh, PA", lat: 40.4213, lng: -80.0011, access: "public" },
        { name: "Homewood-Brushton YMCA", city: "Pittsburgh, PA", lat: 40.4556, lng: -79.8937, access: "members" },
        { name: "YMCA Greater Pittsburgh", city: "Pittsburgh, PA", lat: 40.4406, lng: -80.0026, access: "members" },
        { name: "CMU University Center Gym", city: "Pittsburgh, PA", lat: 40.4434, lng: -79.9420, access: "members" },
    ],
    'Cincinnati': [
        { name: "Hirsch Recreation Center", city: "Cincinnati, OH", lat: 39.1323, lng: -84.5109, access: "public" },
        { name: "Millvale Recreation Center", city: "Cincinnati, OH", lat: 39.1551, lng: -84.5427, access: "public" },
        { name: "Evanston Recreation Center", city: "Cincinnati, OH", lat: 39.1553, lng: -84.4880, access: "public" },
        { name: "YMCA Gamble Center Cincinnati", city: "Cincinnati, OH", lat: 39.1289, lng: -84.5099, access: "members" },
        { name: "UC Campus Recreation Center", city: "Cincinnati, OH", lat: 39.1319, lng: -84.5165, access: "members" },
    ],
    'Cleveland': [
        { name: "Zelma George Recreation Center", city: "Cleveland, OH", lat: 41.5000, lng: -81.6757, access: "public" },
        { name: "Stella Walsh Recreation Center", city: "Cleveland, OH", lat: 41.4473, lng: -81.6277, access: "public" },
        { name: "Michael Zone Recreation Center", city: "Cleveland, OH", lat: 41.4783, lng: -81.7237, access: "public" },
        { name: "Gunning Recreation Center", city: "Cleveland, OH", lat: 41.4723, lng: -81.6547, access: "public" },
        { name: "YMCA Greater Cleveland", city: "Cleveland, OH", lat: 41.5017, lng: -81.6892, access: "members" },
    ],
    'New Orleans': [
        { name: "Stallings St. Claude Recreation Center", city: "New Orleans, LA", lat: 29.9703, lng: -90.0344, access: "public" },
        { name: "Treme Recreation Center", city: "New Orleans, LA", lat: 29.9643, lng: -90.0691, access: "public" },
        { name: "Joe W. Brown Recreation Center", city: "New Orleans, LA", lat: 30.0104, lng: -89.9762, access: "public" },
        { name: "Milne Recreation Center", city: "New Orleans, LA", lat: 30.0015, lng: -90.0448, access: "public" },
        { name: "YMCA Lee Circle New Orleans", city: "New Orleans, LA", lat: 29.9445, lng: -90.0748, access: "members" },
    ],
    'Louisville': [
        { name: "Newburg Community Center", city: "Louisville, KY", lat: 38.1814, lng: -85.6596, access: "public" },
        { name: "Sun Valley Community Center", city: "Louisville, KY", lat: 38.1969, lng: -85.8052, access: "public" },
        { name: "Chestnut Street Family YMCA", city: "Louisville, KY", lat: 38.2453, lng: -85.7583, access: "members" },
        { name: "Southeast Family YMCA", city: "Louisville, KY", lat: 38.2042, lng: -85.6392, access: "members" },
        { name: "Norton Healthcare Sports & Learning", city: "Louisville, KY", lat: 38.2328, lng: -85.7342, access: "public" },
    ],
    'Richmond': [
        { name: "Calhoun Family Center", city: "Richmond, VA", lat: 37.5481, lng: -77.4343, access: "public" },
        { name: "Hotchkiss Community Center", city: "Richmond, VA", lat: 37.5656, lng: -77.4668, access: "public" },
        { name: "Powhatan Community Center", city: "Richmond, VA", lat: 37.5252, lng: -77.4472, access: "public" },
        { name: "YMCA Greater Richmond Downtown", city: "Richmond, VA", lat: 37.5401, lng: -77.4380, access: "members" },
    ],
    'Virginia Beach': [
        { name: "Princess Anne Recreation Center", city: "Virginia Beach, VA", lat: 36.7906, lng: -76.0623, access: "public" },
        { name: "Bow Creek Recreation Center", city: "Virginia Beach, VA", lat: 36.8174, lng: -76.0865, access: "public" },
        { name: "Kempsville Recreation Center", city: "Virginia Beach, VA", lat: 36.8218, lng: -76.1068, access: "public" },
        { name: "Seatack Recreation Center", city: "Virginia Beach, VA", lat: 36.8434, lng: -76.0124, access: "public" },
    ],
    'Buffalo': [
        { name: "Masten Boys & Girls Club", city: "Buffalo, NY", lat: 42.9050, lng: -78.8465, access: "public" },
        { name: "Cazenovia Park Recreation Center", city: "Buffalo, NY", lat: 42.8614, lng: -78.8220, access: "public" },
        { name: "Schiller Park Recreation Center", city: "Buffalo, NY", lat: 42.8898, lng: -78.8555, access: "public" },
        { name: "Delaware YMCA Buffalo", city: "Buffalo, NY", lat: 42.9163, lng: -78.8766, access: "members" },
    ],
    'Tucson': [
        { name: "Udall Center", city: "Tucson, AZ", lat: 32.2273, lng: -110.8587, access: "public" },
        { name: "El Rio Neighborhood Center", city: "Tucson, AZ", lat: 32.2216, lng: -110.9994, access: "public" },
        { name: "Donna Liggins Recreation Center", city: "Tucson, AZ", lat: 32.1907, lng: -110.9392, access: "public" },
        { name: "UA Student Recreation Center", city: "Tucson, AZ", lat: 32.2302, lng: -110.9505, access: "members" },
    ],
    'Albuquerque': [
        { name: "Highland Community Center", city: "Albuquerque, NM", lat: 35.0737, lng: -106.6110, access: "public" },
        { name: "West Mesa Community Center", city: "Albuquerque, NM", lat: 35.1152, lng: -106.7192, access: "public" },
        { name: "North Valley Community Center", city: "Albuquerque, NM", lat: 35.1302, lng: -106.6352, access: "public" },
        { name: "YMCA Downtown Albuquerque", city: "Albuquerque, NM", lat: 35.0859, lng: -106.6495, access: "members" },
    ],
    'Omaha': [
        { name: "Adams Park Recreation Center", city: "Omaha, NE", lat: 41.2810, lng: -95.9541, access: "public" },
        { name: "Gallagher Park Community Center", city: "Omaha, NE", lat: 41.2438, lng: -96.0024, access: "public" },
        { name: "YMCA Downtown Omaha", city: "Omaha, NE", lat: 41.2604, lng: -95.9405, access: "members" },
    ],
    'Honolulu': [
        { name: "Kaimuki Recreation Center", city: "Honolulu, HI", lat: 21.2786, lng: -157.8120, access: "public" },
        { name: "Palama Settlement Gym", city: "Honolulu, HI", lat: 21.3189, lng: -157.8618, access: "public" },
        { name: "Central YMCA Honolulu", city: "Honolulu, HI", lat: 21.3063, lng: -157.8574, access: "members" },
        { name: "UH Manoa Recreation Center", city: "Honolulu, HI", lat: 21.2995, lng: -157.8188, access: "members" },
    ],
    'Providence': [
        { name: "Providence Recreation Center", city: "Providence, RI", lat: 41.8250, lng: -71.4141, access: "public" },
        { name: "Davey Lopes Recreation Center", city: "Providence, RI", lat: 41.8047, lng: -71.4147, access: "public" },
        { name: "YMCA Greater Providence", city: "Providence, RI", lat: 41.8264, lng: -71.4176, access: "members" },
    ],
    'Hartford': [
        { name: "Parker Memorial Community Center", city: "Hartford, CT", lat: 41.7654, lng: -72.6930, access: "public" },
        { name: "Keney Park Recreation Center", city: "Hartford, CT", lat: 41.7898, lng: -72.6830, access: "public" },
        { name: "YMCA Downtown Hartford", city: "Hartford, CT", lat: 41.7656, lng: -72.6729, access: "members" },
    ],
};

async function main() {
    const cities = Object.keys(ALL);
    const total = cities.reduce((s, c) => s + ALL[c].length, 0);
    console.log(`\n=== PART 2: ${cities.length} CITIES, ${total} COURTS ===\n`);
    let ok = 0, fail = 0;
    for (const city of cities) {
        const courts = ALL[city];
        console.log(`📍 ${city} (${courts.length})`);
        for (const c of courts) {
            try { const r = await post(c); console.log(`  ✅ ${c.name}`); ok++; }
            catch (e) { console.log(`  ❌ ${c.name}: ${e.message}`); fail++; }
        }
    }
    console.log(`\nPART 2 DONE: ${ok} ok, ${fail} failed\n`);
}
main();

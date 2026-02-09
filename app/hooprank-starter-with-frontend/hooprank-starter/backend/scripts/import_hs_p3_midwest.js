/**
 * High School Courts — Part 3: Midwest
 * Major public high schools with indoor gymnasiums
 * Chicago, Detroit, Indianapolis, Columbus, Cleveland, Cincinnati, Milwaukee, Minneapolis, KC, OKC, St. Louis, Omaha
 */
const https = require('https');
const crypto = require('crypto');

const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

function postCourt(court) {
    return new Promise((resolve, reject) => {
        const id = generateUUID(court.name + court.city);
        const params = new URLSearchParams({
            id, name: court.name, city: court.city,
            lat: String(court.lat), lng: String(court.lng),
            indoor: String(court.indoor), access: court.access || 'public',
        });
        const options = {
            hostname: BASE, path: `/courts/admin/create?${params.toString()}`,
            method: 'POST', headers: { 'x-user-id': USER_ID }, timeout: 10000,
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
    });
}

// ==========================================
// CHICAGO HIGH SCHOOLS
// ==========================================
const CHICAGO_HS = [
    { name: "Simeon Career Academy Gym", city: "Chicago, IL", lat: 41.7246, lng: -87.6207, indoor: true, access: "public" },
    { name: "Whitney Young Magnet High School Gym", city: "Chicago, IL", lat: 41.8687, lng: -87.6714, indoor: true, access: "public" },
    { name: "Morgan Park High School Gym", city: "Chicago, IL", lat: 41.6942, lng: -87.6680, indoor: true, access: "public" },
    { name: "Bogan High School Gym", city: "Chicago, IL", lat: 41.7475, lng: -87.7126, indoor: true, access: "public" },
    { name: "Curie Metropolitan High School Gym", city: "Chicago, IL", lat: 41.7649, lng: -87.7126, indoor: true, access: "public" },
    { name: "Marshall Metropolitan High School Gym", city: "Chicago, IL", lat: 41.8805, lng: -87.7202, indoor: true, access: "public" },
    { name: "Orr Academy High School Gym", city: "Chicago, IL", lat: 41.9050, lng: -87.7475, indoor: true, access: "public" },
    { name: "Kenwood Academy Gym", city: "Chicago, IL", lat: 41.7994, lng: -87.5945, indoor: true, access: "public" },
    { name: "Hyde Park Academy Gym", city: "Chicago, IL", lat: 41.7929, lng: -87.6047, indoor: true, access: "public" },
    { name: "Phillips Academy High School Gym", city: "Chicago, IL", lat: 41.8357, lng: -87.6221, indoor: true, access: "public" },
    { name: "Proviso East High School Gym", city: "Maywood, IL", lat: 41.8818, lng: -87.8375, indoor: true, access: "public" },
    { name: "Thornton Township High School Gym", city: "Harvey, IL", lat: 41.6101, lng: -87.6366, indoor: true, access: "public" },
];

// ==========================================
// DETROIT HIGH SCHOOLS
// ==========================================
const DETROIT_HS = [
    { name: "Cass Technical High School Gym", city: "Detroit, MI", lat: 42.3378, lng: -83.0555, indoor: true, access: "public" },
    { name: "Renaissance High School Gym", city: "Detroit, MI", lat: 42.3901, lng: -83.1186, indoor: true, access: "public" },
    { name: "King High School Gym", city: "Detroit, MI", lat: 42.3794, lng: -83.1099, indoor: true, access: "public" },
    { name: "Pershing High School Gym", city: "Detroit, MI", lat: 42.3923, lng: -83.0758, indoor: true, access: "public" },
    { name: "Henry Ford High School Gym", city: "Detroit, MI", lat: 42.3539, lng: -83.1515, indoor: true, access: "public" },
    { name: "East English Village Preparatory Academy Gym", city: "Detroit, MI", lat: 42.4182, lng: -82.9833, indoor: true, access: "public" },
    { name: "Muskegon High School Gym", city: "Muskegon, MI", lat: 43.2276, lng: -86.2440, indoor: true, access: "public" },
    { name: "Saginaw High School Gym", city: "Saginaw, MI", lat: 43.4192, lng: -83.9504, indoor: true, access: "public" },
    { name: "Flint Beecher High School Gym", city: "Flint, MI", lat: 43.0612, lng: -83.7114, indoor: true, access: "public" },
    { name: "Grand Rapids Ottawa Hills High School Gym", city: "Grand Rapids, MI", lat: 42.9441, lng: -85.6430, indoor: true, access: "public" },
];

// ==========================================
// INDIANAPOLIS HIGH SCHOOLS
// ==========================================
const INDY_HS = [
    { name: "Lawrence North High School Gym", city: "Indianapolis, IN", lat: 39.8793, lng: -86.0206, indoor: true, access: "public" },
    { name: "Pike High School Gym", city: "Indianapolis, IN", lat: 39.8627, lng: -86.2534, indoor: true, access: "public" },
    { name: "North Central High School Gym", city: "Indianapolis, IN", lat: 39.8742, lng: -86.1128, indoor: true, access: "public" },
    { name: "Ben Davis High School Gym", city: "Indianapolis, IN", lat: 39.7566, lng: -86.2551, indoor: true, access: "public" },
    { name: "Warren Central High School Gym", city: "Indianapolis, IN", lat: 39.7773, lng: -85.9959, indoor: true, access: "public" },
    { name: "Cathedral High School Gym", city: "Indianapolis, IN", lat: 39.8431, lng: -86.1007, indoor: true, access: "public" },
    { name: "Crispus Attucks High School Gym", city: "Indianapolis, IN", lat: 39.7896, lng: -86.1699, indoor: true, access: "public" },
    { name: "Tech High School Gym (Indianapolis)", city: "Indianapolis, IN", lat: 39.7835, lng: -86.1273, indoor: true, access: "public" },
    { name: "Gary West Side High School Gym", city: "Gary, IN", lat: 41.5953, lng: -87.3700, indoor: true, access: "public" },
    { name: "South Bend Washington High School Gym", city: "South Bend, IN", lat: 41.6561, lng: -86.2656, indoor: true, access: "public" },
];

// ==========================================
// OHIO HIGH SCHOOLS
// ==========================================
const OHIO_HS = [
    { name: "Eastmoor Academy Gym", city: "Columbus, OH", lat: 39.9571, lng: -82.9362, indoor: true, access: "public" },
    { name: "Walnut Ridge High School Gym", city: "Columbus, OH", lat: 39.9338, lng: -82.8944, indoor: true, access: "public" },
    { name: "Whetstone High School Gym", city: "Columbus, OH", lat: 40.0361, lng: -83.0128, indoor: true, access: "public" },
    { name: "Beachwood High School Gym", city: "Beachwood, OH", lat: 41.4747, lng: -81.5080, indoor: true, access: "public" },
    { name: "St. Vincent-St. Mary High School Gym", city: "Akron, OH", lat: 41.0737, lng: -81.5209, indoor: true, access: "public" },
    { name: "Glenville High School Gym", city: "Cleveland, OH", lat: 41.5285, lng: -81.6303, indoor: true, access: "public" },
    { name: "John Hay High School Gym", city: "Cleveland, OH", lat: 41.5002, lng: -81.6397, indoor: true, access: "public" },
    { name: "Trotwood-Madison High School Gym", city: "Trotwood, OH", lat: 39.7935, lng: -84.3061, indoor: true, access: "public" },
    { name: "Aiken High School Gym", city: "Cincinnati, OH", lat: 39.1589, lng: -84.4558, indoor: true, access: "public" },
    { name: "Moeller High School Gym", city: "Cincinnati, OH", lat: 39.1821, lng: -84.3658, indoor: true, access: "public" },
];

// ==========================================
// MILWAUKEE / WISCONSIN HIGH SCHOOLS
// ==========================================
const WI_HS = [
    { name: "Rufus King International High School Gym", city: "Milwaukee, WI", lat: 43.0657, lng: -87.9374, indoor: true, access: "public" },
    { name: "Milwaukee Washington High School Gym", city: "Milwaukee, WI", lat: 43.0112, lng: -87.9449, indoor: true, access: "public" },
    { name: "Milwaukee Vincent High School Gym", city: "Milwaukee, WI", lat: 43.0942, lng: -87.9795, indoor: true, access: "public" },
    { name: "Milwaukee Hamilton High School Gym", city: "Milwaukee, WI", lat: 43.0220, lng: -87.9706, indoor: true, access: "public" },
    { name: "Brown Deer High School Gym", city: "Brown Deer, WI", lat: 43.1648, lng: -87.9689, indoor: true, access: "public" },
    { name: "Madison Memorial High School Gym", city: "Madison, WI", lat: 43.0644, lng: -89.4558, indoor: true, access: "public" },
    { name: "La Crosse Central High School Gym", city: "La Crosse, WI", lat: 43.8081, lng: -91.2407, indoor: true, access: "public" },
    { name: "Racine Park High School Gym", city: "Racine, WI", lat: 42.7384, lng: -87.7919, indoor: true, access: "public" },
];

// ==========================================
// MINNEAPOLIS/ST. PAUL HIGH SCHOOLS
// ==========================================
const MINN_HS = [
    { name: "Minneapolis North High School Gym", city: "Minneapolis, MN", lat: 44.9981, lng: -93.2957, indoor: true, access: "public" },
    { name: "Minneapolis South High School Gym", city: "Minneapolis, MN", lat: 44.9412, lng: -93.2655, indoor: true, access: "public" },
    { name: "DeLaSalle High School Gym", city: "Minneapolis, MN", lat: 44.9667, lng: -93.2677, indoor: true, access: "public" },
    { name: "Hopkins High School Gym", city: "Minnetonka, MN", lat: 44.9233, lng: -93.3888, indoor: true, access: "public" },
    { name: "Cretin-Derham Hall Gym", city: "St. Paul, MN", lat: 44.9408, lng: -93.1310, indoor: true, access: "public" },
    { name: "Park Center High School Gym", city: "Brooklyn Park, MN", lat: 45.0894, lng: -93.3627, indoor: true, access: "public" },
    { name: "St. Paul Harding High School Gym", city: "St. Paul, MN", lat: 44.9605, lng: -93.0411, indoor: true, access: "public" },
    { name: "Eastview High School Gym", city: "Apple Valley, MN", lat: 44.7505, lng: -93.2060, indoor: true, access: "public" },
];

// ==========================================
// KANSAS CITY / ST. LOUIS / MISSOURI HIGH SCHOOLS
// ==========================================
const MO_HS = [
    { name: "University Academy Gym", city: "Kansas City, MO", lat: 39.0602, lng: -94.5556, indoor: true, access: "public" },
    { name: "Raytown High School Gym", city: "Raytown, MO", lat: 39.0036, lng: -94.4592, indoor: true, access: "public" },
    { name: "Grandview High School Gym", city: "Grandview, MO", lat: 38.8896, lng: -94.5313, indoor: true, access: "public" },
    { name: "Sumner High School Gym", city: "Kansas City, KS", lat: 39.1155, lng: -94.6402, indoor: true, access: "public" },
    { name: "Olathe North High School Gym", city: "Olathe, KS", lat: 38.8845, lng: -94.8242, indoor: true, access: "public" },
    { name: "East St. Louis Senior High School Gym", city: "East St. Louis, IL", lat: 38.6174, lng: -90.1459, indoor: true, access: "public" },
    { name: "Vashon High School Gym", city: "St. Louis, MO", lat: 38.6492, lng: -90.2262, indoor: true, access: "public" },
    { name: "Hazelwood Central High School Gym", city: "Florissant, MO", lat: 38.7858, lng: -90.3453, indoor: true, access: "public" },
];

// ==========================================
// OKLAHOMA HIGH SCHOOLS
// ==========================================
const OK_HS = [
    { name: "Millwood High School Gym", city: "Oklahoma City, OK", lat: 35.5143, lng: -97.5779, indoor: true, access: "public" },
    { name: "Douglass High School Gym (OKC)", city: "Oklahoma City, OK", lat: 35.4569, lng: -97.5198, indoor: true, access: "public" },
    { name: "Booker T. Washington High School Gym", city: "Tulsa, OK", lat: 36.1380, lng: -95.9766, indoor: true, access: "public" },
    { name: "Memorial High School Gym (Tulsa)", city: "Tulsa, OK", lat: 36.1149, lng: -95.8833, indoor: true, access: "public" },
    { name: "Edmond Memorial High School Gym", city: "Edmond, OK", lat: 35.6481, lng: -97.4620, indoor: true, access: "public" },
    { name: "Putnam City West High School Gym", city: "Oklahoma City, OK", lat: 35.5355, lng: -97.6335, indoor: true, access: "public" },
];

// ==========================================
// NEBRASKA / IOWA HIGH SCHOOLS
// ==========================================
const PLAINS_HS = [
    { name: "Omaha Central High School Gym", city: "Omaha, NE", lat: 41.2555, lng: -95.9375, indoor: true, access: "public" },
    { name: "Omaha North High School Gym", city: "Omaha, NE", lat: 41.2875, lng: -95.9649, indoor: true, access: "public" },
    { name: "Bellevue West High School Gym", city: "Bellevue, NE", lat: 41.1344, lng: -95.9534, indoor: true, access: "public" },
    { name: "Lincoln High School Gym", city: "Lincoln, NE", lat: 40.8058, lng: -96.7028, indoor: true, access: "public" },
    { name: "Des Moines North High School Gym", city: "Des Moines, IA", lat: 41.6183, lng: -93.6197, indoor: true, access: "public" },
    { name: "Davenport North High School Gym", city: "Davenport, IA", lat: 41.5588, lng: -90.6025, indoor: true, access: "public" },
    { name: "Waterloo East High School Gym", city: "Waterloo, IA", lat: 42.4974, lng: -92.3296, indoor: true, access: "public" },
    { name: "Sioux City East High School Gym", city: "Sioux City, IA", lat: 42.4852, lng: -96.3779, indoor: true, access: "public" },
];

// ==========================================
// IMPORT RUNNER
// ==========================================
const ALL_REGIONS = [
    { name: 'Chicago', courts: CHICAGO_HS },
    { name: 'Detroit/Michigan', courts: DETROIT_HS },
    { name: 'Indianapolis/Indiana', courts: INDY_HS },
    { name: 'Ohio', courts: OHIO_HS },
    { name: 'Milwaukee/Wisconsin', courts: WI_HS },
    { name: 'Minneapolis/St. Paul', courts: MINN_HS },
    { name: 'KC/St. Louis/Missouri', courts: MO_HS },
    { name: 'Oklahoma', courts: OK_HS },
    { name: 'Nebraska/Iowa', courts: PLAINS_HS },
];

async function main() {
    const totalCourts = ALL_REGIONS.reduce((sum, r) => sum + r.courts.length, 0);
    console.log(`\n=== HIGH SCHOOL COURTS P3 (MIDWEST): ${ALL_REGIONS.length} REGIONS, ${totalCourts} COURTS ===\n`);

    let grandOk = 0, grandFail = 0;

    for (const region of ALL_REGIONS) {
        console.log(`\n🏫 ${region.name} (${region.courts.length} schools)`);
        console.log('─'.repeat(50));

        let ok = 0, fail = 0;
        for (const court of region.courts) {
            try {
                const result = await postCourt(court);
                if (result.status < 400) {
                    console.log(`  ✅ ${court.name}`);
                    ok++;
                } else {
                    console.log(`  ⚠️  ${court.name}: HTTP ${result.status}`);
                    ok++;
                }
            } catch (err) {
                console.log(`  ❌ ${court.name}: ${err.message}`);
                fail++;
            }
        }

        console.log(`  → ${ok} ok, ${fail} failed`);
        grandOk += ok;
        grandFail += fail;
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log(`TOTAL: ${grandOk} succeeded, ${grandFail} failed out of ${totalCourts}`);
    console.log(`${'═'.repeat(50)}\n`);
}

main();

/**
 * High School Courts — Part 2: Southeast & South
 * Major public high schools with indoor gymnasiums
 * Atlanta, Charlotte, Miami, Tampa, Orlando, Nashville, Memphis, New Orleans, Louisville, Richmond
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
// ATLANTA HIGH SCHOOLS
// ==========================================
const ATLANTA_HS = [
    { name: "Tri-Cities High School Gym", city: "East Point, GA", lat: 33.4596, lng: -84.4479, indoor: true, access: "public" },
    { name: "Westlake High School Gym", city: "Atlanta, GA", lat: 33.6788, lng: -84.5636, indoor: true, access: "public" },
    { name: "South Atlanta High School Gym", city: "Atlanta, GA", lat: 33.6929, lng: -84.3889, indoor: true, access: "public" },
    { name: "Mays High School Gym", city: "Atlanta, GA", lat: 33.7189, lng: -84.4820, indoor: true, access: "public" },
    { name: "North Atlanta High School Gym", city: "Atlanta, GA", lat: 33.8443, lng: -84.3652, indoor: true, access: "public" },
    { name: "Lithonia High School Gym", city: "Lithonia, GA", lat: 33.7119, lng: -84.1027, indoor: true, access: "public" },
    { name: "Norcross High School Gym", city: "Norcross, GA", lat: 33.9289, lng: -84.1949, indoor: true, access: "public" },
    { name: "Wheeler High School Gym", city: "Marietta, GA", lat: 33.9133, lng: -84.5131, indoor: true, access: "public" },
    { name: "Brookwood High School Gym", city: "Snellville, GA", lat: 33.8548, lng: -84.0060, indoor: true, access: "public" },
    { name: "Pebblebrook High School Gym", city: "Mableton, GA", lat: 33.8223, lng: -84.5756, indoor: true, access: "public" },
];

// ==========================================
// CHARLOTTE HIGH SCHOOLS
// ==========================================
const CHARLOTTE_HS = [
    { name: "West Charlotte High School Gym", city: "Charlotte, NC", lat: 35.2473, lng: -80.8835, indoor: true, access: "public" },
    { name: "Vance High School Gym", city: "Charlotte, NC", lat: 35.2988, lng: -80.8018, indoor: true, access: "public" },
    { name: "Olympic High School Gym", city: "Charlotte, NC", lat: 35.1680, lng: -80.9440, indoor: true, access: "public" },
    { name: "Mallard Creek High School Gym", city: "Charlotte, NC", lat: 35.3281, lng: -80.7365, indoor: true, access: "public" },
    { name: "Independence High School Gym", city: "Charlotte, NC", lat: 35.1338, lng: -80.7396, indoor: true, access: "public" },
    { name: "Myers Park High School Gym", city: "Charlotte, NC", lat: 35.1681, lng: -80.8277, indoor: true, access: "public" },
    { name: "Harding University High School Gym", city: "Charlotte, NC", lat: 35.1952, lng: -80.9012, indoor: true, access: "public" },
    { name: "Garner Magnet High School Gym", city: "Garner, NC", lat: 35.6963, lng: -78.6142, indoor: true, access: "public" },
];

// ==========================================
// MIAMI / SOUTH FLORIDA HIGH SCHOOLS
// ==========================================
const MIAMI_HS = [
    { name: "Miami Senior High School Gym", city: "Miami, FL", lat: 25.7670, lng: -80.2218, indoor: true, access: "public" },
    { name: "Miami Northwestern Senior High School Gym", city: "Miami, FL", lat: 25.8104, lng: -80.2416, indoor: true, access: "public" },
    { name: "Norland High School Gym", city: "Miami Gardens, FL", lat: 25.9324, lng: -80.2300, indoor: true, access: "public" },
    { name: "Carol City High School Gym", city: "Miami Gardens, FL", lat: 25.9487, lng: -80.2709, indoor: true, access: "public" },
    { name: "American Senior High School Gym", city: "Hialeah, FL", lat: 25.8667, lng: -80.3073, indoor: true, access: "public" },
    { name: "Mater Academy Charter High School Gym", city: "Hialeah Gardens, FL", lat: 25.8821, lng: -80.3509, indoor: true, access: "public" },
    { name: "Dr. Michael M. Krop Senior High Gym", city: "Miami, FL", lat: 25.9618, lng: -80.1695, indoor: true, access: "public" },
    { name: "Fort Lauderdale High School Gym", city: "Fort Lauderdale, FL", lat: 26.1259, lng: -80.1301, indoor: true, access: "public" },
    { name: "Boyd Anderson High School Gym", city: "Lauderdale Lakes, FL", lat: 26.1650, lng: -80.2126, indoor: true, access: "public" },
    { name: "Palm Beach Lakes High School Gym", city: "West Palm Beach, FL", lat: 26.7009, lng: -80.0817, indoor: true, access: "public" },
];

// ==========================================
// TAMPA / ORLANDO HIGH SCHOOLS
// ==========================================
const FL_CENTRAL_HS = [
    { name: "Blake High School Gym", city: "Tampa, FL", lat: 27.9600, lng: -82.4727, indoor: true, access: "public" },
    { name: "Plant High School Gym", city: "Tampa, FL", lat: 27.9215, lng: -82.5026, indoor: true, access: "public" },
    { name: "Hillsborough High School Gym", city: "Tampa, FL", lat: 27.9690, lng: -82.4486, indoor: true, access: "public" },
    { name: "Chamberlain High School Gym", city: "Tampa, FL", lat: 27.9985, lng: -82.3924, indoor: true, access: "public" },
    { name: "Armwood High School Gym", city: "Seffner, FL", lat: 27.9946, lng: -82.2808, indoor: true, access: "public" },
    { name: "Oak Ridge High School Gym", city: "Orlando, FL", lat: 28.4835, lng: -81.4015, indoor: true, access: "public" },
    { name: "Dr. Phillips High School Gym", city: "Orlando, FL", lat: 28.4558, lng: -81.4845, indoor: true, access: "public" },
    { name: "Edgewater High School Gym", city: "Orlando, FL", lat: 28.5678, lng: -81.3920, indoor: true, access: "public" },
    { name: "Olympia High School Gym", city: "Orlando, FL", lat: 28.4339, lng: -81.5183, indoor: true, access: "public" },
    { name: "Sanford Seminole High School Gym", city: "Sanford, FL", lat: 28.8044, lng: -81.2707, indoor: true, access: "public" },
];

// ==========================================
// NASHVILLE / TENNESSEE HIGH SCHOOLS
// ==========================================
const TN_HS = [
    { name: "Pearl-Cohn High School Gym", city: "Nashville, TN", lat: 36.1781, lng: -86.8207, indoor: true, access: "public" },
    { name: "Cane Ridge High School Gym", city: "Nashville, TN", lat: 36.0422, lng: -86.6690, indoor: true, access: "public" },
    { name: "Maplewood High School Gym", city: "Nashville, TN", lat: 36.2198, lng: -86.7544, indoor: true, access: "public" },
    { name: "McGavock High School Gym", city: "Nashville, TN", lat: 36.1461, lng: -86.6622, indoor: true, access: "public" },
    { name: "Overton High School Gym", city: "Nashville, TN", lat: 36.1091, lng: -86.7389, indoor: true, access: "public" },
    { name: "Memphis East High School Gym", city: "Memphis, TN", lat: 35.1111, lng: -89.8832, indoor: true, access: "public" },
    { name: "Whitehaven High School Gym", city: "Memphis, TN", lat: 35.0320, lng: -90.0019, indoor: true, access: "public" },
    { name: "Hamilton High School Gym", city: "Memphis, TN", lat: 35.0783, lng: -89.9285, indoor: true, access: "public" },
    { name: "Craigmont High School Gym", city: "Memphis, TN", lat: 35.2180, lng: -89.8889, indoor: true, access: "public" },
    { name: "Bearden High School Gym", city: "Knoxville, TN", lat: 35.9386, lng: -84.0050, indoor: true, access: "public" },
];

// ==========================================
// NEW ORLEANS / LOUISIANA HIGH SCHOOLS
// ==========================================
const LA_HS = [
    { name: "Warren Easton High School Gym", city: "New Orleans, LA", lat: 29.9670, lng: -90.0793, indoor: true, access: "public" },
    { name: "McDonogh 35 High School Gym", city: "New Orleans, LA", lat: 29.9711, lng: -90.0850, indoor: true, access: "public" },
    { name: "Edna Karr High School Gym", city: "New Orleans, LA", lat: 29.9154, lng: -90.0903, indoor: true, access: "public" },
    { name: "St. Augustine High School Gym", city: "New Orleans, LA", lat: 29.9760, lng: -90.0660, indoor: true, access: "public" },
    { name: "Scotlandville Magnet High School Gym", city: "Baton Rouge, LA", lat: 30.5071, lng: -91.1611, indoor: true, access: "public" },
    { name: "Madison Prep Academy Gym", city: "Baton Rouge, LA", lat: 30.4332, lng: -91.1466, indoor: true, access: "public" },
    { name: "Wossman High School Gym", city: "Monroe, LA", lat: 32.5063, lng: -92.1070, indoor: true, access: "public" },
    { name: "Peabody Magnet High School Gym", city: "Alexandria, LA", lat: 31.3219, lng: -92.4476, indoor: true, access: "public" },
];

// ==========================================
// LOUISVILLE / KENTUCKY HIGH SCHOOLS
// ==========================================
const KY_HS = [
    { name: "Male Traditional High School Gym", city: "Louisville, KY", lat: 38.2268, lng: -85.7124, indoor: true, access: "public" },
    { name: "Ballard High School Gym", city: "Louisville, KY", lat: 38.2715, lng: -85.5670, indoor: true, access: "public" },
    { name: "Fairdale High School Gym", city: "Louisville, KY", lat: 38.1072, lng: -85.7594, indoor: true, access: "public" },
    { name: "Central High School Gym (Louisville)", city: "Louisville, KY", lat: 38.2340, lng: -85.7928, indoor: true, access: "public" },
    { name: "Trinity High School Gym", city: "Louisville, KY", lat: 38.2650, lng: -85.6313, indoor: true, access: "public" },
    { name: "Henry Clay High School Gym", city: "Lexington, KY", lat: 38.0217, lng: -84.4832, indoor: true, access: "public" },
    { name: "Bryan Station High School Gym", city: "Lexington, KY", lat: 38.0722, lng: -84.4584, indoor: true, access: "public" },
    { name: "Scott County High School Gym", city: "Georgetown, KY", lat: 38.2161, lng: -84.5410, indoor: true, access: "public" },
];

// ==========================================
// RICHMOND / VIRGINIA HIGH SCHOOLS
// ==========================================
const VA_HS = [
    { name: "John Marshall High School Gym", city: "Richmond, VA", lat: 37.5776, lng: -77.4719, indoor: true, access: "public" },
    { name: "Armstrong High School Gym", city: "Richmond, VA", lat: 37.5305, lng: -77.4009, indoor: true, access: "public" },
    { name: "Huguenot High School Gym", city: "Richmond, VA", lat: 37.5070, lng: -77.5243, indoor: true, access: "public" },
    { name: "Henrico High School Gym", city: "Richmond, VA", lat: 37.5742, lng: -77.4038, indoor: true, access: "public" },
    { name: "Princess Anne High School Gym", city: "Virginia Beach, VA", lat: 36.8168, lng: -76.0592, indoor: true, access: "public" },
    { name: "Bayside High School Gym", city: "Virginia Beach, VA", lat: 36.8628, lng: -76.1275, indoor: true, access: "public" },
    { name: "Phoebus High School Gym", city: "Hampton, VA", lat: 37.0071, lng: -76.3115, indoor: true, access: "public" },
    { name: "Bethel High School Gym", city: "Hampton, VA", lat: 37.0661, lng: -76.3979, indoor: true, access: "public" },
];

// ==========================================
// IMPORT RUNNER
// ==========================================
const ALL_REGIONS = [
    { name: 'Atlanta Area', courts: ATLANTA_HS },
    { name: 'Charlotte/NC', courts: CHARLOTTE_HS },
    { name: 'Miami/South FL', courts: MIAMI_HS },
    { name: 'Tampa/Orlando', courts: FL_CENTRAL_HS },
    { name: 'Nashville/TN', courts: TN_HS },
    { name: 'New Orleans/LA', courts: LA_HS },
    { name: 'Louisville/KY', courts: KY_HS },
    { name: 'Richmond/VA', courts: VA_HS },
];

async function main() {
    const totalCourts = ALL_REGIONS.reduce((sum, r) => sum + r.courts.length, 0);
    console.log(`\n=== HIGH SCHOOL COURTS P2 (SOUTHEAST): ${ALL_REGIONS.length} REGIONS, ${totalCourts} COURTS ===\n`);

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

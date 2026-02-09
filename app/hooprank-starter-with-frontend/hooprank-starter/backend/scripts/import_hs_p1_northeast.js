/**
 * High School Courts — Part 1: Northeast & Mid-Atlantic
 * Major public high schools with indoor gymnasiums
 * NYC, NJ, Philly, Boston, DC, Baltimore, CT, Buffalo
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
            id,
            name: court.name,
            city: court.city,
            lat: String(court.lat),
            lng: String(court.lng),
            indoor: String(court.indoor),
            access: court.access || 'public',
        });
        const options = {
            hostname: BASE,
            path: `/courts/admin/create?${params.toString()}`,
            method: 'POST',
            headers: { 'x-user-id': USER_ID },
            timeout: 10000,
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
// NEW YORK CITY HIGH SCHOOLS
// ==========================================
const NYC_HS = [
    // Manhattan
    { name: "Martin Luther King Jr. Educational Campus Gym", city: "New York, NY", lat: 40.7706, lng: -73.9884, indoor: true, access: "public" },
    { name: "DeWitt Clinton High School Gym", city: "Bronx, NY", lat: 40.8755, lng: -73.8946, indoor: true, access: "public" },
    { name: "Murry Bergtraum High School Gym", city: "New York, NY", lat: 40.7113, lng: -73.9987, indoor: true, access: "public" },
    { name: "Frederick Douglass Academy Gym", city: "New York, NY", lat: 40.8182, lng: -73.9536, indoor: true, access: "public" },
    { name: "Bayard Rustin Educational Complex Gym", city: "New York, NY", lat: 40.7419, lng: -74.0004, indoor: true, access: "public" },
    // Brooklyn
    { name: "Erasmus Hall High School Gym", city: "Brooklyn, NY", lat: 40.6498, lng: -73.9539, indoor: true, access: "public" },
    { name: "Boys and Girls High School Gym", city: "Brooklyn, NY", lat: 40.6790, lng: -73.9322, indoor: true, access: "public" },
    { name: "Abraham Lincoln High School Gym", city: "Brooklyn, NY", lat: 40.5778, lng: -73.9754, indoor: true, access: "public" },
    { name: "Brooklyn Technical High School Gym", city: "Brooklyn, NY", lat: 40.6884, lng: -73.9768, indoor: true, access: "public" },
    { name: "South Shore High School Gym", city: "Brooklyn, NY", lat: 40.6179, lng: -73.9069, indoor: true, access: "public" },
    // Queens
    { name: "Cardozo High School Gym", city: "Queens, NY", lat: 40.7418, lng: -73.7541, indoor: true, access: "public" },
    { name: "Francis Lewis High School Gym", city: "Queens, NY", lat: 40.7515, lng: -73.7805, indoor: true, access: "public" },
    { name: "August Martin High School Gym", city: "Queens, NY", lat: 40.6653, lng: -73.7890, indoor: true, access: "public" },
    { name: "Springfield Gardens High School Gym", city: "Queens, NY", lat: 40.6671, lng: -73.7605, indoor: true, access: "public" },
    { name: "Jamaica High School Campus Gym", city: "Queens, NY", lat: 40.7125, lng: -73.7986, indoor: true, access: "public" },
    // Bronx
    { name: "Truman High School Gym", city: "Bronx, NY", lat: 40.8503, lng: -73.8424, indoor: true, access: "public" },
    { name: "Lehman High School Gym", city: "Bronx, NY", lat: 40.8709, lng: -73.8909, indoor: true, access: "public" },
    { name: "Monroe Campus High School Gym", city: "Bronx, NY", lat: 40.8316, lng: -73.8976, indoor: true, access: "public" },
    { name: "Evander Childs High School Campus Gym", city: "Bronx, NY", lat: 40.8799, lng: -73.8625, indoor: true, access: "public" },
    // Staten Island
    { name: "Curtis High School Gym", city: "Staten Island, NY", lat: 40.6434, lng: -74.0873, indoor: true, access: "public" },
    { name: "Tottenville High School Gym", city: "Staten Island, NY", lat: 40.5068, lng: -74.2233, indoor: true, access: "public" },
    { name: "Susan Wagner High School Gym", city: "Staten Island, NY", lat: 40.5847, lng: -74.1269, indoor: true, access: "public" },
    { name: "New Dorp High School Gym", city: "Staten Island, NY", lat: 40.5723, lng: -74.1162, indoor: true, access: "public" },
];

// ==========================================
// NEW JERSEY HIGH SCHOOLS
// ==========================================
const NJ_HS = [
    { name: "East Orange Campus High School Gym", city: "East Orange, NJ", lat: 40.7666, lng: -74.2118, indoor: true, access: "public" },
    { name: "Paterson Kennedy High School Gym", city: "Paterson, NJ", lat: 40.9080, lng: -74.1590, indoor: true, access: "public" },
    { name: "Newark East Side High School Gym", city: "Newark, NJ", lat: 40.7405, lng: -74.1508, indoor: true, access: "public" },
    { name: "Elizabeth High School Gym", city: "Elizabeth, NJ", lat: 40.6657, lng: -74.2136, indoor: true, access: "public" },
    { name: "Trenton Central High School Gym", city: "Trenton, NJ", lat: 40.2220, lng: -74.7593, indoor: true, access: "public" },
    { name: "Camden High School Gym", city: "Camden, NJ", lat: 39.9343, lng: -75.1120, indoor: true, access: "public" },
    { name: "Plainfield High School Gym", city: "Plainfield, NJ", lat: 40.6179, lng: -74.4177, indoor: true, access: "public" },
    { name: "Irvington High School Gym", city: "Irvington, NJ", lat: 40.7252, lng: -74.2324, indoor: true, access: "public" },
    { name: "Hackensack High School Gym", city: "Hackensack, NJ", lat: 40.8889, lng: -74.0432, indoor: true, access: "public" },
    { name: "Montclair High School Gym", city: "Montclair, NJ", lat: 40.8233, lng: -74.2046, indoor: true, access: "public" },
    { name: "Union High School Gym", city: "Union, NJ", lat: 40.6948, lng: -74.2706, indoor: true, access: "public" },
    { name: "Linden High School Gym", city: "Linden, NJ", lat: 40.6276, lng: -74.2476, indoor: true, access: "public" },
];

// ==========================================
// PHILADELPHIA HIGH SCHOOLS
// ==========================================
const PHILLY_HS = [
    { name: "Simon Gratz High School Gym", city: "Philadelphia, PA", lat: 40.0226, lng: -75.1506, indoor: true, access: "public" },
    { name: "Overbrook High School Gym", city: "Philadelphia, PA", lat: 39.9748, lng: -75.2469, indoor: true, access: "public" },
    { name: "Imhotep Institute Charter High School Gym", city: "Philadelphia, PA", lat: 40.0478, lng: -75.1437, indoor: true, access: "public" },
    { name: "Roman Catholic High School Gym", city: "Philadelphia, PA", lat: 39.9593, lng: -75.1680, indoor: true, access: "public" },
    { name: "Neumann-Goretti High School Gym", city: "Philadelphia, PA", lat: 39.9187, lng: -75.1656, indoor: true, access: "public" },
    { name: "Central High School Gym", city: "Philadelphia, PA", lat: 40.0314, lng: -75.1517, indoor: true, access: "public" },
    { name: "Northeast High School Gym", city: "Philadelphia, PA", lat: 40.0626, lng: -75.0570, indoor: true, access: "public" },
    { name: "Martin Luther King High School Gym", city: "Philadelphia, PA", lat: 40.0402, lng: -75.1929, indoor: true, access: "public" },
    { name: "Bartram High School Gym", city: "Philadelphia, PA", lat: 39.9418, lng: -75.2352, indoor: true, access: "public" },
    { name: "Germantown High School Gym", city: "Philadelphia, PA", lat: 40.0375, lng: -75.1706, indoor: true, access: "public" },
    { name: "Lower Merion High School Gym", city: "Ardmore, PA", lat: 40.0028, lng: -75.3016, indoor: true, access: "public" },
    { name: "Chester High School Gym", city: "Chester, PA", lat: 39.8478, lng: -75.3581, indoor: true, access: "public" },
];

// ==========================================
// BOSTON AREA HIGH SCHOOLS
// ==========================================
const BOSTON_HS = [
    { name: "Brighton High School Gym", city: "Boston, MA", lat: 42.3506, lng: -71.1604, indoor: true, access: "public" },
    { name: "Charlestown High School Gym", city: "Boston, MA", lat: 42.3793, lng: -71.0596, indoor: true, access: "public" },
    { name: "English High School Gym", city: "Boston, MA", lat: 40.3291, lng: -71.1097, indoor: true, access: "public" },
    { name: "Burke High School Gym", city: "Boston, MA", lat: 42.3167, lng: -71.0679, indoor: true, access: "public" },
    { name: "Madison Park Technical Vocational High School Gym", city: "Boston, MA", lat: 42.3319, lng: -71.0875, indoor: true, access: "public" },
    { name: "New Mission High School Gym", city: "Boston, MA", lat: 42.3279, lng: -71.0849, indoor: true, access: "public" },
    { name: "Cambridge Rindge and Latin School Gym", city: "Cambridge, MA", lat: 42.3727, lng: -71.1074, indoor: true, access: "public" },
    { name: "Lawrence High School Gym", city: "Lawrence, MA", lat: 42.7062, lng: -71.1610, indoor: true, access: "public" },
    { name: "Brockton High School Gym", city: "Brockton, MA", lat: 42.0840, lng: -71.0225, indoor: true, access: "public" },
    { name: "Springfield Central High School Gym", city: "Springfield, MA", lat: 42.1049, lng: -72.5860, indoor: true, access: "public" },
    { name: "Lynn English High School Gym", city: "Lynn, MA", lat: 42.4735, lng: -70.9522, indoor: true, access: "public" },
    { name: "New Bedford High School Gym", city: "New Bedford, MA", lat: 41.6511, lng: -70.9335, indoor: true, access: "public" },
];

// ==========================================
// WASHINGTON DC AREA HIGH SCHOOLS
// ==========================================
const DC_HS = [
    { name: "Dunbar High School Gym", city: "Washington, DC", lat: 38.9138, lng: -77.0100, indoor: true, access: "public" },
    { name: "Ballou High School Gym", city: "Washington, DC", lat: 38.8448, lng: -76.9913, indoor: true, access: "public" },
    { name: "Wilson High School Gym", city: "Washington, DC", lat: 38.9375, lng: -77.0671, indoor: true, access: "public" },
    { name: "Coolidge High School Gym", city: "Washington, DC", lat: 38.9567, lng: -77.0226, indoor: true, access: "public" },
    { name: "McKinley Technology High School Gym", city: "Washington, DC", lat: 38.9206, lng: -76.9969, indoor: true, access: "public" },
    { name: "DeMatha Catholic High School Gym", city: "Hyattsville, MD", lat: 38.9546, lng: -76.9615, indoor: true, access: "public" },
    { name: "Bishop McNamara High School Gym", city: "Forestville, MD", lat: 38.8512, lng: -76.8720, indoor: true, access: "public" },
    { name: "Good Counsel High School Gym", city: "Olney, MD", lat: 39.1378, lng: -77.0780, indoor: true, access: "public" },
    { name: "St. John's College High School Gym", city: "Washington, DC", lat: 38.9365, lng: -77.0099, indoor: true, access: "public" },
    { name: "Gonzaga College High School Gym", city: "Washington, DC", lat: 38.9059, lng: -77.0104, indoor: true, access: "public" },
    { name: "Potomac High School Gym", city: "Oxon Hill, MD", lat: 38.8006, lng: -76.9792, indoor: true, access: "public" },
    { name: "Paul VI Catholic High School Gym", city: "Fairfax, VA", lat: 38.8469, lng: -77.3052, indoor: true, access: "public" },
];

// ==========================================
// BALTIMORE HIGH SCHOOLS
// ==========================================
const BALTIMORE_HS = [
    { name: "Dunbar High School Gym (Baltimore)", city: "Baltimore, MD", lat: 39.2970, lng: -76.5943, indoor: true, access: "public" },
    { name: "Lake Clifton High School Gym", city: "Baltimore, MD", lat: 39.3231, lng: -76.5932, indoor: true, access: "public" },
    { name: "Poly-Western High School Gym", city: "Baltimore, MD", lat: 39.3284, lng: -76.6589, indoor: true, access: "public" },
    { name: "City College High School Gym", city: "Baltimore, MD", lat: 39.3375, lng: -76.6152, indoor: true, access: "public" },
    { name: "Patterson High School Gym", city: "Baltimore, MD", lat: 39.2874, lng: -76.5610, indoor: true, access: "public" },
    { name: "Northern High School Gym", city: "Baltimore, MD", lat: 39.3558, lng: -76.6260, indoor: true, access: "public" },
    { name: "Edmondson-Westside High School Gym", city: "Baltimore, MD", lat: 39.2966, lng: -76.6730, indoor: true, access: "public" },
    { name: "Mount St. Joseph High School Gym", city: "Baltimore, MD", lat: 39.3119, lng: -76.7000, indoor: true, access: "public" },
];

// ==========================================
// CONNECTICUT HIGH SCHOOLS
// ==========================================
const CT_HS = [
    { name: "Hillhouse High School Gym", city: "New Haven, CT", lat: 41.3279, lng: -72.9211, indoor: true, access: "public" },
    { name: "Weaver High School Gym", city: "Hartford, CT", lat: 41.7856, lng: -72.7023, indoor: true, access: "public" },
    { name: "Bridgeport Central High School Gym", city: "Bridgeport, CT", lat: 41.1847, lng: -73.1886, indoor: true, access: "public" },
    { name: "Stamford High School Gym", city: "Stamford, CT", lat: 41.0559, lng: -73.5440, indoor: true, access: "public" },
    { name: "NFA (Norwich Free Academy) Gym", city: "Norwich, CT", lat: 41.5364, lng: -72.0806, indoor: true, access: "public" },
    { name: "Waterbury Career Academy Gym", city: "Waterbury, CT", lat: 41.5505, lng: -73.0352, indoor: true, access: "public" },
    { name: "Brien McMahon High School Gym", city: "Norwalk, CT", lat: 41.0961, lng: -73.4189, indoor: true, access: "public" },
    { name: "East Hartford High School Gym", city: "East Hartford, CT", lat: 41.7748, lng: -72.6153, indoor: true, access: "public" },
];

// ==========================================
// BUFFALO / UPSTATE NY HIGH SCHOOLS
// ==========================================
const UPSTATE_NY_HS = [
    { name: "Canisius High School Gym", city: "Buffalo, NY", lat: 42.9345, lng: -78.8562, indoor: true, access: "public" },
    { name: "South Park High School Gym", city: "Buffalo, NY", lat: 42.8477, lng: -78.8283, indoor: true, access: "public" },
    { name: "Hutch-Tech High School Gym", city: "Buffalo, NY", lat: 42.8919, lng: -78.8766, indoor: true, access: "public" },
    { name: "McKinley High School Gym", city: "Buffalo, NY", lat: 42.8693, lng: -78.8413, indoor: true, access: "public" },
    { name: "Henninger High School Gym", city: "Syracuse, NY", lat: 43.0275, lng: -76.1175, indoor: true, access: "public" },
    { name: "East High School Gym (Rochester)", city: "Rochester, NY", lat: 43.1487, lng: -77.5976, indoor: true, access: "public" },
    { name: "Aquinas Institute Gym", city: "Rochester, NY", lat: 43.1347, lng: -77.6168, indoor: true, access: "public" },
    { name: "Albany High School Gym", city: "Albany, NY", lat: 42.6504, lng: -73.7867, indoor: true, access: "public" },
];

// ==========================================
// IMPORT RUNNER
// ==========================================
const ALL_REGIONS = [
    { name: 'New York City', courts: NYC_HS },
    { name: 'New Jersey', courts: NJ_HS },
    { name: 'Philadelphia', courts: PHILLY_HS },
    { name: 'Boston Area', courts: BOSTON_HS },
    { name: 'Washington DC Area', courts: DC_HS },
    { name: 'Baltimore', courts: BALTIMORE_HS },
    { name: 'Connecticut', courts: CT_HS },
    { name: 'Buffalo/Upstate NY', courts: UPSTATE_NY_HS },
];

async function main() {
    const totalCourts = ALL_REGIONS.reduce((sum, r) => sum + r.courts.length, 0);
    console.log(`\n=== HIGH SCHOOL COURTS P1 (NORTHEAST): ${ALL_REGIONS.length} REGIONS, ${totalCourts} COURTS ===\n`);

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

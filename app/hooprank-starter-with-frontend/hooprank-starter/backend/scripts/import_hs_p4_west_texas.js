/**
 * High School Courts — Part 4: West Coast, Texas, Mountain West
 * Major public high schools with indoor gymnasiums
 * LA, SF, Seattle, Portland, Phoenix, Denver, Vegas, SLC, San Diego, Houston, DFW, San Antonio
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
// LOS ANGELES HIGH SCHOOLS
// ==========================================
const LA_HS = [
    { name: "Crenshaw High School Gym", city: "Los Angeles, CA", lat: 34.0062, lng: -118.3320, indoor: true, access: "public" },
    { name: "Westchester High School Gym", city: "Los Angeles, CA", lat: 33.9622, lng: -118.4032, indoor: true, access: "public" },
    { name: "Dorsey High School Gym", city: "Los Angeles, CA", lat: 34.0218, lng: -118.3458, indoor: true, access: "public" },
    { name: "Fairfax High School Gym", city: "Los Angeles, CA", lat: 34.0778, lng: -118.3618, indoor: true, access: "public" },
    { name: "Manual Arts High School Gym", city: "Los Angeles, CA", lat: 34.0017, lng: -118.2893, indoor: true, access: "public" },
    { name: "Fremont High School Gym", city: "Los Angeles, CA", lat: 33.9534, lng: -118.2584, indoor: true, access: "public" },
    { name: "Taft High School Gym", city: "Woodland Hills, CA", lat: 34.1727, lng: -118.6083, indoor: true, access: "public" },
    { name: "Birmingham Community Charter High School Gym", city: "Lake Balboa, CA", lat: 34.1880, lng: -118.5006, indoor: true, access: "public" },
    { name: "Mater Dei High School Gym", city: "Santa Ana, CA", lat: 33.7456, lng: -117.8662, indoor: true, access: "public" },
    { name: "Centennial High School Gym", city: "Compton, CA", lat: 33.8891, lng: -118.2073, indoor: true, access: "public" },
    { name: "Compton High School Gym", city: "Compton, CA", lat: 33.8993, lng: -118.2197, indoor: true, access: "public" },
    { name: "Dominguez High School Gym", city: "Compton, CA", lat: 33.8715, lng: -118.2260, indoor: true, access: "public" },
    { name: "Long Beach Poly High School Gym", city: "Long Beach, CA", lat: 33.7872, lng: -118.1664, indoor: true, access: "public" },
    { name: "Etiwanda High School Gym", city: "Rancho Cucamonga, CA", lat: 34.1494, lng: -117.5431, indoor: true, access: "public" },
    { name: "Sierra Canyon School Gym", city: "Chatsworth, CA", lat: 34.2517, lng: -118.5989, indoor: true, access: "members" },
];

// ==========================================
// SAN FRANCISCO BAY AREA HIGH SCHOOLS
// ==========================================
const SF_HS = [
    { name: "Mission High School Gym", city: "San Francisco, CA", lat: 37.7629, lng: -122.4279, indoor: true, access: "public" },
    { name: "Lincoln High School Gym (SF)", city: "San Francisco, CA", lat: 37.7440, lng: -122.4871, indoor: true, access: "public" },
    { name: "Balboa High School Gym", city: "San Francisco, CA", lat: 37.7254, lng: -122.4390, indoor: true, access: "public" },
    { name: "Galileo High School Gym", city: "San Francisco, CA", lat: 37.8015, lng: -122.4218, indoor: true, access: "public" },
    { name: "O'Connell High School Gym", city: "San Francisco, CA", lat: 37.7104, lng: -122.4129, indoor: true, access: "public" },
    { name: "Oakland High School Gym", city: "Oakland, CA", lat: 37.7774, lng: -122.1851, indoor: true, access: "public" },
    { name: "McClymonds High School Gym", city: "Oakland, CA", lat: 37.8121, lng: -122.2933, indoor: true, access: "public" },
    { name: "Bishop O'Dowd High School Gym", city: "Oakland, CA", lat: 37.7943, lng: -122.2054, indoor: true, access: "public" },
    { name: "De La Salle High School Gym", city: "Concord, CA", lat: 37.9585, lng: -122.0233, indoor: true, access: "public" },
    { name: "Mitty High School Gym", city: "San Jose, CA", lat: 37.2987, lng: -121.8670, indoor: true, access: "public" },
    { name: "Bellarmine College Prep Gym", city: "San Jose, CA", lat: 37.3398, lng: -121.8982, indoor: true, access: "public" },
    { name: "Salesian High School Gym", city: "Richmond, CA", lat: 37.9378, lng: -122.3527, indoor: true, access: "public" },
];

// ==========================================
// SEATTLE / PACIFIC NW HIGH SCHOOLS
// ==========================================
const SEATTLE_HS = [
    { name: "Garfield High School Gym", city: "Seattle, WA", lat: 47.6130, lng: -122.3094, indoor: true, access: "public" },
    { name: "Rainier Beach High School Gym", city: "Seattle, WA", lat: 47.5166, lng: -122.2677, indoor: true, access: "public" },
    { name: "O'Dea High School Gym", city: "Seattle, WA", lat: 47.6118, lng: -122.3232, indoor: true, access: "public" },
    { name: "Eastside Catholic School Gym", city: "Sammamish, WA", lat: 47.5823, lng: -122.0636, indoor: true, access: "public" },
    { name: "Federal Way High School Gym", city: "Federal Way, WA", lat: 47.3221, lng: -122.3112, indoor: true, access: "public" },
    { name: "Kentwood High School Gym", city: "Kent, WA", lat: 47.3567, lng: -122.1939, indoor: true, access: "public" },
    { name: "Jefferson High School Gym (Portland)", city: "Portland, OR", lat: 45.5614, lng: -122.6836, indoor: true, access: "public" },
    { name: "Grant High School Gym (Portland)", city: "Portland, OR", lat: 45.5515, lng: -122.6353, indoor: true, access: "public" },
];

// ==========================================
// TEXAS HIGH SCHOOLS (Houston, DFW, San Antonio)
// ==========================================
const TX_HS = [
    // Houston
    { name: "Yates High School Gym", city: "Houston, TX", lat: 29.7060, lng: -95.3510, indoor: true, access: "public" },
    { name: "Westbury High School Gym", city: "Houston, TX", lat: 29.6588, lng: -95.4760, indoor: true, access: "public" },
    { name: "Wheatley High School Gym", city: "Houston, TX", lat: 29.7760, lng: -95.3254, indoor: true, access: "public" },
    { name: "North Shore High School Gym", city: "Houston, TX", lat: 29.7761, lng: -95.1619, indoor: true, access: "public" },
    { name: "Hightower High School Gym", city: "Missouri City, TX", lat: 29.5610, lng: -95.5302, indoor: true, access: "public" },
    { name: "Fort Bend Bush High School Gym", city: "Richmond, TX", lat: 29.5805, lng: -95.6916, indoor: true, access: "public" },
    // DFW
    { name: "South Oak Cliff High School Gym", city: "Dallas, TX", lat: 32.7019, lng: -96.8233, indoor: true, access: "public" },
    { name: "Kimball High School Gym", city: "Dallas, TX", lat: 32.6794, lng: -96.8614, indoor: true, access: "public" },
    { name: "Lancaster High School Gym", city: "Lancaster, TX", lat: 32.5980, lng: -96.7696, indoor: true, access: "public" },
    { name: "Duncanville High School Gym", city: "Duncanville, TX", lat: 32.6433, lng: -96.9062, indoor: true, access: "public" },
    { name: "DeSoto High School Gym", city: "DeSoto, TX", lat: 32.5918, lng: -96.8572, indoor: true, access: "public" },
    { name: "Mansfield Timberview High School Gym", city: "Arlington, TX", lat: 32.6522, lng: -97.1073, indoor: true, access: "public" },
    // San Antonio
    { name: "Judson High School Gym", city: "Converse, TX", lat: 29.5268, lng: -98.3155, indoor: true, access: "public" },
    { name: "Wagner High School Gym", city: "San Antonio, TX", lat: 29.4647, lng: -98.3424, indoor: true, access: "public" },
    { name: "Sam Houston High School Gym (SA)", city: "San Antonio, TX", lat: 29.4469, lng: -98.4525, indoor: true, access: "public" },
    { name: "Lanier High School Gym", city: "San Antonio, TX", lat: 29.4509, lng: -98.5371, indoor: true, access: "public" },
];

// ==========================================
// PHOENIX / ARIZONA HIGH SCHOOLS
// ==========================================
const AZ_HS = [
    { name: "North High School Gym (Phoenix)", city: "Phoenix, AZ", lat: 33.5075, lng: -112.0737, indoor: true, access: "public" },
    { name: "South Mountain High School Gym", city: "Phoenix, AZ", lat: 33.3923, lng: -112.0480, indoor: true, access: "public" },
    { name: "Maryvale High School Gym", city: "Phoenix, AZ", lat: 33.5071, lng: -112.1488, indoor: true, access: "public" },
    { name: "Perry High School Gym", city: "Gilbert, AZ", lat: 33.2929, lng: -111.7299, indoor: true, access: "public" },
    { name: "Mountain Pointe High School Gym", city: "Phoenix, AZ", lat: 33.3492, lng: -111.9849, indoor: true, access: "public" },
    { name: "Westview High School Gym", city: "Avondale, AZ", lat: 33.4302, lng: -112.3007, indoor: true, access: "public" },
    { name: "Mesa High School Gym", city: "Mesa, AZ", lat: 33.4142, lng: -111.8193, indoor: true, access: "public" },
    { name: "Chandler High School Gym", city: "Chandler, AZ", lat: 33.2917, lng: -111.8392, indoor: true, access: "public" },
];

// ==========================================
// DENVER / COLORADO HIGH SCHOOLS
// ==========================================
const CO_HS = [
    { name: "East High School Gym (Denver)", city: "Denver, CO", lat: 39.7390, lng: -104.9581, indoor: true, access: "public" },
    { name: "George Washington High School Gym", city: "Denver, CO", lat: 39.6855, lng: -104.9290, indoor: true, access: "public" },
    { name: "Montbello High School Gym", city: "Denver, CO", lat: 39.7906, lng: -104.8382, indoor: true, access: "public" },
    { name: "Thomas Jefferson High School Gym", city: "Denver, CO", lat: 39.6765, lng: -104.9836, indoor: true, access: "public" },
    { name: "Overland High School Gym", city: "Aurora, CO", lat: 39.6350, lng: -104.8292, indoor: true, access: "public" },
    { name: "Regis Jesuit High School Gym", city: "Aurora, CO", lat: 39.6160, lng: -104.8498, indoor: true, access: "public" },
    { name: "Eaglecrest High School Gym", city: "Centennial, CO", lat: 39.5897, lng: -104.8038, indoor: true, access: "public" },
    { name: "Rangeview High School Gym", city: "Aurora, CO", lat: 39.7261, lng: -104.7946, indoor: true, access: "public" },
];

// ==========================================
// LAS VEGAS / SALT LAKE / ALBUQUERQUE / TUCSON
// ==========================================
const MOUNTAIN_HS = [
    { name: "Clark High School Gym", city: "Las Vegas, NV", lat: 36.1375, lng: -115.0931, indoor: true, access: "public" },
    { name: "Durango High School Gym", city: "Las Vegas, NV", lat: 36.0543, lng: -115.2489, indoor: true, access: "public" },
    { name: "Bishop Gorman High School Gym", city: "Las Vegas, NV", lat: 36.0253, lng: -115.2620, indoor: true, access: "members" },
    { name: "Spring Valley High School Gym", city: "Las Vegas, NV", lat: 36.0909, lng: -115.2740, indoor: true, access: "public" },
    { name: "Centennial High School Gym (LV)", city: "Las Vegas, NV", lat: 36.2641, lng: -115.2227, indoor: true, access: "public" },
    { name: "East High School Gym (SLC)", city: "Salt Lake City, UT", lat: 40.7510, lng: -111.8553, indoor: true, access: "public" },
    { name: "Highland High School Gym (SLC)", city: "Salt Lake City, UT", lat: 40.7160, lng: -111.8444, indoor: true, access: "public" },
    { name: "West High School Gym (SLC)", city: "Salt Lake City, UT", lat: 40.7750, lng: -111.9037, indoor: true, access: "public" },
    { name: "Albuquerque High School Gym", city: "Albuquerque, NM", lat: 35.0760, lng: -106.6358, indoor: true, access: "public" },
    { name: "Highland High School Gym (ABQ)", city: "Albuquerque, NM", lat: 35.0808, lng: -106.5814, indoor: true, access: "public" },
    { name: "Tucson High Magnet School Gym", city: "Tucson, AZ", lat: 32.2159, lng: -110.9686, indoor: true, access: "public" },
    { name: "Salpointe Catholic High School Gym", city: "Tucson, AZ", lat: 32.2242, lng: -110.9472, indoor: true, access: "public" },
];

// ==========================================
// SAN DIEGO HIGH SCHOOLS
// ==========================================
const SD_HS = [
    { name: "Lincoln High School Gym (SD)", city: "San Diego, CA", lat: 32.6946, lng: -117.1265, indoor: true, access: "public" },
    { name: "Hoover High School Gym", city: "San Diego, CA", lat: 32.7464, lng: -117.0998, indoor: true, access: "public" },
    { name: "Cathedral Catholic High School Gym", city: "San Diego, CA", lat: 32.8914, lng: -117.2149, indoor: true, access: "public" },
    { name: "San Diego High School Gym", city: "San Diego, CA", lat: 32.7113, lng: -117.1491, indoor: true, access: "public" },
    { name: "St. Augustine High School Gym", city: "San Diego, CA", lat: 32.7571, lng: -117.1340, indoor: true, access: "public" },
    { name: "El Camino High School Gym", city: "Oceanside, CA", lat: 33.2177, lng: -117.3283, indoor: true, access: "public" },
];

// ==========================================
// HAWAII HIGH SCHOOLS
// ==========================================
const HI_HS = [
    { name: "Punahou School Gym", city: "Honolulu, HI", lat: 21.2997, lng: -157.8212, indoor: true, access: "members" },
    { name: "Iolani School Gym", city: "Honolulu, HI", lat: 21.2835, lng: -157.8166, indoor: true, access: "members" },
    { name: "Maryknoll School Gym", city: "Honolulu, HI", lat: 21.2924, lng: -157.8260, indoor: true, access: "members" },
    { name: "Farrington High School Gym", city: "Honolulu, HI", lat: 21.3259, lng: -157.8635, indoor: true, access: "public" },
    { name: "McKinley High School Gym", city: "Honolulu, HI", lat: 21.2876, lng: -157.8504, indoor: true, access: "public" },
    { name: "Kahuku High School Gym", city: "Kahuku, HI", lat: 21.6803, lng: -157.9505, indoor: true, access: "public" },
];

// ==========================================
// IMPORT RUNNER
// ==========================================
const ALL_REGIONS = [
    { name: 'Los Angeles', courts: LA_HS },
    { name: 'San Francisco/Bay Area', courts: SF_HS },
    { name: 'Seattle/Pacific NW', courts: SEATTLE_HS },
    { name: 'Texas (Houston/DFW/SA)', courts: TX_HS },
    { name: 'Phoenix/Arizona', courts: AZ_HS },
    { name: 'Denver/Colorado', courts: CO_HS },
    { name: 'Mountain West', courts: MOUNTAIN_HS },
    { name: 'San Diego', courts: SD_HS },
    { name: 'Hawaii', courts: HI_HS },
];

async function main() {
    const totalCourts = ALL_REGIONS.reduce((sum, r) => sum + r.courts.length, 0);
    console.log(`\n=== HIGH SCHOOL COURTS P4 (WEST & TEXAS): ${ALL_REGIONS.length} REGIONS, ${totalCourts} COURTS ===\n`);

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

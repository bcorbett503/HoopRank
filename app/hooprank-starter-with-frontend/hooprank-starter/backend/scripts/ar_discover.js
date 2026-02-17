/**
 * Arkansas Statewide Indoor Court Discovery Pipeline
 * 
 * Uses Google Places API (New) searchText to discover ALL indoor basketball
 * courts across the state of Arkansas.
 * 
 * Major metros: Little Rock, Fort Smith, Fayetteville, Springdale, Jonesboro,
 * Pine Bluff, Conway, Rogers, Bentonville, Hot Springs, Texarkana, Russellville,
 * Searcy, Van Buren, Paragould, Cabot, Jacksonville, Sherwood, Bryant, Benton,
 * Maumelle, North Little Rock, West Memphis, Blytheville, Mountain Home,
 * Harrison, Siloam Springs, El Dorado, Magnolia, Arkadelphia, Monticello, etc.
 */
const https = require('https');
const crypto = require('crypto');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) { console.error('❌ GOOGLE_API_KEY env var required'); process.exit(1); }
const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpPost(hostname, path, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = { hostname, path, method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, timeout: 15000 };
        const req = https.request(options, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); } }); });
        req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        if (body) req.write(JSON.stringify(body)); req.end();
    });
}
function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { timeout: 30000 }, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON parse error')); } }); }).on('error', reject);
    });
}
function httpPostRailway(path) {
    return new Promise((resolve, reject) => {
        const options = { hostname: BASE, path, method: 'POST', headers: { 'x-user-id': USER_ID }, timeout: 10000 };
        const req = https.request(options, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => resolve({ status: res.statusCode, data })); });
        req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); }); req.end();
    });
}
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const QUERIES = [
    // ══════════════════════════════════════════════
    // LITTLE ROCK METRO (Central AR — Capital City)
    // ══════════════════════════════════════════════
    'school gymnasium Little Rock AR',
    'elementary school gym basketball Little Rock AR',
    'middle school gymnasium Little Rock AR',
    'high school gymnasium Little Rock AR',
    'basketball gym Little Rock AR',
    'recreation center basketball Little Rock AR',
    'community center gym Little Rock AR',
    'YMCA basketball Little Rock AR',
    'Boys and Girls Club Little Rock AR',
    'Parks and Recreation gym Little Rock AR',
    'indoor basketball court Little Rock Arkansas',

    // LR neighborhoods
    'school gym West Little Rock AR',
    'school gym North Little Rock AR',
    'school gym Southwest Little Rock AR',
    'school gym Midtown Little Rock AR',
    'school gym Hillcrest Little Rock AR',
    'school gym Heights Little Rock AR',

    // LR suburbs
    'school gymnasium North Little Rock AR',
    'basketball gym North Little Rock AR',
    'recreation center basketball North Little Rock AR',
    'school gymnasium Conway AR',
    'basketball gym Conway AR',
    'recreation center basketball Conway AR',
    'school gymnasium Cabot AR',
    'basketball gym Cabot AR',
    'school gymnasium Jacksonville AR',
    'school gymnasium Sherwood AR',
    'school gymnasium Bryant AR',
    'school gymnasium Benton AR',
    'school gymnasium Maumelle AR',
    'school gymnasium Lonoke AR',
    'school gymnasium Haskell AR',
    'school gymnasium Vilonia AR',
    'school gymnasium Greenbrier AR',
    'school gymnasium Mayflower AR',
    'school gymnasium Austin AR',
    'school gymnasium Beebe AR',
    'school gymnasium England AR',
    'community center gym Pulaski County AR',
    'community center gym Saline County AR',
    'community center gym Faulkner County AR',

    // ══════════════════════════════════════════════
    // NORTHWEST ARKANSAS (Fayetteville–Springdale–Rogers–Bentonville)
    // ══════════════════════════════════════════════
    'school gymnasium Fayetteville AR',
    'elementary school gym basketball Fayetteville AR',
    'middle school gymnasium Fayetteville AR',
    'high school gymnasium Fayetteville AR',
    'basketball gym Fayetteville AR',
    'recreation center basketball Fayetteville AR',
    'community center gym Fayetteville AR',
    'YMCA basketball Fayetteville AR',
    'indoor basketball court Fayetteville Arkansas',

    'school gymnasium Springdale AR',
    'basketball gym Springdale AR',
    'recreation center basketball Springdale AR',
    'school gymnasium Rogers AR',
    'basketball gym Rogers AR',
    'recreation center basketball Rogers AR',
    'school gymnasium Bentonville AR',
    'basketball gym Bentonville AR',
    'recreation center basketball Bentonville AR',

    'school gymnasium Siloam Springs AR',
    'school gymnasium Bella Vista AR',
    'school gymnasium Farmington AR',
    'school gymnasium Prairie Grove AR',
    'school gymnasium Centerton AR',
    'school gymnasium Gentry AR',
    'school gymnasium Pea Ridge AR',
    'school gymnasium Gravette AR',
    'school gymnasium Lincoln AR',
    'school gymnasium Elkins AR',
    'school gymnasium Decatur AR',
    'school gymnasium Lowell AR',
    'YMCA basketball Northwest Arkansas',
    'community center gym Benton County AR',
    'community center gym Washington County AR',

    // ══════════════════════════════════════════════
    // FORT SMITH METRO (Western AR)
    // ══════════════════════════════════════════════
    'school gymnasium Fort Smith AR',
    'elementary school gym basketball Fort Smith AR',
    'middle school gymnasium Fort Smith AR',
    'high school gymnasium Fort Smith AR',
    'basketball gym Fort Smith AR',
    'recreation center basketball Fort Smith AR',
    'community center gym Fort Smith AR',
    'YMCA basketball Fort Smith AR',
    'indoor basketball court Fort Smith Arkansas',

    'school gymnasium Van Buren AR',
    'basketball gym Van Buren AR',
    'school gymnasium Alma AR',
    'school gymnasium Greenwood AR',
    'school gymnasium Barling AR',
    'school gymnasium Mansfield AR',
    'school gymnasium Ozark AR',
    'school gymnasium Paris AR',
    'school gymnasium Booneville AR',
    'school gymnasium Waldron AR',
    'community center gym Sebastian County AR',

    // ══════════════════════════════════════════════
    // JONESBORO (Northeast AR)
    // ══════════════════════════════════════════════
    'school gymnasium Jonesboro AR',
    'elementary school gym basketball Jonesboro AR',
    'high school gymnasium Jonesboro AR',
    'basketball gym Jonesboro AR',
    'recreation center basketball Jonesboro AR',
    'community center gym Jonesboro AR',
    'YMCA basketball Jonesboro AR',
    'indoor basketball court Jonesboro Arkansas',

    'school gymnasium Paragould AR',
    'school gymnasium Trumann AR',
    'school gymnasium Marked Tree AR',
    'school gymnasium Bay AR',
    'school gymnasium Brookland AR',
    'school gymnasium Nettleton AR',
    'school gymnasium Lake City AR',
    'community center gym Craighead County AR',

    // ══════════════════════════════════════════════
    // PINE BLUFF / SOUTHEAST AR
    // ══════════════════════════════════════════════
    'school gymnasium Pine Bluff AR',
    'basketball gym Pine Bluff AR',
    'recreation center basketball Pine Bluff AR',
    'YMCA basketball Pine Bluff AR',
    'school gymnasium White Hall AR',
    'school gymnasium Star City AR',
    'school gymnasium Monticello AR',
    'school gymnasium Crossett AR',
    'school gymnasium McGehee AR',
    'school gymnasium DeWitt AR',
    'school gymnasium Stuttgart AR',
    'school gymnasium Warren AR',
    'school gymnasium Dumas AR',
    'community center gym Jefferson County AR',

    // ══════════════════════════════════════════════
    // HOT SPRINGS / WEST CENTRAL AR
    // ══════════════════════════════════════════════
    'school gymnasium Hot Springs AR',
    'basketball gym Hot Springs AR',
    'recreation center basketball Hot Springs AR',
    'YMCA basketball Hot Springs AR',
    'indoor basketball court Hot Springs Arkansas',
    'school gymnasium Malvern AR',
    'school gymnasium Arkadelphia AR',
    'school gymnasium Hot Springs Village AR',
    'school gymnasium Jessieville AR',
    'school gymnasium Lake Hamilton AR',
    'school gymnasium Fountain Lake AR',
    'community center gym Garland County AR',

    // ══════════════════════════════════════════════
    // TEXARKANA / SOUTHWEST AR
    // ══════════════════════════════════════════════
    'school gymnasium Texarkana AR',
    'basketball gym Texarkana AR',
    'school gymnasium Hope AR',
    'school gymnasium Magnolia AR',
    'school gymnasium El Dorado AR',
    'school gymnasium Camden AR',
    'school gymnasium Prescott AR',
    'school gymnasium Nashville AR',
    'school gymnasium Ashdown AR',
    'community center gym Miller County AR',

    // ══════════════════════════════════════════════
    // RUSSELLVILLE / RIVER VALLEY
    // ══════════════════════════════════════════════
    'school gymnasium Russellville AR',
    'basketball gym Russellville AR',
    'recreation center basketball Russellville AR',
    'school gymnasium Clarksville AR',
    'school gymnasium Dardanelle AR',
    'school gymnasium Morrilton AR',
    'school gymnasium Atkins AR',
    'school gymnasium Pottsville AR',
    'school gymnasium Hector AR',
    'community center gym Pope County AR',

    // ══════════════════════════════════════════════
    // SEARCY / WHITE COUNTY
    // ══════════════════════════════════════════════
    'school gymnasium Searcy AR',
    'basketball gym Searcy AR',
    'recreation center basketball Searcy AR',
    'school gymnasium Bald Knob AR',
    'school gymnasium Pangburn AR',
    'school gymnasium Rose Bud AR',
    'community center gym White County AR',

    // ══════════════════════════════════════════════
    // WEST MEMPHIS / EAST AR
    // ══════════════════════════════════════════════
    'school gymnasium West Memphis AR',
    'basketball gym West Memphis AR',
    'school gymnasium Blytheville AR',
    'school gymnasium Forrest City AR',
    'school gymnasium Helena AR',
    'school gymnasium Marion AR',
    'school gymnasium Osceola AR',
    'school gymnasium Wynne AR',
    'community center gym Crittenden County AR',

    // ══════════════════════════════════════════════
    // MOUNTAIN HOME / NORTH CENTRAL AR (Ozarks)
    // ══════════════════════════════════════════════
    'school gymnasium Mountain Home AR',
    'basketball gym Mountain Home AR',
    'school gymnasium Harrison AR',
    'school gymnasium Batesville AR',
    'school gymnasium Mountain View AR',
    'school gymnasium Salem AR',
    'school gymnasium Yellville AR',
    'school gymnasium Clinton AR',
    'school gymnasium Flippin AR',
    'school gymnasium Cotter AR',
    'school gymnasium Melbourne AR',
    'school gymnasium Calico Rock AR',
    'school gymnasium Heber Springs AR',
    'community center gym Baxter County AR',

    // ══════════════════════════════════════════════
    // COLLEGES & UNIVERSITIES
    // ══════════════════════════════════════════════
    'University of Arkansas gym basketball Fayetteville',
    'University of Arkansas at Little Rock gym basketball',
    'University of Arkansas at Pine Bluff gym basketball',
    'University of Arkansas at Monticello gym basketball',
    'University of Arkansas Fort Smith gym basketball',
    'University of Central Arkansas Conway gym basketball',
    'Arkansas State University Jonesboro gym basketball',
    'Arkansas Tech University Russellville gym basketball',
    'Henderson State University Arkadelphia gym basketball',
    'Ouachita Baptist University Arkadelphia gym basketball',
    'Harding University Searcy gym basketball',
    'John Brown University Siloam Springs gym basketball',
    'Lyon College Batesville gym basketball',
    'Hendrix College Conway gym basketball',
    'Williams Baptist University Walnut Ridge gym basketball',
    'Southern Arkansas University Magnolia gym basketball',
    'Philander Smith University Little Rock gym basketball',
    'University of the Ozarks Clarksville gym basketball',
    // Community colleges
    'NorthWest Arkansas Community College gym basketball',
    'Pulaski Technical College gym basketball',
    'North Arkansas College Harrison gym basketball',
    'National Park College Hot Springs gym basketball',
    'Southeast Arkansas College Pine Bluff gym basketball',
    'South Arkansas Community College El Dorado gym basketball',
    'Arkansas Northeastern College Blytheville gym basketball',
    'Arkansas State University Mid-South West Memphis gym basketball',
    'University of Arkansas Community College Batesville gym basketball',
    'Ozarka College Melbourne gym basketball',
    'Cossatot Community College De Queen gym basketball',
    'Rich Mountain Community College Mena gym basketball',
    'East Arkansas Community College Forrest City gym basketball',
    'College of the Ouachitas Malvern gym basketball',
    'Black River Technical College Pocahontas gym basketball',

    // ══════════════════════════════════════════════
    // PRIVATE GYMS & FITNESS CHAINS
    // ══════════════════════════════════════════════
    '24 Hour Fitness Little Rock AR',
    'Planet Fitness Little Rock AR',
    'LA Fitness Little Rock AR',
    'Orangetheory Fitness Little Rock AR',
    'Gold\'s Gym Little Rock AR',
    'YMCA Little Rock Arkansas',
    'YMCA Conway Arkansas',
    'YMCA Hot Springs Arkansas',
    'YMCA Fort Smith Arkansas',
    'YMCA Northwest Arkansas',
    'Baptist Health fitness center basketball Arkansas',
    'Boys and Girls Club Arkansas',
    'Arkansas basketball training facility',
    'indoor basketball facility Arkansas',
];

const SKIP_PATTERNS = [
    /gymnastics/i, /gym ?world/i, /parkour/i,
    /yoga/i, /pilates/i, /boxing/i, /martial/i, /karate/i, /jiu.?jitsu/i, /taekwondo/i, /kung fu/i,
    /swim/i, /aquatic/i, /pool/i, /dance/i, /ballet/i, /spin/i,
    /climbing/i, /boulder/i, /trampoline/i, /cheer/i,
    /golf/i, /tennis only/i, /racquet/i, /pickleball/i, /badminton/i,
    /volleyball(?! .*basketball)/i,
    /supply/i, /store/i, /shop/i, /equipment/i,
    /camp(?:s|ing)?\b/i, /athletic department/i,
    /physical therapy/i, /rehab/i, /chiropract/i,
    /preschool(?! gym)/i, /daycare/i, /child care/i, /childcare/i,
    /dog\s/i, /pet\s/i, /veterinar/i,
    /salon/i, /beauty/i, /nail/i, /barber/i,
    /nursing/i, /dental/i, /medical/i, /pharmacy/i,
    /skating rink/i, /ice rink/i, /hockey rink/i,
    /crossfit(?! .*basketball)/i,
    /rowing/i, /crew house/i, /boathouse/i,
];

const KEEP_PATTERNS = [
    /school/i, /elementary/i, /middle school/i, /high school/i,
    /gymnasium/i, /gym\b/i, /recreation/i, /community center/i,
    /ymca/i, /ywca/i, /jcc/i, /boys.*girls.*club/i,
    /basketball/i, /fitness/i, /athletic/i, /sports/i,
    /university/i, /college/i, /academy/i,
    /24 hour/i, /life time/i, /la fitness/i, /planet fitness/i,
    /gold'?s? gym/i,
];

function shouldInclude(name, types) {
    for (const pat of SKIP_PATTERNS) { if (pat.test(name)) return false; }
    for (const pat of KEEP_PATTERNS) { if (pat.test(name)) return true; }
    const basketballTypes = ['gym', 'school', 'university', 'community_center', 'sports_complex'];
    if (types.some(t => basketballTypes.some(bt => t.includes(bt)))) return true;
    return false;
}

async function discoverPlaces(query) {
    const body = { textQuery: query, maxResultCount: 20 };
    const result = await httpPost('places.googleapis.com', '/v1/places:searchText', body, {
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types',
    });
    return result.places || [];
}

function extractCity(address) {
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 3) {
        const cityPart = parts[parts.length - 3] || parts[0];
        const statePart = parts[parts.length - 2];
        const stateMatch = statePart.match(/^([A-Z]{2})/);
        if (stateMatch) return `${cityPart}, ${stateMatch[1]}`;
    }
    const match = address.match(/,\s*([^,]+),\s*([A-Z]{2})\s+\d/);
    if (match) return `${match[1].trim()}, ${match[2]}`;
    return null;
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║  ARKANSAS STATEWIDE COURT DISCOVERY PIPELINE         ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    const existingCourts = await httpGet(`https://${BASE}/courts`);
    const existingAR = existingCourts.filter(c => c.city?.endsWith(', AR'));
    console.log(`  Existing AR courts: ${existingAR.length}\n`);

    console.log('═══ PHASE 1: DISCOVERING COURTS ═══\n');
    const discovered = new Map();
    let queriesRun = 0, totalResults = 0, filtered = 0, dupeExisting = 0;

    for (const query of QUERIES) {
        try {
            const places = await discoverPlaces(query);
            queriesRun++;
            for (const place of places) {
                const name = place.displayName?.text || '?';
                const addr = place.formattedAddress || '?';
                const lat = place.location?.latitude;
                const lng = place.location?.longitude;
                const types = place.types || [];
                if (!lat || !lng) continue;
                totalResults++;
                if (!shouldInclude(name, types)) { filtered++; continue; }
                let isDupe = false;
                for (const [key, existing] of discovered) {
                    if (haversineKm(lat, lng, existing.lat, existing.lng) < 0.1) { isDupe = true; break; }
                }
                if (!isDupe) {
                    for (const ec of existingAR) {
                        if (ec.lat && ec.lng && haversineKm(lat, lng, ec.lat, ec.lng) < 0.1) { isDupe = true; dupeExisting++; break; }
                    }
                }
                if (!isDupe) {
                    const city = extractCity(addr);
                    if (city && city.endsWith(', AR')) {
                        discovered.set(`${lat.toFixed(4)},${lng.toFixed(4)}`, { name, lat, lng, city, address: addr, types });
                    }
                }
            }
            if (queriesRun % 10 === 0) console.log(`  Queries: ${queriesRun}/${QUERIES.length} | New: ${discovered.size} | Filtered: ${filtered} | Dupe-existing: ${dupeExisting}`);
            await sleep(200);
        } catch (err) { console.log(`  ⚠️ Query failed: "${query}" — ${err.message}`); }
    }

    console.log(`\n  Queries: ${queriesRun} | Results: ${totalResults} | Filtered: ${filtered}`);
    console.log(`  Duped against existing DB: ${dupeExisting}`);
    console.log(`  Unique NEW venues: ${discovered.size}\n`);

    console.log('═══ PHASE 2: IMPORTING ═══\n');
    let imported = 0, importFail = 0;
    const venues = Array.from(discovered.values()).sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));

    for (const v of venues) {
        try {
            const id = generateUUID(v.name + v.city);
            const isSchool = v.types.includes('school') || v.types.includes('secondary_school') || v.types.includes('primary_school');
            const courtName = v.name.endsWith(' Gym') || v.name.endsWith(' Gymnasium') ? v.name : v.name + (isSchool ? ' Gym' : '');
            const isMembersOnly = v.types.includes('gym') || /24 hour/i.test(v.name) || /life time/i.test(v.name) || /la fitness/i.test(v.name) || /planet fitness/i.test(v.name) || /gold'?s? gym/i.test(v.name) || /athletic club/i.test(v.name) || /ymca/i.test(v.name) || /jcc/i.test(v.name);
            const params = new URLSearchParams({ id, name: courtName, city: v.city, lat: String(v.lat), lng: String(v.lng), indoor: 'true', rims: '2', access: isMembersOnly ? 'members' : 'public', address: v.address });
            await httpPostRailway(`/courts/admin/create?${params.toString()}`);
            console.log(`  ✅ ${courtName} (${v.city})`);
            imported++;
        } catch (err) {
            console.log(`  ❌ ${v.name}: ${err.message}`);
            importFail++;
        }
        if (imported % 20 === 0) await sleep(100);
    }
    console.log(`\n  Imported: ${imported} | Failed: ${importFail}\n`);

    console.log('═══ PHASE 3: CLASSIFYING ═══\n');
    await sleep(1000);
    for (const pat of ['%Elementary%', '%Middle School%', '%High School%', '%Prep School%', '%School Gym%', '%School Gymnasium%', '%Junior High%', '%Academy%', '%Montessori%']) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=school&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }
    for (const pat of ['%College%', '%University%']) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=college&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }
    for (const pat of ['%YMCA%', '%YWCA%', '%JCC%', '%Community Center%', '%Recreation%', '%Rec Center%', '%Boys%Girls%Club%', '%Parks%']) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=rec_center&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }
    for (const pat of ['%24 Hour%', '%Life Time%', '%LA Fitness%', '%Planet Fitness%', '%Fitness%', '%Athletic Club%', '%Gold%Gym%', '%Health Club%', '%Training%', '%Sport%']) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=gym&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }
    console.log('  Classification applied\n');

    console.log('═══ PHASE 4: VERIFICATION ═══\n');
    await sleep(2000);
    const finalCourts = await httpGet(`https://${BASE}/courts`);
    const arIndoor = finalCourts.filter(c => c.city?.endsWith(', AR') && c.indoor);
    const byCityMap = {};
    for (const c of arIndoor) { if (!byCityMap[c.city]) byCityMap[c.city] = []; byCityMap[c.city].push(c); }
    console.log(`  AR Indoor: ${arIndoor.length} courts`);
    console.log(`  Cities: ${Object.keys(byCityMap).length}\n`);
    console.log('  By city (top 30):');
    for (const [city, cts] of Object.entries(byCityMap).sort((a, b) => b[1].length - a[1].length).slice(0, 30)) {
        console.log(`    ${city}: ${cts.length}`);
    }
    const vtDist = {};
    for (const c of arIndoor) { vtDist[c.venue_type || '?'] = (vtDist[c.venue_type || '?'] || 0) + 1; }
    console.log('\n  Venue types:');
    for (const [type, count] of Object.entries(vtDist).sort((a, b) => b[1] - a[1])) { console.log(`    ${type}: ${count}`); }
    console.log(`\n  Total DB: ${finalCourts.length} | API calls: ${queriesRun}\n`);
    console.log('══════════════════════════════════════════════════');
    console.log('ARKANSAS DISCOVERY COMPLETE');
    console.log('══════════════════════════════════════════════════\n');
}
main().catch(console.error);

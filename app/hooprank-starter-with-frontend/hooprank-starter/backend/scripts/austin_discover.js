/**
 * Austin Metro Court Discovery Pipeline
 * 
 * Uses Google Places API (New) searchText to discover ALL indoor basketball
 * courts in the Austin-San Antonio corridor and Central Texas.
 * 
 * Metro area covers: Austin, Round Rock, Cedar Park, Georgetown, Pflugerville,
 * Leander, Kyle, Buda, San Marcos, New Braunfels, Hutto, Taylor, Dripping Springs,
 * Bastrop, Elgin, Lakeway, Bee Cave, Manor, plus San Antonio metro
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
    // AUSTIN — comprehensive
    'school gymnasium Austin TX',
    'elementary school gym basketball Austin TX',
    'middle school gymnasium Austin TX',
    'high school gymnasium Austin TX',
    'basketball gym Austin TX',
    'recreation center basketball Austin TX',
    'community center gym Austin TX',
    'YMCA basketball Austin TX',
    'Boys and Girls Club Austin TX',
    'Parks and Recreation gym Austin TX',

    // AUSTIN neighborhoods
    'school gym North Austin TX',
    'school gym South Austin TX',
    'school gym East Austin TX',
    'school gym West Austin TX',
    'school gym Downtown Austin TX',
    'school gym Mueller Austin TX',
    'school gym Circle C Austin TX',
    'school gym Barton Hills Austin TX',
    'school gym Oak Hill Austin TX',
    'school gym Windsor Park Austin TX',
    'school gym Crestview Austin TX',
    'school gym Hyde Park Austin TX',
    'community center basketball Austin Texas',

    // ROUND ROCK / CEDAR PARK / LEANDER
    'school gymnasium Round Rock TX',
    'basketball gym Round Rock TX',
    'recreation center basketball Round Rock TX',
    'school gymnasium Cedar Park TX',
    'basketball gym Cedar Park TX',
    'school gymnasium Leander TX',
    'school gymnasium Georgetown TX',
    'basketball gym Georgetown TX',
    'school gymnasium Pflugerville TX',
    'school gymnasium Hutto TX',
    'school gymnasium Taylor TX',
    'community center gym Williamson County TX',

    // SOUTH — KYLE / BUDA / SAN MARCOS / NEW BRAUNFELS
    'school gymnasium Kyle TX',
    'school gymnasium Buda TX',
    'school gymnasium San Marcos TX',
    'basketball gym San Marcos TX',
    'school gymnasium New Braunfels TX',
    'basketball gym New Braunfels TX',
    'school gymnasium Dripping Springs TX',
    'school gymnasium Wimberley TX',
    'recreation center basketball Hays County TX',

    // EAST — BASTROP / ELGIN / MANOR
    'school gymnasium Bastrop TX',
    'school gymnasium Elgin TX',
    'school gymnasium Manor TX',
    'school gymnasium Del Valle TX',

    // WEST — LAKEWAY / BEE CAVE / LAKE TRAVIS
    'school gymnasium Lakeway TX',
    'school gymnasium Bee Cave TX',
    'school gymnasium Lake Travis TX',
    'basketball gym Westlake Austin TX',

    // SAN ANTONIO — comprehensive
    'school gymnasium San Antonio TX',
    'elementary school gym basketball San Antonio TX',
    'middle school gymnasium San Antonio TX',
    'high school gymnasium San Antonio TX',
    'basketball gym San Antonio TX',
    'recreation center basketball San Antonio TX',
    'community center gym San Antonio TX',
    'YMCA basketball San Antonio TX',
    'Boys and Girls Club San Antonio TX',

    // SAN ANTONIO neighborhoods
    'school gym North San Antonio TX',
    'school gym South San Antonio TX',
    'school gym East San Antonio TX',
    'school gym West San Antonio TX',
    'school gym Alamo Heights San Antonio TX',
    'school gym Stone Oak San Antonio TX',
    'school gym Medical Center San Antonio TX',
    'recreation center basketball Bexar County TX',

    // SAN ANTONIO suburbs
    'school gymnasium Helotes TX',
    'school gymnasium Boerne TX',
    'school gymnasium Schertz TX',
    'school gymnasium Cibolo TX',
    'school gymnasium Converse TX',
    'school gymnasium Live Oak TX',
    'school gymnasium Universal City TX',
    'school gymnasium Seguin TX',

    // COLLEGES
    'University of Texas Austin gym basketball',
    'Texas State University gym basketball',
    'St. Edwards University gym basketball',
    'Huston-Tillotson University gym basketball',
    'Southwestern University Georgetown gym basketball',
    'UTSA gym basketball',
    'Trinity University San Antonio gym basketball',
    'University of the Incarnate Word gym basketball',
    'Texas A&M San Antonio gym basketball',
    'Austin Community College gym basketball',
    'San Antonio College gym basketball',

    // PRIVATE GYMS
    '24 Hour Fitness Austin TX',
    '24 Hour Fitness San Antonio TX',
    'LA Fitness Austin TX',
    'LA Fitness San Antonio TX',
    'Life Time Austin TX',
    'Life Time San Antonio TX',
    'Gold\'s Gym Austin TX',
    'Planet Fitness Austin TX',
    'Golds Gym San Antonio TX',
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
    console.log('║  AUSTIN / SAN ANTONIO COURT DISCOVERY PIPELINE       ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    const existingCourts = await httpGet(`https://${BASE}/courts`);
    const existingTX = existingCourts.filter(c => c.city?.endsWith(', TX'));
    console.log(`  Existing TX courts: ${existingTX.length}\n`);

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
                    for (const ec of existingTX) {
                        if (ec.lat && ec.lng && haversineKm(lat, lng, ec.lat, ec.lng) < 0.1) { isDupe = true; dupeExisting++; break; }
                    }
                }
                if (!isDupe) {
                    const city = extractCity(addr);
                    if (city && city.endsWith(', TX')) {
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
            imported++;
        } catch (err) { importFail++; }
        if (imported % 20 === 0) await sleep(100);
    }
    console.log(`  Imported: ${imported} | Failed: ${importFail}\n`);

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
    const txIndoor = finalCourts.filter(c => c.city?.endsWith(', TX') && c.indoor);
    const byCityMap = {};
    for (const c of txIndoor) { if (!byCityMap[c.city]) byCityMap[c.city] = []; byCityMap[c.city].push(c); }
    console.log(`  TX Indoor: ${txIndoor.length} courts`);
    console.log(`  Cities: ${Object.keys(byCityMap).length}\n`);
    console.log('  By city (top 20):');
    for (const [city, cts] of Object.entries(byCityMap).sort((a, b) => b[1].length - a[1].length).slice(0, 20)) {
        console.log(`    ${city}: ${cts.length}`);
    }
    const vtDist = {};
    for (const c of txIndoor) { vtDist[c.venue_type || '?'] = (vtDist[c.venue_type || '?'] || 0) + 1; }
    console.log('\n  Venue types:');
    for (const [type, count] of Object.entries(vtDist).sort((a, b) => b[1] - a[1])) { console.log(`    ${type}: ${count}`); }
    console.log(`\n  Total DB: ${finalCourts.length} | API calls: ${queriesRun}\n`);
    console.log('══════════════════════════════════════════════════');
    console.log('AUSTIN / SAN ANTONIO DISCOVERY COMPLETE');
    console.log('══════════════════════════════════════════════════\n');
}
main().catch(console.error);

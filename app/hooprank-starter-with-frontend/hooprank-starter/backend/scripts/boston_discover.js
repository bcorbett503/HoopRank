/**
 * Boston Metro Court Discovery Pipeline
 * 
 * Uses Google Places API (New) searchText to discover ALL indoor basketball
 * courts in the Greater Boston area and Eastern Massachusetts.
 * 
 * Metro area covers: Boston, Cambridge, Somerville, Brookline, Newton,
 * Quincy, Braintree, Weymouth, Framingham, Worcester, Lowell, Lawrence,
 * Brockton, New Bedford, Fall River, Springfield, plus southern NH
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
    // BOSTON — comprehensive
    'school gymnasium Boston MA',
    'elementary school gym basketball Boston MA',
    'middle school gymnasium Boston MA',
    'high school gymnasium Boston MA',
    'basketball gym Boston MA',
    'recreation center basketball Boston MA',
    'community center gym Boston MA',
    'YMCA basketball Boston MA',
    'Boys and Girls Club Boston MA',
    'Parks and Recreation gym Boston MA',

    // BOSTON neighborhoods
    'school gym Dorchester Boston MA',
    'school gym Roxbury Boston MA',
    'school gym Mattapan Boston MA',
    'school gym Jamaica Plain Boston MA',
    'school gym Hyde Park Boston MA',
    'school gym Roslindale Boston MA',
    'school gym South Boston MA',
    'school gym East Boston MA',
    'school gym Brighton Allston Boston MA',
    'school gym Charlestown Boston MA',
    'school gym West Roxbury Boston MA',
    'school gym Back Bay Fenway Boston MA',
    'community center basketball Boston Massachusetts',

    // CAMBRIDGE / SOMERVILLE
    'school gymnasium Cambridge MA',
    'basketball gym Cambridge MA',
    'recreation center basketball Cambridge MA',
    'school gymnasium Somerville MA',
    'basketball gym Somerville MA',

    // INNER SUBURBS — BROOKLINE / NEWTON / WATERTOWN
    'school gymnasium Brookline MA',
    'school gymnasium Newton MA',
    'basketball gym Newton MA',
    'school gymnasium Watertown MA',
    'school gymnasium Waltham MA',
    'school gymnasium Arlington MA',
    'school gymnasium Belmont MA',
    'school gymnasium Medford MA',
    'school gymnasium Malden MA',
    'school gymnasium Everett MA',
    'school gymnasium Chelsea MA',
    'school gymnasium Revere MA',

    // NORTH SHORE
    'school gymnasium Salem MA',
    'school gymnasium Lynn MA',
    'school gymnasium Peabody MA',
    'school gymnasium Beverly MA',
    'school gymnasium Gloucester MA',
    'school gymnasium Marblehead MA',
    'school gymnasium Saugus MA',
    'school gymnasium Danvers MA',
    'recreation center basketball North Shore MA',

    // SOUTH SHORE
    'school gymnasium Quincy MA',
    'basketball gym Quincy MA',
    'school gymnasium Braintree MA',
    'school gymnasium Weymouth MA',
    'school gymnasium Milton MA',
    'school gymnasium Hingham MA',
    'school gymnasium Norwood MA',
    'school gymnasium Dedham MA',
    'school gymnasium Needham MA',
    'school gymnasium Wellesley MA',
    'recreation center basketball South Shore MA',

    // METROWEST / 495 CORRIDOR
    'school gymnasium Framingham MA',
    'basketball gym Framingham MA',
    'school gymnasium Natick MA',
    'school gymnasium Marlborough MA',
    'school gymnasium Worcester MA',
    'basketball gym Worcester MA',
    'school gymnasium Shrewsbury MA',
    'school gymnasium Leominster MA',
    'school gymnasium Fitchburg MA',
    'recreation center basketball MetroWest MA',

    // NORTH — LOWELL / LAWRENCE / MERRIMACK VALLEY
    'school gymnasium Lowell MA',
    'basketball gym Lowell MA',
    'school gymnasium Lawrence MA',
    'school gymnasium Haverhill MA',
    'school gymnasium Methuen MA',
    'school gymnasium Andover MA',
    'school gymnasium North Andover MA',
    'school gymnasium Chelmsford MA',
    'school gymnasium Billerica MA',
    'school gymnasium Tewksbury MA',
    'recreation center basketball Merrimack Valley MA',

    // SOUTH — BROCKTON / PLYMOUTH / CAPE
    'school gymnasium Brockton MA',
    'basketball gym Brockton MA',
    'school gymnasium Plymouth MA',
    'school gymnasium Taunton MA',
    'school gymnasium Attleboro MA',
    'school gymnasium New Bedford MA',
    'school gymnasium Fall River MA',
    'recreation center basketball Plymouth County MA',

    // SPRINGFIELD / WESTERN MA
    'school gymnasium Springfield MA',
    'basketball gym Springfield MA',
    'school gymnasium Holyoke MA',
    'school gymnasium Chicopee MA',
    'school gymnasium Westfield MA',
    'school gymnasium Pittsfield MA',
    'school gymnasium Northampton MA',
    'school gymnasium Amherst MA',
    'recreation center basketball Western Massachusetts',

    // SOUTHERN NH (part of Greater Boston commuter area)
    'school gymnasium Nashua NH',
    'school gymnasium Manchester NH',
    'basketball gym Manchester NH',
    'school gymnasium Concord NH',
    'school gymnasium Salem NH',
    'school gymnasium Derry NH',
    'school gymnasium Londonderry NH',
    'school gymnasium Portsmouth NH',
    'recreation center basketball southern New Hampshire',

    // RHODE ISLAND
    'school gymnasium Providence RI',
    'basketball gym Providence RI',
    'school gymnasium Warwick RI',
    'school gymnasium Cranston RI',
    'school gymnasium Pawtucket RI',
    'recreation center basketball Rhode Island',

    // COLLEGES
    'Boston College gym basketball',
    'Boston University gym basketball',
    'Northeastern University gym basketball',
    'Harvard University gym basketball',
    'MIT gym basketball',
    'Tufts University gym basketball',
    'UMass Boston gym basketball',
    'UMass Amherst gym basketball',
    'UMass Lowell gym basketball',
    'Worcester Polytechnic Institute gym basketball',
    'Holy Cross College gym basketball',
    'Providence College gym basketball',
    'Brown University gym basketball',
    'University of New Hampshire gym basketball',
    'University of Rhode Island gym basketball',
    'Suffolk University gym basketball',
    'Emerson College gym basketball',
    'Bentley University gym basketball',
    'Brandeis University gym basketball',

    // PRIVATE GYMS
    '24 Hour Fitness Boston MA',
    'Boston Sports Club basketball',
    'Equinox Boston MA',
    'Life Time Burlington MA',
    'Planet Fitness Boston MA',
    'YMCA Greater Boston MA',
    'BSC basketball Boston MA',
    'Gold\'s Gym Boston area MA',
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
    /boston sports club/i, /bsc/i, /equinox/i, /gold'?s? gym/i,
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
    console.log('║  BOSTON / NEW ENGLAND COURT DISCOVERY PIPELINE        ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    const existingCourts = await httpGet(`https://${BASE}/courts`);
    const existingNE = existingCourts.filter(c => {
        const st = c.city?.match(/, ([A-Z]{2})$/)?.[1];
        return ['MA', 'NH', 'RI', 'CT', 'ME', 'VT'].includes(st);
    });
    console.log(`  Existing NE courts: ${existingNE.length}\n`);

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
                    for (const ec of existingNE) {
                        if (ec.lat && ec.lng && haversineKm(lat, lng, ec.lat, ec.lng) < 0.1) { isDupe = true; dupeExisting++; break; }
                    }
                }
                if (!isDupe) {
                    const city = extractCity(addr);
                    if (city && /,\s*(MA|NH|RI|CT)$/.test(city)) {
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
            const isMembersOnly = v.types.includes('gym') || /24 hour/i.test(v.name) || /life time/i.test(v.name) || /la fitness/i.test(v.name) || /planet fitness/i.test(v.name) || /equinox/i.test(v.name) || /boston sports club/i.test(v.name) || /bsc/i.test(v.name) || /ymca/i.test(v.name) || /jcc/i.test(v.name) || /gold'?s? gym/i.test(v.name);
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
    for (const pat of ['%College%', '%University%', '%Institute%']) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=college&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }
    for (const pat of ['%YMCA%', '%YWCA%', '%JCC%', '%Community Center%', '%Recreation%', '%Rec Center%', '%Boys%Girls%Club%', '%Parks%']) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=rec_center&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }
    for (const pat of ['%24 Hour%', '%Life Time%', '%LA Fitness%', '%Planet Fitness%', '%Fitness%', '%Athletic Club%', '%Gold%Gym%', '%Health Club%', '%Training%', '%Sport%', '%BSC%', '%Boston Sports%', '%Equinox%']) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=gym&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }
    console.log('  Classification applied\n');

    console.log('═══ PHASE 4: VERIFICATION ═══\n');
    await sleep(2000);
    const finalCourts = await httpGet(`https://${BASE}/courts`);

    // NE states
    const neStates = ['MA', 'NH', 'RI', 'CT'];
    const neIndoor = finalCourts.filter(c => {
        const st = c.city?.match(/, ([A-Z]{2})$/)?.[1];
        return neStates.includes(st) && c.indoor;
    });

    const byCityMap = {};
    for (const c of neIndoor) { if (!byCityMap[c.city]) byCityMap[c.city] = []; byCityMap[c.city].push(c); }
    console.log(`  New England Indoor: ${neIndoor.length} courts`);
    console.log(`  Cities: ${Object.keys(byCityMap).length}\n`);
    console.log('  By city (top 20):');
    for (const [city, cts] of Object.entries(byCityMap).sort((a, b) => b[1].length - a[1].length).slice(0, 20)) {
        console.log(`    ${city}: ${cts.length}`);
    }
    const vtDist = {};
    for (const c of neIndoor) { vtDist[c.venue_type || '?'] = (vtDist[c.venue_type || '?'] || 0) + 1; }
    console.log('\n  Venue types:');
    for (const [type, count] of Object.entries(vtDist).sort((a, b) => b[1] - a[1])) { console.log(`    ${type}: ${count}`); }

    // Per-state breakdown
    const byState = {};
    for (const c of neIndoor) { const st = c.city?.match(/, ([A-Z]{2})$/)?.[1]; byState[st] = (byState[st] || 0) + 1; }
    console.log('\n  By state:');
    for (const [st, cnt] of Object.entries(byState).sort((a, b) => b[1] - a[1])) { console.log(`    ${st}: ${cnt}`); }

    console.log(`\n  Total DB: ${finalCourts.length} | API calls: ${queriesRun}\n`);
    console.log('══════════════════════════════════════════════════');
    console.log('BOSTON / NEW ENGLAND DISCOVERY COMPLETE');
    console.log('══════════════════════════════════════════════════\n');
}
main().catch(console.error);

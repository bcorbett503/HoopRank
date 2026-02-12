/**
 * Seattle Metro Court Discovery Pipeline
 * 
 * Uses Google Places API (New) searchText to discover ALL indoor basketball
 * courts in the Seattle-Tacoma metro area.
 * 
 * Metro area covers: Seattle, Bellevue, Redmond, Kirkland, Renton, Kent,
 * Federal Way, Auburn, Tacoma, Puyallup, Lakewood, Olympia area,
 * Everett, Edmonds, Lynnwood, Marysville, Issaquah, Sammamish,
 * Burien, SeaTac, Tukwila, Shoreline, Bothell, Woodinville, etc.
 */
const https = require('https');
const crypto = require('crypto');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) { console.error('ERROR: GOOGLE_API_KEY env var required'); process.exit(1); }
const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpPost(hostname, path, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname, path, method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            timeout: 15000,
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve({ raw: data }); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { timeout: 30000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('JSON parse error')); }
            });
        }).on('error', reject);
    });
}

function httpPostRailway(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE, path, method: 'POST',
            headers: { 'x-user-id': USER_ID }, timeout: 10000,
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

function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── SEARCH QUERIES ─────────────────────────────────────────────
const QUERIES = [
    // SEATTLE — comprehensive
    'school gymnasium Seattle WA',
    'elementary school gym basketball Seattle WA',
    'middle school gymnasium Seattle WA',
    'high school gymnasium Seattle WA',
    'basketball gym Seattle WA',
    'recreation center basketball Seattle WA',
    'community center gym Seattle WA',
    'YMCA basketball Seattle WA',
    'fitness gym basketball court Seattle WA',
    'Boys and Girls Club Seattle WA',
    'Parks and Recreation gym Seattle WA',

    // SEATTLE neighborhoods
    'school gym Capitol Hill Seattle WA',
    'school gym Ballard Seattle WA',
    'school gym West Seattle WA',
    'school gym Rainier Valley Seattle WA',
    'school gym Central District Seattle WA',
    'school gym University District Seattle WA',
    'school gym Beacon Hill Seattle WA',
    'school gym Greenwood Seattle WA',
    'school gym South Seattle WA',
    'school gym North Seattle WA',
    'school gym Northeast Seattle WA',
    'community center basketball Seattle Washington',

    // BELLEVUE / EAST SIDE
    'school gymnasium Bellevue WA',
    'basketball gym Bellevue WA',
    'recreation center basketball Bellevue WA',
    'school gymnasium Redmond WA',
    'basketball gym Redmond WA',
    'school gymnasium Kirkland WA',
    'school gymnasium Issaquah WA',
    'school gymnasium Sammamish WA',
    'school gymnasium Woodinville WA',
    'school gymnasium Bothell WA',
    'school gymnasium Mercer Island WA',
    'basketball gym Eastside King County WA',
    'community center gym Bellevue Redmond WA',

    // SOUTH KING COUNTY
    'school gymnasium Renton WA',
    'basketball gym Renton WA',
    'school gymnasium Kent WA',
    'basketball gym Kent WA',
    'school gymnasium Federal Way WA',
    'school gymnasium Auburn WA',
    'basketball gym Auburn WA',
    'school gymnasium Tukwila WA',
    'school gymnasium SeaTac WA',
    'school gymnasium Burien WA',
    'school gymnasium Des Moines WA',
    'school gymnasium Covington WA',
    'school gymnasium Maple Valley WA',
    'recreation center basketball South King County WA',

    // NORTH — SHORELINE / EDMONDS / LYNNWOOD / EVERETT
    'school gymnasium Shoreline WA',
    'school gymnasium Edmonds WA',
    'school gymnasium Lynnwood WA',
    'basketball gym Lynnwood WA',
    'school gymnasium Mountlake Terrace WA',
    'school gymnasium Everett WA',
    'basketball gym Everett WA',
    'school gymnasium Marysville WA',
    'school gymnasium Mukilteo WA',
    'school gymnasium Lake Stevens WA',
    'school gymnasium Snohomish WA',
    'school gymnasium Arlington WA',
    'recreation center basketball Snohomish County WA',
    'community center gym Everett Edmonds WA',

    // TACOMA / PIERCE COUNTY
    'school gymnasium Tacoma WA',
    'basketball gym Tacoma WA',
    'recreation center basketball Tacoma WA',
    'YMCA basketball Tacoma WA',
    'school gymnasium Puyallup WA',
    'school gymnasium Lakewood WA',
    'school gymnasium University Place WA',
    'school gymnasium Spanaway WA',
    'school gymnasium Gig Harbor WA',
    'school gymnasium Bonney Lake WA',
    'school gymnasium Graham WA',
    'school gymnasium Sumner WA',
    'school gymnasium Steilacoom WA',
    'Boys and Girls Club Tacoma Pierce County WA',

    // OLYMPIA / THURSTON COUNTY
    'school gymnasium Olympia WA',
    'basketball gym Olympia WA',
    'school gymnasium Lacey WA',
    'school gymnasium Tumwater WA',
    'recreation center basketball Thurston County WA',

    // KITSAP PENINSULA
    'school gymnasium Bremerton WA',
    'school gymnasium Silverdale WA',
    'school gymnasium Poulsbo WA',
    'basketball gym Kitsap County WA',

    // COLLEGES & UNIVERSITIES
    'University of Washington gym basketball',
    'Seattle University gym basketball',
    'Seattle Pacific University gym',
    'Gonzaga University gym basketball',
    'Washington State University Pullman gym',
    'University of Puget Sound gym basketball',
    'Pacific Lutheran University gym',
    'Tacoma Community College gym',
    'Bellevue College gym basketball',
    'Highline College gym basketball',
    'Green River College gym basketball',
    'Everett Community College gym basketball',
    'Shoreline Community College gym',
    'Central Washington University gym',
    'Western Washington University gym basketball',
    'Whitworth University gym basketball',

    // PRIVATE GYMS / FITNESS
    '24 Hour Fitness Seattle WA',
    '24 Hour Fitness Bellevue WA',
    '24 Hour Fitness Tacoma WA',
    'LA Fitness Seattle metro WA',
    'Life Time Bellevue WA',
    'Planet Fitness Seattle WA',
    'PRO Club Bellevue WA',
    'Seattle Athletic Club basketball',
    'Washington Athletic Club basketball',
];

// ─── FILTER PATTERNS (enhanced with sport-specific negatives) ───
const SKIP_PATTERNS = [
    /gymnastics/i, /gym ?world/i, /parkour/i,
    /yoga/i, /pilates/i, /boxing/i, /martial/i, /karate/i, /jiu.?jitsu/i, /taekwondo/i, /kung fu/i,
    /swim/i, /aquatic/i, /pool/i, /dance/i, /ballet/i, /spin/i,
    /climbing/i, /boulder/i, /trampoline/i, /cheer/i,
    /golf/i, /tennis only/i, /racquet/i, /pickleball/i, /badminton/i,
    /volleyball(?! .*basketball)/i,  // volleyball-only (not multi-sport)
    /supply/i, /store/i, /shop/i, /equipment/i,
    /camp(?:s|ing)?\b/i, /athletic department/i,
    /physical therapy/i, /rehab/i, /chiropract/i,
    /preschool(?! gym)/i, /daycare/i, /child care/i, /childcare/i,
    /dog\s/i, /pet\s/i, /veterinar/i,
    /salon/i, /beauty/i, /nail/i, /barber/i,
    /nursing/i, /dental/i, /medical/i, /pharmacy/i,
    /church(?! gym| school)/i, /mosque/i, /temple(?! gym)/i,
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
    /pro club/i, /seattle athletic/i, /washington athletic/i,
];

function shouldInclude(name, types) {
    for (const pat of SKIP_PATTERNS) {
        if (pat.test(name)) return false;
    }
    for (const pat of KEEP_PATTERNS) {
        if (pat.test(name)) return true;
    }
    const basketballTypes = ['gym', 'school', 'university', 'community_center', 'sports_complex'];
    if (types.some(t => basketballTypes.some(bt => t.includes(bt)))) return true;
    return false;
}

async function discoverPlaces(query) {
    const body = { textQuery: query, maxResultCount: 20 };
    const result = await httpPost(
        'places.googleapis.com',
        '/v1/places:searchText',
        body,
        {
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types',
        }
    );
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
    console.log('║  SEATTLE METRO COURT DISCOVERY PIPELINE              ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // Load existing courts for deduplication
    const existingCourts = await httpGet(`https://${BASE}/courts`);
    const existingWA = existingCourts.filter(c => c.city?.endsWith(', WA'));
    console.log(`  Existing WA courts: ${existingWA.length}\n`);

    // ─── PHASE 1: Discover via Google Places API ─────────────────
    console.log('═══ PHASE 1: DISCOVERING COURTS VIA GOOGLE PLACES API ═══\n');

    const discovered = new Map();
    let queriesRun = 0;
    let totalResults = 0;
    let filtered = 0;

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

                if (!shouldInclude(name, types)) {
                    filtered++;
                    continue;
                }

                // Deduplicate by proximity (within 100m) against discovered
                let isDupe = false;
                for (const [key, existing] of discovered) {
                    if (haversineKm(lat, lng, existing.lat, existing.lng) < 0.1) {
                        isDupe = true;
                        break;
                    }
                }
                // Also dedup against existing DB courts
                if (!isDupe) {
                    for (const ec of existingWA) {
                        if (ec.lat && ec.lng && haversineKm(lat, lng, ec.lat, ec.lng) < 0.1) {
                            isDupe = true;
                            break;
                        }
                    }
                }

                if (!isDupe) {
                    const city = extractCity(addr);
                    if (city && city.endsWith(', WA')) {
                        discovered.set(`${lat.toFixed(4)},${lng.toFixed(4)}`, {
                            name, lat, lng, city, address: addr, types,
                        });
                    }
                }
            }

            if (queriesRun % 10 === 0) {
                console.log(`  Queries: ${queriesRun}/${QUERIES.length} | Discovered: ${discovered.size} | Filtered: ${filtered}`);
            }

            await sleep(200);
        } catch (err) {
            console.log(`  ⚠️ Query failed: "${query}" — ${err.message}`);
        }
    }

    console.log(`\n  Total queries: ${queriesRun}`);
    console.log(`  Total results: ${totalResults}`);
    console.log(`  Filtered out: ${filtered}`);
    console.log(`  Unique new venues: ${discovered.size}\n`);

    // ─── PHASE 2: Import discovered courts ───────────────────────
    console.log('═══ PHASE 2: IMPORTING DISCOVERED COURTS ═══\n');

    let imported = 0, importFail = 0;
    const venues = Array.from(discovered.values()).sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));

    for (const v of venues) {
        try {
            const id = generateUUID(v.name + v.city);
            const isSchool = v.types.includes('school') || v.types.includes('secondary_school') || v.types.includes('primary_school');
            const courtName = v.name.endsWith(' Gym') || v.name.endsWith(' Gymnasium')
                ? v.name
                : v.name + (isSchool ? ' Gym' : '');

            const isMembersOnly = v.types.includes('gym') ||
                /24 hour/i.test(v.name) || /life time/i.test(v.name) ||
                /la fitness/i.test(v.name) || /planet fitness/i.test(v.name) ||
                /pro club/i.test(v.name) || /athletic club/i.test(v.name) ||
                /ymca/i.test(v.name) || /jcc/i.test(v.name);

            const params = new URLSearchParams({
                id,
                name: courtName,
                city: v.city,
                lat: String(v.lat),
                lng: String(v.lng),
                indoor: 'true',
                rims: '2',
                access: isMembersOnly ? 'members' : 'public',
                address: v.address,
            });
            await httpPostRailway(`/courts/admin/create?${params.toString()}`);
            imported++;
        } catch (err) {
            importFail++;
        }
        if (imported % 20 === 0) await sleep(100);
    }

    console.log(`  Imported: ${imported} | Failed: ${importFail}\n`);

    // ─── PHASE 3: Classify venue types ───────────────────────────
    console.log('═══ PHASE 3: CLASSIFYING VENUE TYPES ═══\n');
    await sleep(1000);

    const schoolPats = ['%Elementary%', '%Middle School%', '%High School%', '%Prep School%', '%Preparatory%', '%School Gym%', '%School Gymnasium%', '%Junior High%', '%Academy%', '%Montessori%', '%Waldorf%'];
    for (const pat of schoolPats) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=school&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }
    const collegePats = ['%College%', '%University%'];
    for (const pat of collegePats) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=college&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }
    const recPats = ['%YMCA%', '%YWCA%', '%JCC%', '%Community Center%', '%Recreation%', '%Rec Center%', '%Boys%Girls%Club%', '%Parks%'];
    for (const pat of recPats) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=rec_center&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }
    const gymPats = ['%24 Hour%', '%Life Time%', '%LA Fitness%', '%Planet Fitness%', '%Fitness%', '%Athletic Club%', '%Health Club%', '%PRO Club%', '%Training%', '%CrossFit%', '%Sport%'];
    for (const pat of gymPats) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=gym&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }

    console.log('  Classification applied\n');

    // ─── PHASE 4: Verification ───────────────────────────────────
    console.log('═══ PHASE 4: VERIFICATION ═══\n');
    await sleep(2000);
    const finalCourts = await httpGet(`https://${BASE}/courts`);
    const waIndoor = finalCourts.filter(c => c.city?.endsWith(', WA') && c.indoor);

    const byCityMap = {};
    for (const c of waIndoor) {
        if (!byCityMap[c.city]) byCityMap[c.city] = [];
        byCityMap[c.city].push(c);
    }

    console.log(`  WA Indoor: ${waIndoor.length} courts`);
    console.log(`  Cities: ${Object.keys(byCityMap).length}\n`);

    console.log('  By city (top 20):');
    const sortedCities = Object.entries(byCityMap).sort((a, b) => b[1].length - a[1].length);
    for (const [city, cts] of sortedCities.slice(0, 20)) {
        console.log(`    ${city}: ${cts.length}`);
    }

    const vtDist = {};
    for (const c of waIndoor) { vtDist[c.venue_type || '?'] = (vtDist[c.venue_type || '?'] || 0) + 1; }
    console.log('\n  Venue types:');
    for (const [type, count] of Object.entries(vtDist).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${type}: ${count}`);
    }

    console.log(`\n  Total DB: ${finalCourts.length}`);
    console.log(`  API calls: ${queriesRun}\n`);
    console.log('══════════════════════════════════════════════════');
    console.log('SEATTLE METRO DISCOVERY COMPLETE');
    console.log('══════════════════════════════════════════════════\n');
}

main().catch(console.error);

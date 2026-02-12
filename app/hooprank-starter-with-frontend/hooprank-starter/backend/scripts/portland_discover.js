/**
 * Portland Metro Court Discovery Pipeline
 * 
 * Uses Google Places API (New) searchText to discover ALL indoor basketball
 * courts in the Portland-Vancouver metro area.
 * 
 * Metro area covers: Portland, Beaverton, Hillsboro, Gresham, Lake Oswego,
 * Tigard, Tualatin, West Linn, Oregon City, Milwaukie, Happy Valley,
 * Troutdale, Sherwood, Wilsonville, Forest Grove, Newberg, Canby, Sandy,
 * plus Vancouver/Camas/Washougal WA
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
        https.get(url, { timeout: 15000 }, (res) => {
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
    // PORTLAND - comprehensive
    'school gymnasium Portland OR',
    'elementary school gym basketball Portland OR',
    'middle school gymnasium Portland OR',
    'high school gymnasium Portland OR',
    'basketball gym Portland OR',
    'recreation center basketball Portland OR',
    'community center gym Portland OR',
    'YMCA basketball Portland OR',
    'fitness gym basketball court Portland OR',
    '24 Hour Fitness basketball Portland OR',
    'Boys and Girls Club Portland OR',
    'Parks and Recreation gym Portland OR',

    // PORTLAND neighborhoods - deep coverage
    'school gym Northeast Portland OR',
    'school gym Southeast Portland OR',
    'school gym North Portland OR',
    'school gym Southwest Portland OR',
    'school gym Northwest Portland OR',
    'basketball court inner Portland OR',
    'community center basketball Portland Oregon',

    // BEAVERTON / HILLSBORO / WEST SIDE
    'school gymnasium Beaverton OR',
    'basketball gym Beaverton OR',
    'recreation center basketball Beaverton OR',
    'school gymnasium Hillsboro OR',
    'basketball gym Hillsboro OR',
    'school gymnasium Aloha OR',
    'school gymnasium Tigard OR',
    'basketball gym Tigard Tualatin OR',
    'recreation center basketball Tigard Tualatin OR',
    'school gymnasium Forest Grove Cornelius OR',
    'school gymnasium Sherwood OR',

    // EAST SIDE - GRESHAM / TROUTDALE / HAPPY VALLEY
    'school gymnasium Gresham OR',
    'basketball gym Gresham OR',
    'school gymnasium Happy Valley Clackamas OR',
    'school gymnasium Troutdale Wood Village OR',
    'recreation center basketball Gresham OR',
    'school gymnasium Damascus OR',
    'basketball gym East Portland OR',

    // SOUTH - LAKE OSWEGO / WEST LINN / OREGON CITY
    'school gymnasium Lake Oswego OR',
    'basketball gym Lake Oswego OR',
    'school gymnasium West Linn OR',
    'school gymnasium Oregon City OR',
    'basketball gym Oregon City Milwaukie OR',
    'school gymnasium Milwaukie OR',
    'school gymnasium Gladstone OR',
    'recreation center basketball Clackamas County OR',
    'YMCA basketball Clackamas County OR',

    // OUTLYING COMMUNITIES
    'school gymnasium Wilsonville OR',
    'school gymnasium Canby OR',
    'school gymnasium Sandy OR',
    'school gymnasium Newberg OR',
    'school gymnasium Estacada Molalla OR',
    'basketball gym Newberg Dundee OR',
    'school gymnasium McMinnville OR',
    'school gymnasium Woodburn OR',

    // VANCOUVER WA (part of Portland metro)
    'school gymnasium Vancouver WA',
    'basketball gym Vancouver WA',
    'recreation center basketball Vancouver WA',
    'YMCA basketball Vancouver WA',
    'school gymnasium Camas Washougal WA',
    'school gymnasium Battle Ground WA',
    'school gymnasium Ridgefield WA',
    'basketball gym Clark County WA',

    // COLLEGES & UNIVERSITIES
    'Portland State University gym',
    'University of Portland gym basketball',
    'Lewis & Clark College gym',
    'Reed College gym basketball',
    'Pacific University Forest Grove gym',
    'George Fox University Newberg gym',
    'Concordia University Portland gym',
    'Portland Community College gym basketball',
    'Mt Hood Community College gym basketball',
    'Clackamas Community College gym basketball',
    'Clark College Vancouver WA gym',
    'Warner Pacific University gym',

    // PRIVATE GYMS / FITNESS
    '24 Hour Fitness Portland OR',
    'Life Time Portland OR',
    'LA Fitness Portland OR',
    'Planet Fitness Portland metro OR',
    'athletic club basketball Portland OR',
    'Multnomah Athletic Club basketball',
];

// ─── FILTER PATTERNS ─────────────────────────────────────────────
const SKIP_PATTERNS = [
    /gymnastics/i, /gym ?world/i, /parkour/i,
    /yoga/i, /pilates/i, /boxing/i, /martial/i, /karate/i, /jiu.?jitsu/i,
    /swim/i, /aquatic/i, /pool/i, /dance/i, /spin/i,
    /climbing/i, /boulder/i, /trampoline/i, /cheer/i,
    /golf/i, /tennis only/i, /racquet/i, /pickleball/i,
    /supply/i, /store/i, /shop/i, /equipment/i,
    /camp(?:s|ing)?\b/i, /athletic department/i,
    /physical therapy/i, /rehab/i, /chiropract/i,
    /preschool(?! gym)/i, /daycare/i, /child care/i,
    /dog\s/i, /pet\s/i, /veterinar/i,
];

const KEEP_PATTERNS = [
    /school/i, /elementary/i, /middle school/i, /high school/i,
    /gymnasium/i, /gym\b/i, /recreation/i, /community center/i,
    /ymca/i, /ywca/i, /jcc/i, /boys.*girls.*club/i,
    /basketball/i, /fitness/i, /athletic/i, /sports/i,
    /university/i, /college/i, /academy/i,
    /24 hour/i, /life time/i, /la fitness/i, /planet fitness/i,
    /multnomah athletic/i,
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
    console.log('║  PORTLAND METRO COURT DISCOVERY PIPELINE             ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

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

                // Deduplicate by proximity (within 100m)
                let isDupe = false;
                for (const [key, existing] of discovered) {
                    if (haversineKm(lat, lng, existing.lat, existing.lng) < 0.1) {
                        isDupe = true;
                        break;
                    }
                }

                if (!isDupe) {
                    const city = extractCity(addr);
                    if (city && (city.endsWith(', OR') || city.endsWith(', WA'))) {
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
    console.log(`  Unique venues: ${discovered.size}\n`);

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
                /athletic club/i.test(v.name) || /bay club/i.test(v.name) ||
                /multnomah athletic/i.test(v.name) ||
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
            });
            await httpPostRailway(`/courts/admin/create?${params.toString()}`);
            imported++;
            console.log(`  ✅ ${courtName} (${v.city})`);
        } catch (err) {
            importFail++;
            console.log(`  ❌ ${v.name}: ${err.message}`);
        }
        if (imported % 20 === 0) await sleep(100);
    }

    console.log(`\n  Imported: ${imported} | Failed: ${importFail}\n`);

    // ─── PHASE 3: Source tagging ─────────────────────────────────
    console.log('═══ PHASE 3: TAGGING SOURCE ═══\n');
    await sleep(1000);
    await httpPostRailway('/courts/admin/update-source?source=google&indoor=true&state=OR');
    await httpPostRailway('/courts/admin/update-source?source=google&indoor=true&state=WA');
    console.log('  Tagged all indoor OR/WA as source=google\n');

    // ─── PHASE 4: Classify venue types ───────────────────────────
    console.log('═══ PHASE 4: CLASSIFYING VENUE TYPES ═══\n');
    await sleep(1000);

    // Schools (specific patterns first)
    const schoolPats = [
        '%Elementary%', '%Middle School%', '%High School%',
        '%Prep School%', '%Preparatory%', '%School Gym%',
        '%School Gymnasium%', '%Junior High%', '%Academy%',
        '%Montessori%', '%Waldorf%', '%La Salle%',
    ];
    for (const pat of schoolPats) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=school&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }

    // Colleges
    const collegePats = [
        '%College%', '%University%', '%Cal State%',
        '%Community College%', '%Pacific University%',
        '%George Fox%', '%Concordia%', '%Warner Pacific%',
        '%Reed%', '%Lewis%Clark%',
    ];
    for (const pat of collegePats) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=college&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }

    // Rec centers
    const recPats = [
        '%YMCA%', '%YWCA%', '%JCC%',
        '%Community Center%', '%Community Gym%',
        '%Recreation%', '%Rec Center%',
        '%Civic Center%', '%Boys%Girls%Club%',
        '%Parks%Rec%', '%Park%',
        '%Community%',
    ];
    for (const pat of recPats) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=rec_center&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }

    // Gyms
    const gymPats = [
        '%24 Hour%', '%Life Time%', '%LA Fitness%', '%Planet Fitness%',
        '%Fitness%', '%Athletic Club%', '%Multnomah Athletic%',
        '%Health Club%', '%Wellness%', '%Training%',
        '%CrossFit%', '%Sport%',
    ];
    for (const pat of gymPats) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=gym&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }

    // Remaining indoor without venue_type → look for more patterns
    const broadPats = [
        { pat: '%Gym%', type: 'gym' },
        { pat: '%Center%', type: 'rec_center' },
        { pat: '%Club%', type: 'rec_center' },
        { pat: '%Church%', type: 'rec_center' },
    ];
    for (const { pat, type } of broadPats) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=${type}&name_pattern=${encodeURIComponent(pat)}&current_venue_type=_reset_`);
    }

    console.log('  Classification applied\n');

    // ─── PHASE 5: Verification ───────────────────────────────────
    console.log('═══ PHASE 5: VERIFICATION ═══\n');
    await sleep(2000);
    const finalCourts = await httpGet(`https://${BASE}/courts`);

    const pdxMetroCities = [
        'Portland', 'Beaverton', 'Hillsboro', 'Gresham', 'Lake Oswego', 'Tigard',
        'Tualatin', 'West Linn', 'Oregon City', 'Milwaukie', 'Clackamas', 'Wilsonville',
        'Sherwood', 'Happy Valley', 'Troutdale', 'Fairview', 'Wood Village', 'Gladstone',
        'Forest Grove', 'Cornelius', 'Newberg', 'Canby', 'Sandy', 'McMinnville',
        'Aloha', 'Damascus', 'Woodburn', 'Estacada', 'Molalla',
        'Vancouver', 'Camas', 'Washougal', 'Battle Ground', 'Ridgefield',
    ];

    const pdxIndoor = finalCourts.filter(c =>
        c.indoor && c.city && pdxMetroCities.some(city => c.city.startsWith(city + ','))
    );

    // Group by city
    const byCityMap = {};
    for (const c of pdxIndoor) {
        if (!byCityMap[c.city]) byCityMap[c.city] = [];
        byCityMap[c.city].push(c);
    }

    console.log(`  Portland Metro Indoor: ${pdxIndoor.length} courts`);
    console.log(`  Cities covered: ${Object.keys(byCityMap).length}\n`);

    console.log('  By city:');
    for (const [city, cts] of Object.entries(byCityMap).sort((a, b) => b[1].length - a[1].length)) {
        console.log(`    ${city}: ${cts.length}`);
    }

    // Venue type distribution
    const vtDist = {};
    for (const c of pdxIndoor) {
        const t = c.venue_type || 'unclassified';
        vtDist[t] = (vtDist[t] || 0) + 1;
    }
    console.log('\n  Venue types:');
    for (const [type, count] of Object.entries(vtDist).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${type}: ${count}`);
    }

    // Total DB stats
    const totalOR = finalCourts.filter(c => c.city?.endsWith(', OR'));
    const totalWA = finalCourts.filter(c => c.city?.endsWith(', WA'));
    console.log(`\n  Total DB: ${finalCourts.length}`);
    console.log(`  Oregon: ${totalOR.length} (${totalOR.filter(c => c.indoor).length} indoor)`);
    console.log(`  Washington: ${totalWA.length} (${totalWA.filter(c => c.indoor).length} indoor)`);
    console.log(`  API calls: ${queriesRun}\n`);

    console.log('══════════════════════════════════════════════════');
    console.log('PORTLAND METRO DISCOVERY COMPLETE');
    console.log('══════════════════════════════════════════════════\n');
}

main().catch(console.error);

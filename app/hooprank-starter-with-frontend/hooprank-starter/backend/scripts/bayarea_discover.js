/**
 * Bay Area Court Discovery Pipeline
 * 
 * Scalable process using Google Places API Text Search to discover ALL
 * indoor basketball courts (schools, gyms, rec centers, YMCAs, etc.)
 * 
 * Strategy:
 * 1. For each Bay Area sub-region, run multiple targeted queries
 * 2. Deduplicate by proximity (within 100m = same venue)
 * 3. Filter out non-basketball results
 * 4. Import with Google-verified coordinates
 * 
 * Cost: ~1 API call per query. ~20 results per query.
 * Budget: ~8,900 free calls remaining this month.
 */
const https = require('https');
const crypto = require('crypto');

const GOOGLE_API_KEY = 'AIzaSyCbro8Tiei_T2NtLhN87e9o3N3p9x_A4NA';
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
// Each query targets a specific type of venue in a specific area
// Broader queries = more results but more noise
const QUERIES = [
    // MARIN COUNTY - comprehensive
    'school gymnasium Marin County CA',
    'elementary school gym basketball Marin County CA',
    'middle school gymnasium Marin County CA',
    'high school gymnasium Marin County CA',
    'basketball gym San Rafael CA',
    'basketball gym Novato CA',
    'basketball gym Mill Valley CA',
    'recreation center basketball Marin County CA',
    'community center gym Marin County CA',
    'YMCA basketball Marin County CA',
    'fitness gym basketball court Marin County CA',
    'private gym basketball Marin County CA',
    'Bay Club Marin',
    'basketball court San Anselmo Fairfax CA',
    'basketball court Tiburon Larkspur CA',
    'school gym Kentfield Ross CA',
    'school gym Corte Madera CA',
    'school gym Sausalito CA',
    'community gym San Geronimo Valley CA',
    'Lucas Valley Elementary School San Rafael CA',
    'Miller Creek Middle School San Rafael CA',

    // SAN FRANCISCO - comprehensive
    'school gymnasium San Francisco CA',
    'elementary school gym basketball San Francisco CA',
    'middle school gym San Francisco CA',
    'high school gymnasium San Francisco CA',
    'recreation center basketball San Francisco CA',
    'community center gym San Francisco CA',
    'YMCA basketball San Francisco CA',
    'fitness gym basketball court San Francisco CA',
    'Bay Club San Francisco basketball',
    '24 Hour Fitness basketball San Francisco CA',

    // EAST BAY - Oakland / Berkeley / Alameda
    'school gymnasium Oakland CA',
    'school gymnasium Berkeley CA',
    'basketball gym Oakland CA',
    'basketball gym Berkeley CA',
    'recreation center basketball Oakland CA',
    'community center gym Oakland CA',
    'YMCA basketball East Bay CA',
    'fitness gym basketball court Oakland CA',
    'school gymnasium Alameda CA',
    'school gymnasium Emeryville Albany El Cerrito CA',

    // EAST BAY - Contra Costa
    'school gymnasium Concord Walnut Creek CA',
    'basketball gym Concord Walnut Creek CA',
    'school gymnasium Richmond CA',
    'school gymnasium Martinez Pleasant Hill CA',
    'basketball gym Danville San Ramon Dublin CA',
    'school gymnasium Antioch Pittsburg Brentwood CA',
    'recreation center basketball Contra Costa County CA',
    'YMCA basketball Contra Costa County CA',

    // EAST BAY - Tri-Valley / Southern Alameda
    'school gymnasium Fremont Hayward CA',
    'basketball gym Fremont Hayward CA',
    'school gymnasium Pleasanton Livermore CA',
    'basketball gym Union City Newark CA',
    'school gymnasium San Leandro CA',
    'recreation center basketball Alameda County CA',

    // PENINSULA
    'school gymnasium San Mateo CA',
    'school gymnasium Redwood City CA',
    'basketball gym San Mateo County CA',
    'school gymnasium Daly City South San Francisco CA',
    'basketball gym Burlingame San Carlos CA',
    'school gymnasium Menlo Park CA',
    'recreation center basketball San Mateo County CA',
    'YMCA basketball Peninsula CA',
    'school gymnasium Foster City Belmont CA',

    // SOUTH BAY
    'school gymnasium San Jose CA',
    'middle school gym San Jose CA',
    'high school gymnasium San Jose CA',
    'basketball gym San Jose CA',
    'school gymnasium Palo Alto Mountain View CA',
    'basketball gym Sunnyvale Santa Clara CA',
    'school gymnasium Milpitas Campbell Los Gatos CA',
    'basketball gym Cupertino Saratoga CA',
    'recreation center basketball Santa Clara County CA',
    'YMCA basketball South Bay San Jose CA',
    'fitness gym basketball court San Jose CA',

    // NORTH BAY - Sonoma / Napa / Solano
    'school gymnasium Santa Rosa CA',
    'basketball gym Petaluma CA',
    'school gymnasium Napa CA',
    'school gymnasium Fairfield Vallejo CA',
    'basketball gym Sonoma County CA',
    'recreation center basketball Sonoma Napa CA',
];

// ─── FILTER PATTERNS ─────────────────────────────────────────────
// Skip results that are clearly not basketball courts
const SKIP_PATTERNS = [
    /gymnastics/i, /gym ?world/i, /parkour/i, /crossfit/i,
    /yoga/i, /pilates/i, /boxing/i, /martial/i, /karate/i,
    /swim/i, /aquatic/i, /pool/i, /dance/i, /spin/i,
    /climbing/i, /boulder/i, /trampoline/i, /cheer/i,
    /golf/i, /tennis only/i, /racquet/i, /pickleball/i,
    /supply/i, /store/i, /shop/i, /equipment/i,
    /camp(?:s|ing)?\b/i, /athletic department/i,
    /snow valley/i, /nike camp/i,
];

// Keep results that match these patterns
const KEEP_PATTERNS = [
    /school/i, /elementary/i, /middle school/i, /high school/i,
    /gymnasium/i, /gym\b/i, /recreation/i, /community center/i,
    /ymca/i, /ywca/i, /jcc/i, /bay club/i, /24 hour/i,
    /basketball/i, /fitness/i, /athletic/i, /sports/i,
    /university/i, /college/i, /academy/i,
];

function shouldInclude(name, types) {
    const lname = name.toLowerCase();
    // Skip clearly non-basketball venues
    for (const pat of SKIP_PATTERNS) {
        if (pat.test(name)) return false;
    }
    // Check if name suggests basketball facility
    for (const pat of KEEP_PATTERNS) {
        if (pat.test(name)) return true;
    }
    // Check Google types
    const basketballTypes = ['gym', 'school', 'university', 'community_center', 'sports_complex'];
    if (types.some(t => basketballTypes.some(bt => t.includes(bt)))) return true;
    return false;
}

async function discoverPlaces(query) {
    const body = {
        textQuery: query,
        maxResultCount: 20,
    };
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
    // Extract "City, ST ZIP" from formatted address
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 3) {
        const cityPart = parts[parts.length - 3] || parts[0];
        const statePart = parts[parts.length - 2];
        const stateMatch = statePart.match(/^([A-Z]{2})/);
        if (stateMatch) return `${cityPart}, ${stateMatch[1]}`;
    }
    // Fallback
    const match = address.match(/,\s*([^,]+),\s*([A-Z]{2})\s+\d/);
    if (match) return `${match[1].trim()}, ${match[2]}`;
    return null;
}

async function main() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  BAY AREA COURT DISCOVERY PIPELINE               ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    // ─── PHASE 1: Delete existing Bay Area indoor courts ─────────
    console.log('═══ PHASE 1: CLEARING EXISTING BAY AREA INDOOR COURTS ═══\n');

    const allCourts = await httpGet(`https://${BASE}/courts`);
    const bayAreaCities = [
        'San Francisco', 'San Rafael', 'Novato', 'Mill Valley', 'San Anselmo',
        'Fairfax', 'Kentfield', 'Tiburon', 'Larkspur', 'Ross', 'Sausalito',
        'Corte Madera', 'Oakland', 'Berkeley', 'Fremont', 'Hayward', 'Richmond',
        'Concord', 'Walnut Creek', 'San Leandro', 'Union City', 'Newark',
        'Alameda', 'Emeryville', 'Albany', 'El Cerrito', 'Hercules', 'Pinole',
        'Orinda', 'Lafayette', 'Moraga', 'San Ramon', 'Dublin', 'Pleasanton',
        'Livermore', 'Danville', 'Antioch', 'Pittsburg', 'Brentwood', 'Martinez',
        'Pleasant Hill', 'San Jose', 'Palo Alto', 'Mountain View', 'Sunnyvale',
        'Santa Clara', 'Milpitas', 'Campbell', 'Los Gatos', 'Cupertino', 'Saratoga',
        'San Mateo', 'Redwood City', 'Daly City', 'San Bruno', 'South San Francisco',
        'Belmont', 'Foster City', 'Half Moon Bay', 'Pacifica', 'Burlingame',
        'San Carlos', 'Menlo Park', 'Santa Rosa', 'Petaluma', 'Napa',
        'Rohnert Park', 'Windsor', 'Healdsburg', 'Cloverdale', 'Sonoma',
        'Sebastopol', 'American Canyon', 'Fairfield', 'Vallejo', 'Vacaville',
        'Suisun City', 'Dixon', 'Rio Vista', 'Benicia',
    ];

    const bayIndoor = allCourts.filter(c =>
        c.indoor && c.city && bayAreaCities.some(city => c.city.startsWith(city + ','))
    );
    console.log(`Found ${bayIndoor.length} existing Bay Area indoor courts to remove\n`);

    let deleted = 0;
    for (const c of bayIndoor) {
        try {
            const params = new URLSearchParams({ name: c.name, city: c.city });
            await httpPostRailway(`/courts/admin/delete?${params.toString()}`);
            deleted++;
        } catch (e) { }
        if (deleted % 50 === 0) await sleep(100);
    }
    console.log(`  Deleted ${deleted}/${bayIndoor.length} courts\n`);

    // ─── PHASE 2: Discover via Google Places API ─────────────────
    console.log('═══ PHASE 2: DISCOVERING COURTS VIA GOOGLE PLACES API ═══\n');

    const discovered = new Map(); // key = rounded lat,lng -> venue
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

                // Filter
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
                    if (city && city.endsWith(', CA')) {
                        discovered.set(`${lat.toFixed(4)},${lng.toFixed(4)}`, {
                            name, lat, lng, city, address: addr, types,
                        });
                    }
                }
            }

            if (queriesRun % 10 === 0) {
                console.log(`  Queries: ${queriesRun}/${QUERIES.length} | Discovered: ${discovered.size} | Filtered: ${filtered}`);
            }

            await sleep(200); // Rate limit
        } catch (err) {
            console.log(`  ⚠️ Query failed: "${query}" — ${err.message}`);
        }
    }

    console.log(`\n  Total queries: ${queriesRun}`);
    console.log(`  Total results: ${totalResults}`);
    console.log(`  Filtered out: ${filtered}`);
    console.log(`  Unique venues: ${discovered.size}\n`);

    // ─── PHASE 3: Import discovered courts ───────────────────────
    console.log('═══ PHASE 3: IMPORTING DISCOVERED COURTS ═══\n');

    let imported = 0, importFail = 0;
    const venues = Array.from(discovered.values()).sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));

    for (const v of venues) {
        try {
            const id = generateUUID(v.name + v.city);
            const courtName = v.name.endsWith(' Gym') || v.name.endsWith(' Gymnasium')
                ? v.name
                : v.name + (v.types.includes('school') || v.types.includes('secondary_school') || v.types.includes('primary_school') ? ' Gym' : '');

            const params = new URLSearchParams({
                id,
                name: courtName,
                city: v.city,
                lat: String(v.lat),
                lng: String(v.lng),
                indoor: 'true',
                rims: '2',
                access: v.types.includes('gym') || v.name.includes('24 Hour') || v.name.includes('Bay Club')
                    ? 'members' : 'public',
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

    // ─── PHASE 4: Source tagging ─────────────────────────────────
    console.log('\n═══ PHASE 4: TAGGING SOURCE ═══\n');
    await sleep(1000);
    // Tag all indoor CA courts as source=google
    await httpPostRailway('/courts/admin/update-source?source=google&indoor=true&state=CA');
    console.log('  Tagged all CA indoor as source=google\n');

    // ─── PHASE 5: Verification ───────────────────────────────────
    console.log('═══ PHASE 5: VERIFICATION ═══\n');
    await sleep(2000);
    const finalCourts = await httpGet(`https://${BASE}/courts`);
    const finalBay = finalCourts.filter(c =>
        c.indoor && c.city && bayAreaCities.some(city => c.city.startsWith(city + ','))
    );

    // Group by sub-region
    const marin = finalBay.filter(c => ['San Rafael', 'Novato', 'Mill Valley', 'San Anselmo', 'Fairfax', 'Kentfield', 'Tiburon', 'Larkspur', 'Ross', 'Sausalito', 'Corte Madera'].some(x => c.city.startsWith(x + ',')));
    const sf = finalBay.filter(c => c.city.startsWith('San Francisco,'));
    const eastBay = finalBay.filter(c => ['Oakland', 'Berkeley', 'Fremont', 'Hayward', 'Richmond', 'Concord', 'Walnut Creek', 'San Leandro', 'Union City', 'Newark', 'Alameda', 'Emeryville', 'Albany', 'El Cerrito', 'Hercules', 'Pinole', 'Orinda', 'Lafayette', 'Moraga', 'San Ramon', 'Dublin', 'Pleasanton', 'Livermore', 'Danville', 'Antioch', 'Pittsburg', 'Brentwood', 'Martinez', 'Pleasant Hill'].some(x => c.city.startsWith(x + ',')));
    const peninsula = finalBay.filter(c => ['San Mateo', 'Redwood City', 'Daly City', 'San Bruno', 'South San Francisco', 'Belmont', 'Foster City', 'Half Moon Bay', 'Pacifica', 'Burlingame', 'San Carlos', 'Menlo Park'].some(x => c.city.startsWith(x + ',')));
    const southBay = finalBay.filter(c => ['San Jose', 'Palo Alto', 'Mountain View', 'Sunnyvale', 'Santa Clara', 'Milpitas', 'Campbell', 'Los Gatos', 'Cupertino', 'Saratoga'].some(x => c.city.startsWith(x + ',')));
    const northBay = finalBay.filter(c => ['Santa Rosa', 'Petaluma', 'Napa', 'Rohnert Park', 'Windsor', 'Healdsburg', 'Cloverdale', 'Sonoma', 'Sebastopol', 'American Canyon', 'Fairfield', 'Vallejo', 'Vacaville', 'Suisun City', 'Dixon', 'Rio Vista', 'Benicia'].some(x => c.city.startsWith(x + ',')));

    console.log(`Bay Area Indoor: ${finalBay.length} courts`);
    console.log(`  Marin: ${marin.length}`);
    console.log(`  SF: ${sf.length}`);
    console.log(`  East Bay: ${eastBay.length}`);
    console.log(`  Peninsula: ${peninsula.length}`);
    console.log(`  South Bay: ${southBay.length}`);
    console.log(`  North Bay: ${northBay.length}`);
    console.log(`  Other: ${finalBay.length - marin.length - sf.length - eastBay.length - peninsula.length - southBay.length - northBay.length}`);

    console.log(`\n  Total DB: ${finalCourts.length} (Indoor: ${finalCourts.filter(c => c.indoor).length}, Outdoor: ${finalCourts.filter(c => !c.indoor).length})`);
    console.log(`  Google API calls: ${queriesRun} (Places queries) + ${filtered} filtered`);

    // Check user's specific requests
    console.log('\n═══ SPOT CHECKS ═══');
    const check = (name) => {
        const matches = finalBay.filter(c => c.name.toLowerCase().includes(name.toLowerCase()));
        console.log(`  "${name}": ${matches.length > 0 ? matches.map(c => `${c.name} (${c.city}) [${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}]`).join('; ') : 'NOT FOUND'}`);
    };
    check('Miller Creek');
    check('Lucas Valley');
    check('San Geronimo');
    check('Bay Club Marin');
    check('Saint Vincent');
    check('Dixie'); // Should NOT be present

    console.log('\n══════════════════════════════════════════════════');
    console.log('BAY AREA DISCOVERY COMPLETE');
    console.log('══════════════════════════════════════════════════\n');
}

main().catch(console.error);

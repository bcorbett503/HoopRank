/**
 * LA Metro Court Discovery Pipeline
 * 
 * Uses Google Places API (New) searchText to discover indoor basketball
 * courts in the wider Los Angeles metro area.
 * 
 * Metro area covers: LA City, Long Beach, Pasadena, Glendale, Burbank,
 * Santa Monica, Inglewood, Torrance, Compton, Downey, Pomona, Anaheim,
 * Irvine, Santa Ana, Riverside, San Bernardino, etc.
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
    // LA CITY — comprehensive
    'school gymnasium Los Angeles CA',
    'elementary school gym basketball Los Angeles CA',
    'middle school gymnasium Los Angeles CA',
    'high school gymnasium Los Angeles CA',
    'basketball gym Los Angeles CA',
    'recreation center basketball Los Angeles CA',
    'community center gym Los Angeles CA',
    'YMCA basketball Los Angeles CA',
    'Boys and Girls Club Los Angeles CA',
    'Parks and Recreation gym Los Angeles CA',

    // LA NEIGHBORHOODS — deep coverage
    'school gym downtown Los Angeles CA',
    'school gym South Los Angeles CA',
    'school gym East Los Angeles CA',
    'school gym West Los Angeles CA',
    'school gym North Hollywood CA',
    'school gym Van Nuys CA',
    'school gym Encino Tarzana CA',
    'school gym Canoga Park CA',
    'school gym Woodland Hills CA',
    'school gym Reseda CA',
    'school gym Northridge CA',
    'school gym Chatsworth CA',
    'school gym Sylmar CA',
    'school gym Pacoima CA',
    'school gym Sun Valley CA',
    'school gym Eagle Rock Highland Park CA',
    'school gym Silver Lake Echo Park Los Angeles CA',
    'school gym Boyle Heights CA',
    'school gym Hyde Park CA',
    'school gym Crenshaw CA',
    'school gym Watts Willowbrook CA',
    'school gym Venice Mar Vista CA',
    'school gym Westchester Playa Del Rey CA',
    'school gym Harbor City Wilmington San Pedro CA',
    'recreation center basketball San Fernando Valley CA',

    // LONG BEACH / SOUTH BAY
    'school gymnasium Long Beach CA',
    'basketball gym Long Beach CA',
    'recreation center basketball Long Beach CA',
    'school gymnasium Torrance CA',
    'school gymnasium Carson CA',
    'school gymnasium Compton CA',
    'school gymnasium Gardena CA',
    'school gymnasium Hawthorne CA',
    'school gymnasium Inglewood CA',
    'school gymnasium Redondo Beach CA',
    'school gymnasium Manhattan Beach CA',
    'school gymnasium Hermosa Beach CA',
    'school gymnasium Lakewood CA',
    'school gymnasium Cerritos CA',
    'school gymnasium Bellflower CA',
    'school gymnasium Paramount CA',
    'school gymnasium Lynwood CA',
    'YMCA basketball Long Beach South Bay CA',

    // PASADENA / SAN GABRIEL VALLEY
    'school gymnasium Pasadena CA',
    'basketball gym Pasadena CA',
    'school gymnasium Alhambra CA',
    'school gymnasium Arcadia CA',
    'school gymnasium Monrovia CA',
    'school gymnasium Azusa CA',
    'school gymnasium Glendora CA',
    'school gymnasium San Dimas CA',
    'school gymnasium La Verne CA',
    'school gymnasium Covina West Covina CA',
    'school gymnasium Pomona CA',
    'school gymnasium Claremont CA',
    'school gymnasium Temple City CA',
    'school gymnasium Rosemead CA',
    'school gymnasium El Monte CA',
    'school gymnasium Whittier CA',
    'school gymnasium La Puente CA',
    'recreation center basketball San Gabriel Valley CA',

    // GLENDALE / BURBANK
    'school gymnasium Glendale CA',
    'school gymnasium Burbank CA',
    'basketball gym Glendale Burbank CA',
    'recreation center basketball Glendale CA',

    // WEST SIDE — SANTA MONICA / CULVER CITY / BEVERLY HILLS
    'school gymnasium Santa Monica CA',
    'basketball gym Santa Monica CA',
    'school gymnasium Culver City CA',
    'school gymnasium Beverly Hills CA',

    // SOUTH / SOUTHEAST — DOWNEY / NORWALK / WHITTIER
    'school gymnasium Downey CA',
    'school gymnasium Norwalk CA',
    'school gymnasium Pico Rivera CA',
    'school gymnasium La Mirada CA',
    'school gymnasium Artesia CA',
    'basketball gym Southeast LA County CA',

    // ORANGE COUNTY
    'school gymnasium Anaheim CA',
    'basketball gym Anaheim CA',
    'school gymnasium Santa Ana CA',
    'school gymnasium Irvine CA',
    'school gymnasium Fullerton CA',
    'school gymnasium Orange CA',
    'school gymnasium Garden Grove CA',
    'school gymnasium Huntington Beach CA',
    'school gymnasium Costa Mesa CA',
    'school gymnasium Newport Beach CA',
    'school gymnasium Westminster CA',
    'school gymnasium Tustin CA',
    'school gymnasium Mission Viejo CA',
    'school gymnasium Lake Forest CA',
    'school gymnasium Laguna Niguel CA',
    'school gymnasium San Clemente CA',
    'school gymnasium Yorba Linda CA',
    'school gymnasium Brea CA',
    'school gymnasium Placentia CA',
    'recreation center basketball Orange County CA',
    'YMCA basketball Orange County CA',
    'Boys and Girls Club Orange County CA',

    // INLAND EMPIRE (RIVERSIDE / SAN BERNARDINO)
    'school gymnasium Riverside CA',
    'basketball gym Riverside CA',
    'school gymnasium San Bernardino CA',
    'school gymnasium Ontario CA',
    'school gymnasium Rancho Cucamonga CA',
    'school gymnasium Fontana CA',
    'school gymnasium Rialto CA',
    'school gymnasium Upland CA',
    'school gymnasium Corona CA',
    'school gymnasium Moreno Valley CA',
    'school gymnasium Temecula CA',
    'school gymnasium Murrieta CA',
    'school gymnasium Chino Hills CA',
    'school gymnasium Redlands CA',
    'recreation center basketball Inland Empire CA',

    // VENTURA COUNTY
    'school gymnasium Thousand Oaks CA',
    'school gymnasium Simi Valley CA',
    'school gymnasium Ventura CA',
    'school gymnasium Oxnard CA',
    'school gymnasium Camarillo CA',
    'school gymnasium Moorpark CA',
    'recreation center basketball Ventura County CA',

    // COLLEGES — major
    'UCLA gym basketball',
    'USC gym basketball',
    'Cal State LA gym basketball',
    'Cal State Northridge gym basketball',
    'Cal State Fullerton gym basketball',
    'Cal State Long Beach gym basketball',
    'Cal State Dominguez Hills gym basketball',
    'Loyola Marymount gym basketball',
    'Pepperdine University gym basketball',
    'UC Irvine gym basketball',
    'Cal Poly Pomona gym basketball',
    'UC Riverside gym basketball',
    'Chapman University gym basketball',
    'Azusa Pacific University gym basketball',
    'Biola University gym basketball',

    // PRIVATE GYMS
    '24 Hour Fitness Los Angeles CA',
    '24 Hour Fitness Orange County CA',
    'LA Fitness Los Angeles CA',
    'Equinox basketball Los Angeles CA',
    'Life Time Fitness Los Angeles CA',
    'Planet Fitness Los Angeles CA',
];

// ─── FILTER PATTERNS (enhanced with sport-specific negatives) ───
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
    /equinox/i,
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
    console.log('║  LA METRO COURT DISCOVERY PIPELINE                   ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // Load existing courts for deduplication
    const existingCourts = await httpGet(`https://${BASE}/courts`);
    const existingCA = existingCourts.filter(c => c.city?.endsWith(', CA'));
    console.log(`  Existing CA courts: ${existingCA.length}\n`);

    // ─── PHASE 1: Discover ─────────────────
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
                    for (const ec of existingCA) {
                        if (ec.lat && ec.lng && haversineKm(lat, lng, ec.lat, ec.lng) < 0.1) { isDupe = true; dupeExisting++; break; }
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
                console.log(`  Queries: ${queriesRun}/${QUERIES.length} | New: ${discovered.size} | Filtered: ${filtered} | Dupe-existing: ${dupeExisting}`);
            }
            await sleep(200);
        } catch (err) {
            console.log(`  ⚠️ Query failed: "${query}" — ${err.message}`);
        }
    }

    console.log(`\n  Queries: ${queriesRun} | Results: ${totalResults} | Filtered: ${filtered}`);
    console.log(`  Duped against existing DB: ${dupeExisting}`);
    console.log(`  Unique NEW venues: ${discovered.size}\n`);

    // ─── PHASE 2: Import ───────────────────────
    console.log('═══ PHASE 2: IMPORTING ═══\n');

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
                /equinox/i.test(v.name) || /athletic club/i.test(v.name) ||
                /ymca/i.test(v.name) || /jcc/i.test(v.name);

            const params = new URLSearchParams({
                id, name: courtName, city: v.city,
                lat: String(v.lat), lng: String(v.lng),
                indoor: 'true', rims: '2',
                access: isMembersOnly ? 'members' : 'public',
                address: v.address,
            });
            await httpPostRailway(`/courts/admin/create?${params.toString()}`);
            imported++;
        } catch (err) { importFail++; }
        if (imported % 20 === 0) await sleep(100);
    }

    console.log(`  Imported: ${imported} | Failed: ${importFail}\n`);

    // ─── PHASE 3: Classify ───────────────────────
    console.log('═══ PHASE 3: CLASSIFYING ═══\n');
    await sleep(1000);

    const schoolPats = ['%Elementary%', '%Middle School%', '%High School%', '%Prep School%', '%Preparatory%', '%School Gym%', '%School Gymnasium%', '%Junior High%', '%Academy%', '%Montessori%'];
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
    const gymPats = ['%24 Hour%', '%Life Time%', '%LA Fitness%', '%Planet Fitness%', '%Fitness%', '%Athletic Club%', '%Equinox%', '%Health Club%', '%Training%', '%Sport%'];
    for (const pat of gymPats) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=gym&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }
    console.log('  Classification applied\n');

    // ─── PHASE 4: Verification ───────────────────────
    console.log('═══ PHASE 4: VERIFICATION ═══\n');
    await sleep(2000);
    const finalCourts = await httpGet(`https://${BASE}/courts`);
    const caIndoor = finalCourts.filter(c => c.city?.endsWith(', CA') && c.indoor);

    // LA metro cities
    const laMetroCities = [
        'Los Angeles', 'Long Beach', 'Pasadena', 'Glendale', 'Burbank', 'Santa Monica',
        'Inglewood', 'Torrance', 'Compton', 'Downey', 'Pomona', 'Anaheim', 'Irvine',
        'Santa Ana', 'Fullerton', 'Orange', 'Costa Mesa', 'Huntington Beach',
        'Garden Grove', 'Westminster', 'Newport Beach', 'Tustin', 'Mission Viejo',
        'Lake Forest', 'San Clemente', 'Yorba Linda', 'Brea', 'Placentia',
        'Riverside', 'San Bernardino', 'Ontario', 'Rancho Cucamonga', 'Fontana',
        'Corona', 'Moreno Valley', 'Temecula', 'Murrieta', 'Chino Hills', 'Redlands',
        'Rialto', 'Upland',
        'Alhambra', 'Arcadia', 'Monrovia', 'Azusa', 'Glendora', 'San Dimas', 'La Verne',
        'Covina', 'West Covina', 'Claremont', 'Temple City', 'Rosemead', 'El Monte', 'Whittier',
        'Carson', 'Gardena', 'Hawthorne', 'Redondo Beach', 'Manhattan Beach',
        'Lakewood', 'Cerritos', 'Bellflower', 'Paramount', 'Lynwood',
        'Norwalk', 'Pico Rivera', 'La Mirada',
        'Thousand Oaks', 'Simi Valley', 'Ventura', 'Oxnard', 'Camarillo', 'Moorpark',
        'Culver City', 'Beverly Hills',
        'North Hollywood', 'Van Nuys', 'Encino', 'Woodland Hills', 'Northridge',
        'Chatsworth', 'Sylmar', 'Pacoima', 'Canoga Park', 'Reseda',
        'Laguna Niguel',
    ];

    const laMetro = caIndoor.filter(c => laMetroCities.some(lc => c.city.startsWith(lc + ',')));

    const byCityMap = {};
    for (const c of laMetro) { if (!byCityMap[c.city]) byCityMap[c.city] = []; byCityMap[c.city].push(c); }

    console.log(`  LA Metro Indoor: ${laMetro.length} courts`);
    console.log(`  CA Indoor Total: ${caIndoor.length}`);
    console.log(`  Cities: ${Object.keys(byCityMap).length}\n`);

    console.log('  By city (top 25):');
    for (const [city, cts] of Object.entries(byCityMap).sort((a, b) => b[1].length - a[1].length).slice(0, 25)) {
        console.log(`    ${city}: ${cts.length}`);
    }

    const vtDist = {};
    for (const c of laMetro) { vtDist[c.venue_type || '?'] = (vtDist[c.venue_type || '?'] || 0) + 1; }
    console.log('\n  Venue types:');
    for (const [type, count] of Object.entries(vtDist).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${type}: ${count}`);
    }

    console.log(`\n  Total DB: ${finalCourts.length}`);
    console.log(`  API calls: ${queriesRun}\n`);
    console.log('══════════════════════════════════════════════════');
    console.log('LA METRO DISCOVERY COMPLETE');
    console.log('══════════════════════════════════════════════════\n');
}

main().catch(console.error);

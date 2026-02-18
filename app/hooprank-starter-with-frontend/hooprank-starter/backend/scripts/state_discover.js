#!/usr/bin/env node
/**
 * Generic State Indoor Court Discovery Pipeline
 * Usage: node state_discover.js NY   (discovers all indoor courts in New York)
 *        node state_discover.js NY,NJ,PA   (batch multiple states)
 * 
 * Auto-generates query patterns for each city in the state using the
 * state_cities.js database and runs the full 4-phase pipeline.
 */
const https = require('https');
const crypto = require('crypto');
const CITIES = require('./state_cities');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) { console.error('❌ GOOGLE_API_KEY env var required'); process.exit(1); }
const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

const STATE_NAMES = { NY: 'New York', IL: 'Illinois', FL: 'Florida', PA: 'Pennsylvania', OH: 'Ohio', MI: 'Michigan', GA: 'Georgia', NC: 'North Carolina', NJ: 'New Jersey', VA: 'Virginia', IN: 'Indiana', TN: 'Tennessee', MD: 'Maryland', MO: 'Missouri', WI: 'Wisconsin', MN: 'Minnesota', AL: 'Alabama', SC: 'South Carolina', LA: 'Louisiana', KY: 'Kentucky', CO: 'Colorado', AZ: 'Arizona', CT: 'Connecticut', OK: 'Oklahoma', MS: 'Mississippi', NV: 'Nevada', KS: 'Kansas', IA: 'Iowa', UT: 'Utah', NE: 'Nebraska', NM: 'New Mexico', WV: 'West Virginia', HI: 'Hawaii', DC: 'District of Columbia', DE: 'Delaware', ME: 'Maine', VT: 'Vermont', ID: 'Idaho', MT: 'Montana', WY: 'Wyoming', ND: 'North Dakota', SD: 'South Dakota', AK: 'Alaska' };

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function httpPost(hostname, path, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const opts = { hostname, path, method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, timeout: 15000 };
        const req = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ raw: d }); } }); });
        req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        if (body) req.write(JSON.stringify(body)); req.end();
    });
}
function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { timeout: 30000 }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { reject(new Error('JSON parse')); } }); }).on('error', reject);
    });
}
function httpPostRailway(path) {
    return new Promise((resolve, reject) => {
        const opts = { hostname: BASE, path, method: 'POST', headers: { 'x-user-id': USER_ID }, timeout: 10000 };
        const req = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, data: d })); });
        req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); }); req.end();
    });
}
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SKIP = [/gymnastics/i, /gym ?world/i, /parkour/i, /yoga/i, /pilates/i, /boxing/i, /martial/i, /karate/i, /jiu.?jitsu/i, /taekwondo/i, /kung fu/i, /swim/i, /aquatic/i, /pool/i, /dance/i, /ballet/i, /spin/i, /climbing/i, /boulder/i, /trampoline/i, /cheer/i, /golf/i, /tennis only/i, /racquet/i, /pickleball/i, /badminton/i, /volleyball(?! .*basketball)/i, /supply/i, /store/i, /shop/i, /equipment/i, /camp(?:s|ing)?\b/i, /athletic department/i, /physical therapy/i, /rehab/i, /chiropract/i, /preschool(?! gym)/i, /daycare/i, /child care/i, /childcare/i, /dog\s/i, /pet\s/i, /veterinar/i, /salon/i, /beauty/i, /nail/i, /barber/i, /nursing/i, /dental/i, /medical/i, /pharmacy/i, /skating rink/i, /ice rink/i, /hockey rink/i, /crossfit(?! .*basketball)/i, /rowing/i, /crew house/i, /boathouse/i];
const KEEP = [/school/i, /elementary/i, /middle school/i, /high school/i, /gymnasium/i, /gym\b/i, /recreation/i, /community center/i, /ymca/i, /ywca/i, /jcc/i, /boys.*girls.*club/i, /basketball/i, /fitness/i, /athletic/i, /sports/i, /university/i, /college/i, /academy/i, /24 hour/i, /life time/i, /la fitness/i, /planet fitness/i, /gold'?s? gym/i];

function shouldInclude(name, types) {
    for (const p of SKIP) if (p.test(name)) return false;
    for (const p of KEEP) if (p.test(name)) return true;
    if (types.some(t => ['gym', 'school', 'university', 'community_center', 'sports_complex'].some(bt => t.includes(bt)))) return true;
    return false;
}

function generateQueries(state, cities) {
    const queries = [];
    const big = cities.slice(0, Math.min(cities.length, 8)); // top 8 cities get full treatment
    const mid = cities.slice(8, Math.min(cities.length, 25)); // next 17 get medium treatment
    const small = cities.slice(25); // rest get basic treatment

    for (const city of big) {
        queries.push(
            `school gymnasium ${city} ${state}`,
            `elementary school gym basketball ${city} ${state}`,
            `middle school gymnasium ${city} ${state}`,
            `high school gymnasium ${city} ${state}`,
            `basketball gym ${city} ${state}`,
            `recreation center basketball ${city} ${state}`,
            `community center gym ${city} ${state}`,
            `YMCA basketball ${city} ${state}`,
            `indoor basketball court ${city} ${state}`,
            `athletic club basketball ${city} ${state}`,
        );
    }
    for (const city of mid) {
        queries.push(
            `school gymnasium ${city} ${state}`,
            `basketball gym ${city} ${state}`,
            `recreation center basketball ${city} ${state}`,
        );
    }
    for (const city of small) {
        queries.push(`school gymnasium ${city} ${state}`);
    }
    // Add state-wide category queries
    const sn = STATE_NAMES[state] || state;
    queries.push(
        `YMCA basketball ${sn}`,
        `Boys and Girls Club ${sn}`,
        `24 Hour Fitness ${sn}`,
        `LA Fitness ${sn}`,
        `Life Time Fitness ${sn}`,
        `Planet Fitness basketball ${sn}`,
        `Gold's Gym ${sn}`,
        `indoor basketball facility ${sn}`,
        `basketball training facility ${sn}`,
        `athletic club gym basketball ${sn}`,
        `sports club basketball court ${sn}`,
        `private club gymnasium ${sn}`,
    );
    return queries;
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
        const city = parts[parts.length - 3] || parts[0];
        const st = parts[parts.length - 2];
        const m = st.match(/^([A-Z]{2})/);
        if (m) return `${city}, ${m[1]}`;
    }
    const m = address.match(/,\s*([^,]+),\s*([A-Z]{2})\s+\d/);
    if (m) return `${m[1].trim()}, ${m[2]}`;
    return null;
}

async function runState(state) {
    const cities = CITIES[state];
    if (!cities) { console.log(`  ❌ No cities found for ${state}`); return { state, discovered: 0, imported: 0 }; }

    const sn = STATE_NAMES[state] || state;
    console.log(`\n╔${'═'.repeat(54)}╗`);
    console.log(`║  ${sn.toUpperCase()} (${state}) COURT DISCOVERY${' '.repeat(Math.max(0, 35 - sn.length))}║`);
    console.log(`╚${'═'.repeat(54)}╝\n`);

    // Load existing courts for dedup
    const existingCourts = await httpGet(`https://${BASE}/courts`);
    const existingState = existingCourts.filter(c => c.city?.endsWith(`, ${state}`));
    console.log(`  Existing ${state} courts: ${existingState.length}`);
    console.log(`  Cities in database: ${cities.length}\n`);

    const queries = generateQueries(state, cities);
    console.log(`  Generated ${queries.length} queries\n`);
    console.log(`═══ PHASE 1: DISCOVERING ═══\n`);

    const discovered = new Map();
    let queriesRun = 0, totalResults = 0, filtered = 0, dupeExisting = 0;

    for (const query of queries) {
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
                for (const [, ex] of discovered) { if (haversineKm(lat, lng, ex.lat, ex.lng) < 0.1) { isDupe = true; break; } }
                if (!isDupe) { for (const ec of existingState) { if (ec.lat && ec.lng && haversineKm(lat, lng, ec.lat, ec.lng) < 0.1) { isDupe = true; dupeExisting++; break; } } }
                if (!isDupe) {
                    const city = extractCity(addr);
                    if (city && city.endsWith(`, ${state}`)) {
                        discovered.set(`${lat.toFixed(4)},${lng.toFixed(4)}`, { name, lat, lng, city, address: addr, types });
                    }
                }
            }
            if (queriesRun % 20 === 0) console.log(`  Queries: ${queriesRun}/${queries.length} | New: ${discovered.size} | Filtered: ${filtered} | Dupe: ${dupeExisting}`);
            await sleep(200);
        } catch (err) { console.log(`  ⚠️ "${query}" — ${err.message}`); }
    }
    console.log(`\n  Queries: ${queriesRun} | Results: ${totalResults} | Filtered: ${filtered} | Dupe: ${dupeExisting}`);
    console.log(`  Unique NEW: ${discovered.size}\n`);

    console.log(`═══ PHASE 2: IMPORTING ═══\n`);
    let imported = 0, importFail = 0;
    const venues = Array.from(discovered.values()).sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
    for (const v of venues) {
        try {
            const id = generateUUID(v.name + v.city);
            const isSchool = v.types.includes('school') || v.types.includes('secondary_school') || v.types.includes('primary_school');
            const courtName = v.name.endsWith(' Gym') || v.name.endsWith(' Gymnasium') ? v.name : v.name + (isSchool ? ' Gym' : '');
            const isMem = v.types.includes('gym') || /24 hour|life time|la fitness|planet fitness|gold'?s? gym|athletic club|ymca|jcc/i.test(v.name);
            const params = new URLSearchParams({ id, name: courtName, city: v.city, lat: String(v.lat), lng: String(v.lng), indoor: 'true', rims: '2', access: isMem ? 'members' : 'public', address: v.address });
            await httpPostRailway(`/courts/admin/create?${params.toString()}`);
            imported++;
        } catch { importFail++; }
        if (imported % 20 === 0) await sleep(100);
    }
    console.log(`  Imported: ${imported} | Failed: ${importFail}\n`);

    console.log(`═══ PHASE 3: CLASSIFYING ═══\n`);
    await sleep(500);
    for (const p of ['%Elementary%', '%Middle School%', '%High School%', '%Prep School%', '%School Gym%', '%School Gymnasium%', '%Junior High%', '%Academy%', '%Montessori%'])
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=school&name_pattern=${encodeURIComponent(p)}&indoor=true`);
    for (const p of ['%College%', '%University%'])
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=college&name_pattern=${encodeURIComponent(p)}&indoor=true`);
    for (const p of ['%YMCA%', '%YWCA%', '%JCC%', '%Community Center%', '%Recreation%', '%Rec Center%', '%Boys%Girls%Club%', '%Parks%'])
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=rec_center&name_pattern=${encodeURIComponent(p)}&indoor=true`);
    for (const p of ['%24 Hour%', '%Life Time%', '%LA Fitness%', '%Planet Fitness%', '%Fitness%', '%Athletic Club%', '%Gold%Gym%', '%Health Club%', '%Training%', '%Sport%'])
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=gym&name_pattern=${encodeURIComponent(p)}&indoor=true`);
    console.log(`  Classification applied\n`);

    console.log(`═══ PHASE 4: VERIFICATION ═══\n`);
    await sleep(1000);
    const finalCourts = await httpGet(`https://${BASE}/courts`);
    const stIndoor = finalCourts.filter(c => c.city?.endsWith(`, ${state}`) && c.indoor);
    const byCityMap = {};
    for (const c of stIndoor) { if (!byCityMap[c.city]) byCityMap[c.city] = []; byCityMap[c.city].push(c); }
    console.log(`  ${state} Indoor: ${stIndoor.length} courts | Cities: ${Object.keys(byCityMap).length}\n`);
    console.log(`  Top 20 cities:`);
    for (const [city, cts] of Object.entries(byCityMap).sort((a, b) => b[1].length - a[1].length).slice(0, 20))
        console.log(`    ${city}: ${cts.length}`);
    const vtDist = {};
    for (const c of stIndoor) { vtDist[c.venue_type || '?'] = (vtDist[c.venue_type || '?'] || 0) + 1; }
    console.log(`\n  Venue types:`);
    for (const [t, n] of Object.entries(vtDist).sort((a, b) => b[1] - a[1])) console.log(`    ${t}: ${n}`);
    console.log(`\n  Total DB: ${finalCourts.length}\n`);

    return { state, discovered: discovered.size, imported, cities: Object.keys(byCityMap).length, total: stIndoor.length };
}

async function main() {
    const args = process.argv[2];
    if (!args) { console.log('Usage: node state_discover.js NY  or  node state_discover.js NY,NJ,PA'); process.exit(1); }
    const states = args.split(',').map(s => s.trim().toUpperCase());

    console.log(`\n${'═'.repeat(56)}`);
    console.log(`  BATCH DISCOVERY: ${states.join(', ')}`);
    console.log(`${'═'.repeat(56)}\n`);

    const results = [];
    for (const state of states) {
        const r = await runState(state);
        results.push(r);
        console.log(`\n${'─'.repeat(56)}\n`);
    }

    console.log(`\n${'═'.repeat(56)}`);
    console.log(`  BATCH SUMMARY`);
    console.log(`${'═'.repeat(56)}`);
    for (const r of results) {
        console.log(`  ${r.state}: ${r.imported} imported → ${r.total} total indoor (${r.cities} cities)`);
    }
    const totalImported = results.reduce((s, r) => s + r.imported, 0);
    console.log(`\n  TOTAL IMPORTED: ${totalImported}`);
    console.log(`${'═'.repeat(56)}\n`);
}

main().catch(console.error);

#!/usr/bin/env node
/**
 * ops/discover_courts.js — Master Court Discovery Pipeline
 *
 * Consolidates all audit scripts (ca_audit/, or_audit/, wa_audit/),
 * standalone discovers (bayarea, boston, la, portland, seattle, austin, ar),
 * and state_discover.js into a single tool.
 *
 * Usage:
 *   node discover_courts.js --state FL                  # Full state pipeline
 *   node discover_courts.js --state FL,GA,AL            # Batch states
 *   node discover_courts.js --state FL --cities "Merritt Island,Cocoa"
 *   node discover_courts.js --query "basketball gym Merritt Island FL"
 *   node discover_courts.js --lookup "Venice Beach Courts"
 *   node discover_courts.js --state FL --dry             # Dry-run any mode
 */

const {
    BASE, BRETT_ID, STATE_NAMES,
    sleep, getTokenInteractive, generateUUID, haversineKm,
    shouldInclude, discoverPlaces, lookupVenue,
    extractCity, inferVenueType,
    httpGet, adminPost, classifyVenues, createCourt,
} = require('./lib');

const CITIES = require('./state_cities');

// ── CLI parsing ──────────────────────────────────────────────────
const args = process.argv.slice(2);
const API_KEY = process.env.GOOGLE_API_KEY;
let TOKEN = process.env.TOKEN;
const DRY = args.includes('--dry');

const STATE = (() => {
    const i = args.indexOf('--state');
    return i >= 0 && args[i + 1] ? args[i + 1].toUpperCase() : null;
})();
const USER_CITIES = (() => {
    const i = args.indexOf('--cities');
    return i >= 0 && args[i + 1] ? args[i + 1].split(',').map(c => c.trim()) : null;
})();
const QUERY = (() => {
    const i = args.indexOf('--query');
    return i >= 0 && args[i + 1] ? args.slice(i + 1).join(' ') : null;
})();
const LOOKUP = (() => {
    const i = args.indexOf('--lookup');
    return i >= 0 && args[i + 1] ? args.slice(i + 1).join(' ') : null;
})();

if (!API_KEY) { console.error('❌ GOOGLE_API_KEY env var required'); process.exit(1); }
if (!STATE && !QUERY && !LOOKUP) {
    console.error('Usage: node discover_courts.js --state FL [--cities "City1,City2"] [--dry]');
    console.error('       node discover_courts.js --query "basketball gym City State" [--dry]');
    console.error('       node discover_courts.js --lookup "Venue Name"');
    process.exit(1);
}

// ── Query generation ─────────────────────────────────────────────

/**
 * Generate tiered search queries for a state.
 * Top 8 cities → 13 queries each (comprehensive school + gym coverage)
 * Next 17 cities → 5 queries each (school + gym + rec)
 * Remaining cities → 2 queries each (school + basketball)
 * Plus state-wide brand/category queries.
 */
function generateQueries(state, cities) {
    const queries = [];
    const big = cities.slice(0, Math.min(cities.length, 8));
    const mid = cities.slice(8, Math.min(cities.length, 25));
    const small = cities.slice(25);

    for (const city of big) {
        queries.push(
            // Schools — the core gap the old audit scripts filled
            `elementary school gymnasium ${city} ${state}`,
            `middle school gymnasium ${city} ${state}`,
            `high school gymnasium ${city} ${state}`,
            `school gymnasium ${city} ${state}`,
            // Gyms & rec
            `basketball gym ${city} ${state}`,
            `recreation center basketball ${city} ${state}`,
            `community center gym ${city} ${state}`,
            `YMCA basketball ${city} ${state}`,
            `indoor basketball court ${city} ${state}`,
            `athletic club basketball ${city} ${state}`,
            // Colleges
            `university gymnasium ${city} ${state}`,
            `college recreation center ${city} ${state}`,
            // Fitness chains
            `24 Hour Fitness basketball ${city} ${state}`,
        );
    }
    for (const city of mid) {
        queries.push(
            `school gymnasium ${city} ${state}`,
            `high school gymnasium ${city} ${state}`,
            `basketball gym ${city} ${state}`,
            `recreation center basketball ${city} ${state}`,
            `college gymnasium ${city} ${state}`,
        );
    }
    for (const city of small) {
        queries.push(
            `school gymnasium ${city} ${state}`,
            `basketball gym ${city} ${state}`,
        );
    }

    // State-wide brand/category queries
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

// ── Phase 1: Discovery ───────────────────────────────────────────

async function discover(queries, existingCourts, stateCode) {
    const discovered = new Map();
    let queriesRun = 0, totalResults = 0, filtered = 0, dupeNew = 0, dupeExisting = 0;

    for (const query of queries) {
        try {
            const places = await discoverPlaces(query, API_KEY);
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

                // Dedup against previously discovered in this run
                let isDupe = false;
                for (const [, ex] of discovered) {
                    if (haversineKm(lat, lng, ex.lat, ex.lng) < 0.1) { isDupe = true; dupeNew++; break; }
                }
                // Dedup against existing DB courts
                if (!isDupe && existingCourts.length > 0) {
                    for (const ec of existingCourts) {
                        if (ec.lat && ec.lng && haversineKm(lat, lng, ec.lat, ec.lng) < 0.1) {
                            isDupe = true; dupeExisting++; break;
                        }
                    }
                }
                if (!isDupe) {
                    const city = extractCity(addr);
                    // If running a state pipeline, only include courts in that state
                    if (stateCode && city && !city.endsWith(`, ${stateCode}`)) continue;
                    discovered.set(`${lat.toFixed(4)},${lng.toFixed(4)}`, {
                        name, lat, lng, city: city || '?', address: addr, types,
                    });
                }
            }
            if (queriesRun % 20 === 0) {
                console.log(`  Queries: ${queriesRun}/${queries.length} | New: ${discovered.size} | Filtered: ${filtered} | Dupe(DB): ${dupeExisting} | Dupe(run): ${dupeNew}`);
            }
            await sleep(200);
        } catch (err) {
            console.log(`  ⚠️  "${query}" — ${err.message}`);
        }
    }

    console.log(`\n  Queries: ${queriesRun} | Results: ${totalResults} | Filtered: ${filtered}`);
    console.log(`  Dupe (existing DB): ${dupeExisting} | Dupe (this run): ${dupeNew}`);
    console.log(`  Unique NEW: ${discovered.size}\n`);

    return Array.from(discovered.values()).sort((a, b) =>
        (a.city || '').localeCompare(b.city || '') || a.name.localeCompare(b.name));
}

// ── Phase 2: Import ──────────────────────────────────────────────

async function importCourts(venues) {
    if (DRY) {
        console.log(`  DRY RUN — would import ${venues.length} courts:\n`);
        for (const v of venues) console.log(`    • ${v.name} — ${v.address}`);
        return { imported: venues.length, failed: 0 };
    }
    if (!TOKEN) {
        console.log(`  ⚠️  No TOKEN set — printing discovered courts instead:\n`);
        for (const v of venues) console.log(`    • ${v.name} — ${v.address}`);
        return { imported: 0, failed: 0 };
    }

    let imported = 0, failed = 0;
    for (const v of venues) {
        try {
            const isSchool = (v.types || []).some(t => ['school', 'secondary_school', 'primary_school'].includes(t));
            const courtName = v.name.endsWith(' Gym') || v.name.endsWith(' Gymnasium')
                ? v.name : v.name + (isSchool ? ' Gym' : '');
            const isMem = (v.types || []).includes('gym') ||
                /24 hour|life time|la fitness|planet fitness|gold'?s? gym|athletic club|ymca|jcc|bay club|equinox/i.test(v.name);

            await createCourt({
                id: generateUUID(courtName + v.city),
                name: courtName,
                city: v.city,
                lat: v.lat,
                lng: v.lng,
                indoor: true,
                access: isMem ? 'members' : 'public',
                venue_type: inferVenueType(courtName),
                address: v.address,
            }, TOKEN);
            imported++;
        } catch (err) {
            console.log(`  ❌ ${v.name}: ${err.message}`);
            failed++;
        }
        if (imported % 20 === 0) await sleep(100);
    }
    console.log(`  Imported: ${imported} | Failed: ${failed}\n`);
    return { imported, failed };
}

// ── Phase 4: Verification ────────────────────────────────────────

async function verify(stateCode) {
    await sleep(1000);
    const allCourts = await httpGet(`${BASE}/courts`);
    const stIndoor = allCourts.filter(c => c.city?.endsWith(`, ${stateCode}`) && c.indoor);
    const byCityMap = {};
    for (const c of stIndoor) {
        if (!byCityMap[c.city]) byCityMap[c.city] = [];
        byCityMap[c.city].push(c);
    }
    console.log(`  ${stateCode} Indoor: ${stIndoor.length} courts | Cities: ${Object.keys(byCityMap).length}\n`);
    console.log(`  Top 20 cities:`);
    for (const [city, cts] of Object.entries(byCityMap).sort((a, b) => b[1].length - a[1].length).slice(0, 20))
        console.log(`    ${city}: ${cts.length}`);

    const vtDist = {};
    for (const c of stIndoor) vtDist[c.venue_type || '?'] = (vtDist[c.venue_type || '?'] || 0) + 1;
    console.log(`\n  Venue types:`);
    for (const [t, n] of Object.entries(vtDist).sort((a, b) => b[1] - a[1])) console.log(`    ${t}: ${n}`);
    console.log(`\n  Total DB: ${allCourts.length}\n`);

    return { total: stIndoor.length, cities: Object.keys(byCityMap).length };
}

// ── State pipeline (4-phase) ─────────────────────────────────────

async function runState(stateCode) {
    const cities = USER_CITIES || CITIES[stateCode];
    if (!cities || cities.length === 0) {
        console.log(`  ❌ No cities found for ${stateCode}`);
        return { state: stateCode, discovered: 0, imported: 0 };
    }

    const sn = STATE_NAMES[stateCode] || stateCode;
    console.log(`\n╔${'═'.repeat(54)}╗`);
    console.log(`║  ${sn.toUpperCase()} (${stateCode}) COURT DISCOVERY${' '.repeat(Math.max(0, 35 - sn.length))}║`);
    console.log(`╚${'═'.repeat(54)}╝\n`);

    // Load existing courts for dedup
    let existingState = [];
    try {
        const existingCourts = await httpGet(`${BASE}/courts`);
        existingState = existingCourts.filter(c => c.city?.endsWith(`, ${stateCode}`));
        console.log(`  Existing ${stateCode} courts: ${existingState.length}`);
    } catch { console.log(`  ⚠️  Could not load existing courts for dedup`); }
    console.log(`  Cities: ${cities.length} | User-filtered: ${USER_CITIES ? 'yes' : 'no'}\n`);

    const queries = generateQueries(stateCode, cities);
    console.log(`  Generated ${queries.length} queries\n`);

    // Phase 1
    console.log(`═══ PHASE 1: DISCOVERING ═══\n`);
    const venues = await discover(queries, existingState, stateCode);

    // Phase 2
    console.log(`═══ PHASE 2: IMPORTING ═══\n`);
    const { imported } = await importCourts(venues);

    // Phase 3 (skip for dry runs)
    if (!DRY && TOKEN) {
        console.log(`═══ PHASE 3: CLASSIFYING ═══\n`);
        await sleep(500);
        await classifyVenues(stateCode);
        console.log(`  Classification applied\n`);
    }

    // Phase 4 (skip for dry runs)
    let total = venues.length;
    if (!DRY && TOKEN) {
        console.log(`═══ PHASE 4: VERIFICATION ═══\n`);
        const v = await verify(stateCode);
        total = v.total;
    }

    return { state: stateCode, discovered: venues.length, imported, total };
}

// ── Single query mode ────────────────────────────────────────────

async function runSingleQuery(query) {
    console.log(`\n${'═'.repeat(39)}`);
    console.log(`  HoopRank Court Discovery${DRY ? ' (DRY RUN)' : ''}`);
    console.log(`${'═'.repeat(39)}\n`);
    console.log(`=== Single search: "${query}" ===`);

    const venues = await discover([query], [], null);

    console.log(`Found ${venues.length} courts:`);
    for (const v of venues) console.log(`  • ${v.name} — ${v.address}`);

    if (!DRY && TOKEN && venues.length > 0) {
        console.log(`\n=== Importing ===\n`);
        await importCourts(venues);
    }
}

// ── Lookup mode ──────────────────────────────────────────────────

async function runLookup(name) {
    console.log(`\n  🔍 Looking up: "${name}"\n`);
    const venue = await lookupVenue(name, API_KEY);
    if (!venue) { console.log('  ❌ Not found'); return; }
    console.log(`  ✅ ${venue.name}`);
    console.log(`     ${venue.address}`);
    console.log(`     lat: ${venue.lat}, lng: ${venue.lng}`);
    console.log(`     types: ${venue.types.join(', ')}`);

    if (!DRY && TOKEN) {
        console.log(`\n  Importing...`);
        await importCourts([venue]);
    }
}

// ── Main ─────────────────────────────────────────────────────────

(async () => {
    if (!DRY && !TOKEN) {
        TOKEN = await getTokenInteractive();
    }

    if (LOOKUP) return runLookup(LOOKUP);
    if (QUERY) return runSingleQuery(QUERY);

    // State pipeline
    const states = STATE.split(',').map(s => s.trim().toUpperCase());

    if (states.length > 1) {
        console.log(`\n${'═'.repeat(56)}`);
        console.log(`  BATCH DISCOVERY: ${states.join(', ')}`);
        console.log(`${'═'.repeat(56)}\n`);
    }

    const results = [];
    for (const s of states) {
        const r = await runState(s);
        results.push(r);
        if (states.length > 1) console.log(`\n${'─'.repeat(56)}\n`);
    }

    if (states.length > 1) {
        console.log(`\n${'═'.repeat(56)}`);
        console.log(`  BATCH SUMMARY`);
        console.log(`${'═'.repeat(56)}`);
        for (const r of results) {
            console.log(`  ${r.state}: ${r.imported} imported → ${r.total} total (${r.discovered} discovered)`);
        }
        const totalImported = results.reduce((s, r) => s + r.imported, 0);
        console.log(`\n  TOTAL IMPORTED: ${totalImported}`);
        console.log(`${'═'.repeat(56)}\n`);
    }
})().catch(console.error);

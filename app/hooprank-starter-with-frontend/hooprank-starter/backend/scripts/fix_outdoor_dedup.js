/**
 * Fix Outdoor Courts: Remove duplicates + fix Portland shared coords
 */
const https = require('https');
const crypto = require('crypto');

const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';
const KEY = 'AIzaSyCbro8Tiei_T2NtLhN87e9o3N3p9x_A4NA';

function httpGet(u) { return new Promise((r, j) => https.get(u, { timeout: 15000 }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d))) }).on('error', j)); }
function httpPost(p) { return new Promise((r, j) => { const req = https.request({ hostname: BASE, path: p, method: 'POST', headers: { 'x-user-id': USER_ID }, timeout: 10000 }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => r({ status: res.statusCode, data: d })) }); req.on('error', j); req.end(); }); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function generateUUID(n) { const h = crypto.createHash('md5').update(n).digest('hex'); return h.substr(0, 8) + '-' + h.substr(8, 4) + '-' + h.substr(12, 4) + '-' + h.substr(16, 4) + '-' + h.substr(20, 12); }

async function geocode(query) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${KEY}`;
    const result = await httpGet(url);
    if (result.status === 'OK' && result.results.length > 0) {
        return result.results[0].geometry.location;
    }
    return null;
}

async function main() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  FIX OUTDOOR: DEDUP + PORTLAND COORDS            ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    const courts = await httpGet(`https://${BASE}/courts`);
    const outdoor = courts.filter(c => !c.indoor);
    console.log(`Outdoor courts before cleanup: ${outdoor.length}\n`);

    // --- STEP 1: Remove OSM-source duplicates (keep curated/google ones) ---
    console.log('=== STEP 1: REMOVING DUPLICATE OSM ENTRIES ===\n');

    // Group by name+city
    const groups = {};
    for (const c of outdoor) {
        const key = c.name + '|' + c.city;
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
    }

    let deleted = 0;
    for (const [key, courts] of Object.entries(groups)) {
        if (courts.length > 1) {
            // Keep the curated (Google-fixed) one, delete the osm one
            const osm = courts.filter(c => c.source === 'osm');
            for (const c of osm) {
                const params = new URLSearchParams({ name: c.name, city: c.city });
                // Delete ALL with this name+city, we'll re-create the good one
                // Actually, the delete endpoint deletes ALL matching name+city
                // So we need a different approach
                console.log(`  Duplicate: ${c.name} (${c.city}) - osm source`);
            }
        }
    }

    // Better approach: delete ALL duplicated courts, then re-create just the curated ones
    const dupeKeys = Object.entries(groups).filter(([k, v]) => v.length > 1).map(([k]) => k);
    console.log(`\n  Found ${dupeKeys.length} duplicated court groups`);

    for (const key of dupeKeys) {
        const [name, city] = key.split('|');
        const courts = groups[key];

        // Find the best version (curated/google)
        const best = courts.find(c => c.source !== 'osm') || courts[0];

        // Delete all versions (the endpoint deletes by name+city)
        const params = new URLSearchParams({ name, city });
        await httpPost(`/courts/admin/delete?${params.toString()}`);

        // Re-create the best version
        const id = generateUUID(name + city);
        const createParams = new URLSearchParams({
            id, name, city,
            lat: String(best.lat), lng: String(best.lng),
            indoor: 'false', access: best.access || 'public',
        });
        await httpPost(`/courts/admin/create?${createParams.toString()}`);
        deleted += courts.length - 1;
        console.log(`  ✅ Deduped: ${name} (${city}) — kept lat=${best.lat.toFixed(4)}`);
        await sleep(50);
    }
    console.log(`\n  Removed ${deleted} duplicates\n`);

    // --- STEP 2: Fix Chicago courts with shared wrong coords ---
    console.log('=== STEP 2: FIXING COURTS WITH SHARED/WRONG COORDS ===\n');

    // Portland courts that all share 45.546135, -122.657950
    const fixList = [
        { name: 'Alberta Park Courts', city: 'Portland, OR', query: 'Alberta Park basketball courts Portland OR' },
        { name: 'Grant Park Courts', city: 'Portland, OR', query: 'Grant Park basketball courts Portland OR' },
        { name: 'Irving Park Courts', city: 'Portland, OR', query: 'Irving Park basketball courts Portland OR' },
        { name: 'Peninsula Park Courts', city: 'Portland, OR', query: 'Peninsula Park Portland OR' },
        // Chicago courts with shared coords
        { name: 'Humboldt Park Courts', city: 'Chicago, IL', query: 'Humboldt Park basketball courts Chicago IL' },
        { name: 'Lincoln Park Courts', city: 'Chicago, IL', query: 'Lincoln Park basketball courts Chicago IL' },
        { name: 'Oz Park Courts', city: 'Chicago, IL', query: 'Oz Park basketball courts Chicago IL' },
        // Houston courts that may be off
        { name: 'Fonde Recreation Center Courts', city: 'Houston, TX', query: 'Fonde Recreation Center Houston TX' },
        { name: 'MacGregor Park Courts', city: 'Houston, TX', query: 'MacGregor Park Houston TX' },
        // Others that looked off
        { name: 'Dyckman Park', city: 'New York, NY', query: 'Dyckman Park basketball courts New York NY' },
        { name: 'Pittman-Sullivan Park Courts', city: 'San Antonio, TX', query: 'Pittman-Sullivan Park San Antonio TX' },
        { name: 'Hardberger Park Urban Ecology Center', city: 'San Antonio, TX', query: 'Hardberger Park Phil Hardberger Park San Antonio TX' },
        { name: 'Lake Eola Park Courts', city: 'Orlando, FL', query: 'Lake Eola Park Orlando FL' },
    ];

    let googleCalls = 0;
    for (const court of fixList) {
        const loc = await geocode(court.query);
        googleCalls++;
        if (loc) {
            const id = generateUUID(court.name + court.city);
            const params = new URLSearchParams({
                id, name: court.name, city: court.city,
                lat: String(loc.lat), lng: String(loc.lng),
                indoor: 'false', access: 'public',
            });
            await httpPost(`/courts/admin/create?${params.toString()}`);
            console.log(`  ✅ ${court.name} → ${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`);
        } else {
            console.log(`  ❌ ${court.name} — not found`);
        }
        await sleep(100);
    }

    // --- STEP 3: Verify ---
    console.log('\n=== STEP 3: FINAL VERIFICATION ===\n');
    await sleep(1000);
    const final = await httpGet(`https://${BASE}/courts`);
    const finalOutdoor = final.filter(c => !c.indoor);
    const finalIndoor = final.filter(c => c.indoor);

    // Check for remaining duplicates
    const finalGroups = {};
    for (const c of finalOutdoor) {
        const key = c.name + '|' + c.city;
        if (!finalGroups[key]) finalGroups[key] = [];
        finalGroups[key].push(c);
    }
    const remainDupes = Object.entries(finalGroups).filter(([k, v]) => v.length > 1);

    console.log(`Total: ${final.length} | Indoor: ${finalIndoor.length} | Outdoor: ${finalOutdoor.length}`);
    console.log(`Remaining duplicates: ${remainDupes.length}`);
    if (remainDupes.length > 0) {
        for (const [key, courts] of remainDupes) {
            console.log(`  ⚠️ ${key}: ${courts.length} copies`);
        }
    }
    console.log(`Google API calls used: ${googleCalls}`);
    console.log('\n══════════════════════════════════════════════════');
    console.log('OUTDOOR CLEANUP COMPLETE');
    console.log('══════════════════════════════════════════════════\n');
}

main().catch(console.error);

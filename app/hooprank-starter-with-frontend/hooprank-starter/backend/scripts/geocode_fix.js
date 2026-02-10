/**
 * Bulk Geocoding Correction Script
 * Verifies and fixes all court coordinates using Google Maps Geocoding API
 * 
 * Usage: node scripts/geocode_fix.js [--dry-run] [--state CA] [--threshold 0.3]
 */
const https = require('https');
const crypto = require('crypto');

const GOOGLE_API_KEY = 'AIzaSyCbro8Tiei_T2NtLhN87e9o3N3p9x_A4NA';
const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const stateIdx = args.indexOf('--state');
const STATE_FILTER = stateIdx >= 0 ? args[stateIdx + 1] : null;
const threshIdx = args.indexOf('--threshold');
const THRESHOLD_KM = threshIdx >= 0 ? parseFloat(args[threshIdx + 1]) : 0.3; // 300m default

// ─── Helpers ───
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('JSON parse error')); }
            });
        }).on('error', reject);
    });
}

function httpPost(path) {
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

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

// ─── Google Geocoding ───
async function geocode(query) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
    const result = await httpGet(url);
    if (result.status === 'OK' && result.results && result.results.length > 0) {
        const loc = result.results[0].geometry.location;
        return { lat: loc.lat, lng: loc.lng, formatted: result.results[0].formatted_address };
    }
    return null;
}

// ─── Update court via admin/create (upserts) ───
async function updateCourt(court, newLat, newLng) {
    const id = generateUUID(court.name + court.city);
    const params = new URLSearchParams({
        id, name: court.name, city: court.city,
        lat: String(newLat), lng: String(newLng),
        indoor: 'true', access: court.access || 'public',
    });
    return httpPost(`/courts/admin/create?${params.toString()}`);
}

// ─── Main ───
async function main() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  BULK GEOCODING VERIFICATION & CORRECTION        ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will update)'}`);
    console.log(`State filter: ${STATE_FILTER || 'ALL'}`);
    console.log(`Threshold: ${THRESHOLD_KM} km (${Math.round(THRESHOLD_KM * 1000)}m)\n`);

    // 1. Fetch all courts
    console.log('Fetching all courts from API...');
    const courts = await httpGet(`https://${BASE}/courts`);
    console.log(`Total courts in DB: ${courts.length}`);

    // 2. Filter by state if specified
    let filtered = courts;
    if (STATE_FILTER) {
        filtered = courts.filter(c => c.city && c.city.endsWith(`, ${STATE_FILTER}`));
        console.log(`Courts in ${STATE_FILTER}: ${filtered.length}`);
    }

    // 3. Process each court
    let checked = 0, fixed = 0, failed = 0, skipped = 0, accurate = 0;
    const fixes = [];
    const failures = [];

    for (let i = 0; i < filtered.length; i++) {
        const court = filtered[i];
        checked++;

        // Build geocoding query: use court name + city
        const query = `${court.name}, ${court.city}`;

        try {
            const geo = await geocode(query);

            if (!geo) {
                // Try without "Gym" suffix if present
                const altName = court.name.replace(/ Gym$/, '').replace(/ Gymnasium$/, '');
                const geo2 = altName !== court.name ? await geocode(`${altName}, ${court.city}`) : null;

                if (!geo2) {
                    failures.push({ name: court.name, city: court.city, reason: 'NOT_FOUND' });
                    failed++;
                    process.stdout.write(`  ⚠️  [${i + 1}/${filtered.length}] ${court.name} — NOT FOUND\n`);
                    await sleep(100); // Rate limit
                    continue;
                }

                // Use alt result
                const dist = haversineKm(court.lat, court.lng, geo2.lat, geo2.lng);
                if (dist > THRESHOLD_KM) {
                    fixes.push({ name: court.name, city: court.city, oldLat: court.lat, oldLng: court.lng, newLat: geo2.lat, newLng: geo2.lng, dist, address: geo2.formatted });
                    if (!DRY_RUN) {
                        await updateCourt(court, geo2.lat, geo2.lng);
                    }
                    fixed++;
                    process.stdout.write(`  🔧 [${i + 1}/${filtered.length}] ${court.name} — ${dist.toFixed(2)}km off → FIXED (${geo2.formatted})\n`);
                } else {
                    accurate++;
                    if (i % 50 === 0) process.stdout.write(`  ✅ [${i + 1}/${filtered.length}] ${court.name} — OK (${dist.toFixed(2)}km)\n`);
                }
                await sleep(100);
                continue;
            }

            const dist = haversineKm(court.lat, court.lng, geo.lat, geo.lng);

            if (dist > THRESHOLD_KM) {
                fixes.push({ name: court.name, city: court.city, oldLat: court.lat, oldLng: court.lng, newLat: geo.lat, newLng: geo.lng, dist, address: geo.formatted });
                if (!DRY_RUN) {
                    await updateCourt(court, geo.lat, geo.lng);
                }
                fixed++;
                process.stdout.write(`  🔧 [${i + 1}/${filtered.length}] ${court.name} — ${dist.toFixed(2)}km off → ${DRY_RUN ? 'WOULD FIX' : 'FIXED'} (${geo.formatted})\n`);
            } else {
                accurate++;
                // Only print every 50th accurate one to reduce noise
                if (i % 50 === 0) process.stdout.write(`  ✅ [${i + 1}/${filtered.length}] ${court.name} — OK (${dist.toFixed(2)}km)\n`);
            }
        } catch (err) {
            failures.push({ name: court.name, city: court.city, reason: err.message });
            failed++;
            process.stdout.write(`  ❌ [${i + 1}/${filtered.length}] ${court.name} — ERROR: ${err.message}\n`);
        }

        // Rate limit: ~10 requests/sec (Google allows 50/sec but let's be safe)
        await sleep(100);
    }

    // 4. Summary
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`GEOCODING RESULTS`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`Checked:  ${checked}`);
    console.log(`Accurate: ${accurate} (within ${THRESHOLD_KM}km)`);
    console.log(`Fixed:    ${fixed} ${DRY_RUN ? '(would fix)' : '(updated)'}`);
    console.log(`Failed:   ${failed} (not found or error)`);
    console.log(`${'═'.repeat(60)}`);

    if (fixes.length > 0) {
        console.log('\n── FIXES APPLIED ──');
        for (const f of fixes) {
            console.log(`  ${f.name} (${f.city}): ${f.dist.toFixed(2)}km off`);
            console.log(`    Old: ${f.oldLat}, ${f.oldLng}`);
            console.log(`    New: ${f.newLat}, ${f.newLng} → ${f.address}`);
        }
    }

    if (failures.length > 0) {
        console.log('\n── FAILURES ──');
        for (const f of failures) {
            console.log(`  ${f.name} (${f.city}): ${f.reason}`);
        }
    }
}

main().catch(console.error);

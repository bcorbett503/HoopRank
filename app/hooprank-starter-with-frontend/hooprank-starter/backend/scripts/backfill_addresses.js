/**
 * Backfill addresses for all courts using Google Places API reverse geocoding.
 * 
 * Uses the Nearby Search to find the best matching place near each court's lat/lng,
 * then updates the court with its formatted address.
 * 
 * Processes in batches to stay within API rate limits.
 */
const https = require('https');

const GOOGLE_API_KEY = 'AIzaSyCbro8Tiei_T2NtLhN87e9o3N3p9x_A4NA';
const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { timeout: 30000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON parse error')); } });
        }).on('error', reject);
    });
}

function httpPostRailway(path) {
    return new Promise((resolve, reject) => {
        const options = { hostname: BASE, path, method: 'POST', headers: { 'x-user-id': USER_ID }, timeout: 10000 };
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

// Use Geocoding API (reverse geocode) — much cheaper than Places API
async function reverseGeocode(lat, lng) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
    const result = await httpGet(url);
    if (result.results && result.results.length > 0) {
        return result.results[0].formatted_address;
    }
    return null;
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║  ADDRESS BACKFILL                                    ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // Load all courts
    const courts = await httpGet(`https://${BASE}/courts`);

    // Filter to courts needing address backfill
    const needAddress = courts.filter(c => !c.address && c.lat && c.lng);
    const haveAddress = courts.filter(c => c.address);

    console.log(`Total courts: ${courts.length}`);
    console.log(`Already have address: ${haveAddress.length}`);
    console.log(`Need address: ${needAddress.length}\n`);

    if (needAddress.length === 0) {
        console.log('All courts already have addresses!');
        return;
    }

    let updated = 0, failed = 0;

    for (let i = 0; i < needAddress.length; i++) {
        const c = needAddress[i];
        try {
            const address = await reverseGeocode(c.lat, c.lng);

            if (address) {
                // Update court with address using the admin/create endpoint (upserts)
                const params = new URLSearchParams({
                    id: c.id,
                    name: c.name,
                    city: c.city || '',
                    lat: String(c.lat),
                    lng: String(c.lng),
                    indoor: String(c.indoor || false),
                    rims: String(c.rims || 2),
                    access: c.access || 'public',
                    address: address,
                });
                if (c.venue_type) params.set('venue_type', c.venue_type);

                await httpPostRailway(`/courts/admin/create?${params.toString()}`);
                updated++;

                if (updated % 50 === 0 || i < 5) {
                    console.log(`  [${i + 1}/${needAddress.length}] ✅ ${c.name}: ${address}`);
                }
            } else {
                failed++;
            }

            // Rate limit: ~10 requests/second
            await sleep(100);

            // Progress every 100
            if ((i + 1) % 100 === 0) {
                console.log(`  Progress: ${i + 1}/${needAddress.length} (${updated} updated, ${failed} failed)`);
            }
        } catch (err) {
            failed++;
            if (failed <= 5) console.log(`  ⚠️ ${c.name}: ${err.message}`);
        }
    }

    console.log(`\n=== RESULTS ===`);
    console.log(`Updated: ${updated}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total with address now: ${haveAddress.length + updated}`);
}

main().catch(console.error);

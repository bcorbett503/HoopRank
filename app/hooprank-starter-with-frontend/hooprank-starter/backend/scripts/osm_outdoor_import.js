/**
 * OpenStreetMap Outdoor Basketball Court Import
 * 
 * Uses the Overpass API to find ALL outdoor basketball courts tagged in OSM
 * across the United States, deduplicates against existing DB courts,
 * and imports new ones.
 */
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!GOOGLE_API_KEY) { console.error('❌ GOOGLE_API_KEY env var required'); process.exit(1); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpGet(url) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        const req = mod.get(url, { timeout: 120000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('Parse error: ' + data.substring(0, 200))); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('GET timeout')); });
    });
}

function httpPost(path) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: BASE, path, method: 'POST',
            headers: { 'x-user-id': USER_ID }, timeout: 15000,
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('POST timeout')); });
        req.end();
    });
}

function overpassQuery(query, retries = 3) {
    return new Promise((resolve, reject) => {
        const postData = `data=${encodeURIComponent(query)}`;
        const req = https.request({
            hostname: 'overpass-api.de',
            path: '/api/interpreter',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
            },
            timeout: 300000,
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 429 || res.statusCode === 504) {
                    if (retries > 0) {
                        console.log(`    Rate limited (${res.statusCode}), retrying in 30s...`);
                        setTimeout(() => overpassQuery(query, retries - 1).then(resolve).catch(reject), 30000);
                        return;
                    }
                }
                try { resolve(JSON.parse(data)); }
                catch (e) {
                    if (retries > 0 && data.includes('runtime error')) {
                        console.log(`    Overpass runtime error, retrying in 30s...`);
                        setTimeout(() => overpassQuery(query, retries - 1).then(resolve).catch(reject), 30000);
                        return;
                    }
                    reject(new Error('Overpass parse error: ' + data.substring(0, 200)));
                }
            });
        });
        req.on('error', (e) => {
            if (retries > 0) {
                console.log(`    Network error, retrying in 15s...`);
                setTimeout(() => overpassQuery(query, retries - 1).then(resolve).catch(reject), 15000);
                return;
            }
            reject(e);
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('Overpass timeout')); });
        req.write(postData);
        req.end();
    });
}

function reverseGeocode(lat, lng) {
    return new Promise((resolve, reject) => {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
        const req = https.get(url, { timeout: 10000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const j = JSON.parse(data);
                    if (j.results && j.results[0]) {
                        // Extract city, state from address components
                        const components = j.results[0].address_components;
                        let city = '', state = '', address = j.results[0].formatted_address;
                        for (const comp of components) {
                            if (comp.types.includes('locality')) city = comp.long_name;
                            if (comp.types.includes('sublocality_level_1') && !city) city = comp.long_name;
                            if (comp.types.includes('administrative_area_level_1')) state = comp.short_name;
                        }
                        resolve({ city: city ? `${city}, ${state}` : null, address, state });
                    } else { resolve(null); }
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

// Generate stable UUID from name+lat+lng
function makeId(name, lat, lng) {
    const hash = crypto.createHash('md5').update(`${name}|${lat}|${lng}`).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

// Haversine distance in meters
function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── STATE REGIONS (query separately to avoid Overpass timeout) ───
const REGIONS = [
    // West Coast (states we have indoor data for)
    { name: 'California', bbox: '32.5,-124.5,42.0,-114.0' },
    { name: 'Oregon', bbox: '41.9,-124.6,46.3,-116.4' },
    { name: 'Washington', bbox: '45.5,-124.8,49.0,-116.9' },
    // New England
    { name: 'Massachusetts', bbox: '41.2,-73.5,42.9,-69.9' },
    { name: 'New Hampshire', bbox: '42.7,-72.6,45.3,-70.7' },
    { name: 'Rhode Island', bbox: '41.1,-71.9,42.0,-71.1' },
    { name: 'Connecticut', bbox: '40.9,-73.7,42.1,-71.8' },
    // Texas
    { name: 'Texas', bbox: '25.8,-106.6,36.5,-93.5' },
    // Major metro states (expand coverage)
    { name: 'New York', bbox: '40.5,-79.8,45.0,-71.9' },
    { name: 'New Jersey', bbox: '38.9,-75.6,41.4,-73.9' },
    { name: 'Pennsylvania', bbox: '39.7,-80.5,42.3,-74.7' },
    { name: 'Illinois', bbox: '36.9,-91.5,42.5,-87.0' },
    { name: 'Michigan', bbox: '41.7,-90.4,48.3,-82.1' },
    { name: 'Ohio', bbox: '38.4,-84.8,42.0,-80.5' },
    { name: 'Florida', bbox: '24.4,-87.6,31.0,-80.0' },
    { name: 'Georgia', bbox: '30.3,-85.6,35.0,-80.8' },
    { name: 'North Carolina', bbox: '33.8,-84.3,36.6,-75.5' },
    { name: 'Virginia', bbox: '36.5,-83.7,39.5,-75.2' },
    { name: 'Maryland', bbox: '37.9,-79.5,39.7,-75.0' },
    { name: 'DC', bbox: '38.8,-77.1,39.0,-76.9' },
    { name: 'Colorado', bbox: '36.9,-109.1,41.0,-102.0' },
    { name: 'Arizona', bbox: '31.3,-114.8,37.0,-109.1' },
    { name: 'Minnesota', bbox: '43.5,-97.2,49.4,-89.5' },
    { name: 'Wisconsin', bbox: '42.5,-92.9,47.1,-86.8' },
    { name: 'Indiana', bbox: '37.8,-88.1,41.8,-84.8' },
    { name: 'Missouri', bbox: '35.9,-95.8,40.6,-89.1' },
    { name: 'Tennessee', bbox: '34.9,-90.3,36.7,-81.6' },
    { name: 'Louisiana', bbox: '28.9,-94.0,33.0,-89.0' },
    { name: 'Alabama', bbox: '30.2,-88.5,35.0,-84.9' },
    { name: 'South Carolina', bbox: '32.0,-83.4,35.2,-78.5' },
    { name: 'Kentucky', bbox: '36.5,-89.6,39.1,-81.9' },
    { name: 'Oklahoma', bbox: '33.6,-103.0,37.0,-94.4' },
    { name: 'Nevada', bbox: '35.0,-120.0,42.0,-114.0' },
    { name: 'Utah', bbox: '36.9,-114.1,42.0,-109.0' },
    { name: 'Iowa', bbox: '40.4,-96.6,43.5,-90.1' },
    { name: 'Kansas', bbox: '36.9,-102.1,40.0,-94.6' },
    { name: 'Arkansas', bbox: '33.0,-94.6,36.5,-89.6' },
    { name: 'Mississippi', bbox: '30.2,-91.7,35.0,-88.1' },
    { name: 'Nebraska', bbox: '39.9,-104.1,43.0,-95.3' },
    { name: 'Vermont', bbox: '42.7,-73.4,45.0,-71.5' },
    { name: 'Maine', bbox: '43.0,-71.1,47.5,-66.9' },
    { name: 'Delaware', bbox: '38.4,-75.8,39.8,-75.0' },
    { name: 'West Virginia', bbox: '37.2,-82.6,40.6,-77.7' },
    { name: 'Hawaii', bbox: '18.9,-160.3,22.2,-154.8' },
    { name: 'New Mexico', bbox: '31.3,-109.1,37.0,-103.0' },
    { name: 'Idaho', bbox: '42.0,-117.2,49.0,-111.0' },
    { name: 'Montana', bbox: '44.4,-116.1,49.0,-104.0' },
    { name: 'Wyoming', bbox: '41.0,-111.1,45.0,-104.1' },
    { name: 'North Dakota', bbox: '45.9,-104.1,49.0,-96.6' },
    { name: 'South Dakota', bbox: '42.5,-104.1,46.0,-96.4' },
    { name: 'Alaska', bbox: '51.0,-180.0,71.5,-130.0' },
];

async function main() {
    console.log('╔══════════════════════════════════════════════════════╗');
    console.log('║  OSM OUTDOOR BASKETBALL COURT IMPORT                 ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // Load existing courts for deduplication
    console.log('Loading existing courts...');
    let existingCourts;
    try {
        existingCourts = await httpGet(`https://${BASE}/courts`);
    } catch (e) {
        console.error('Failed to load existing courts:', e.message);
        process.exit(1);
    }
    console.log(`  Existing: ${existingCourts.length} (${existingCourts.filter(c => !c.indoor).length} outdoor)\n`);

    // ─── PHASE 1: Query Overpass for all US basketball courts ───
    console.log('═══ PHASE 1: OVERPASS QUERIES ═══\n');

    const allOSMCourts = [];
    let regionNum = 0;

    for (const region of REGIONS) {
        regionNum++;
        const query = `[out:json][timeout:180];
(
  nwr["sport"~"basketball"]["leisure"="pitch"](${region.bbox});
  nwr["sport"~"basketball"]["leisure"="park"](${region.bbox});
  nwr["sport"~"basketball"]["leisure"="sports_centre"](${region.bbox});
  nwr["sport"~"basketball"]["leisure"="playground"](${region.bbox});
);
out center;`;

        try {
            const result = await overpassQuery(query);
            const elements = result.elements || [];

            for (const el of elements) {
                const lat = el.lat || (el.center && el.center.lat);
                const lng = el.lon || (el.center && el.center.lon);
                if (!lat || !lng) continue;

                const name = el.tags?.name || el.tags?.description || null;
                allOSMCourts.push({
                    osmId: el.id,
                    osmType: el.type,
                    name,
                    lat: parseFloat(lat.toFixed(6)),
                    lng: parseFloat(lng.toFixed(6)),
                    access: el.tags?.access || 'public',
                    surface: el.tags?.surface || null,
                    hoops: el.tags?.hoops || null,
                    leisure: el.tags?.leisure || null,
                    lit: el.tags?.lit || null,
                    region: region.name, // Track which state/region this court is from
                });
            }
            console.log(`  [${regionNum}/${REGIONS.length}] ${region.name}: ${elements.length} courts (total: ${allOSMCourts.length})`);
        } catch (e) {
            console.log(`  [${regionNum}/${REGIONS.length}] ${region.name}: ERROR — ${e.message}`);
        }

        // Rate limit: Overpass asks for 1 request per 10 seconds for heavy queries
        if (regionNum < REGIONS.length) await sleep(5000);
    }

    console.log(`\n  Total OSM courts found: ${allOSMCourts.length}`);
    const named = allOSMCourts.filter(c => c.name);
    console.log(`  With names: ${named.length} | Without names: ${allOSMCourts.length - named.length}\n`);

    // ─── PHASE 2: Deduplicate against existing courts ───
    console.log('═══ PHASE 2: DEDUPLICATION ═══\n');

    const DUPE_THRESHOLD_M = 50; // Courts within 50m are considered duplicates
    let dupes = 0;
    const newCourts = [];

    for (const osm of allOSMCourts) {
        let isDupe = false;
        for (const existing of existingCourts) {
            if (!existing.lat || !existing.lng) continue;
            const dist = haversine(osm.lat, osm.lng, existing.lat, existing.lng);
            if (dist < DUPE_THRESHOLD_M) {
                isDupe = true;
                break;
            }
        }
        if (!isDupe) {
            // Also dedeup within OSM results (many overlapping nodes/ways)
            let internalDupe = false;
            for (const nc of newCourts) {
                if (haversine(osm.lat, osm.lng, nc.lat, nc.lng) < DUPE_THRESHOLD_M) {
                    internalDupe = true;
                    break;
                }
            }
            if (!internalDupe) newCourts.push(osm);
            else dupes++;
        } else {
            dupes++;
        }
    }

    console.log(`  Duplicates (existing DB): ${dupes - newCourts.length + newCourts.length}`);
    console.log(`  New unique courts: ${newCourts.length}\n`);

    if (newCourts.length === 0) {
        console.log('  No new courts to import. Done!');
        return;
    }

    // ─── PHASE 3: Import (skip geocoding — use OSM locations directly) ───
    console.log('═══ PHASE 3: IMPORTING (no geocoding — using OSM locations) ═══\n');

    // State abbreviation lookup
    const STATE_ABBR = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
        'Colorado': 'CO', 'Connecticut': 'CT', 'DC': 'DC', 'Delaware': 'DE', 'Florida': 'FL',
        'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN',
        'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME',
        'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
        'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE',
        'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM',
        'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
        'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI',
        'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX',
        'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
        'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
    };

    let imported = 0, importFailed = 0;
    for (let i = 0; i < newCourts.length; i++) {
        const c = newCourts[i];
        const stateAbbr = STATE_ABBR[c.region] || c.region;
        const courtName = c.name || `Basketball Court`;
        const cityField = `${c.region}, ${stateAbbr !== c.region ? stateAbbr : 'US'}`;
        const id = makeId(courtName, c.lat, c.lng);

        const params = new URLSearchParams({
            id,
            name: courtName,
            city: cityField,
            lat: String(c.lat),
            lng: String(c.lng),
            indoor: 'false',
            rims: c.hoops || '2',
            access: c.access === 'private' ? 'private' : 'public',
            source: 'osm',
            venue_type: 'outdoor',
        });

        try {
            const result = await httpPost('/courts/admin/create?' + params.toString());
            if (result.status < 300) imported++;
            else importFailed++;
        } catch (e) {
            importFailed++;
        }

        if ((i + 1) % 500 === 0) {
            console.log(`  Progress: ${i + 1}/${newCourts.length} (${imported} OK, ${importFailed} failed)`);
        }
    }
    console.log(`\n  Imported: ${imported} | Failed: ${importFailed}\n`);

    // ─── PHASE 4: Verification ───
    console.log('═══ PHASE 4: VERIFICATION ═══\n');

    try {
        const finalCourts = await httpGet(`https://${BASE}/courts`);
        const outdoor = finalCourts.filter(c => !c.indoor);
        const indoor = finalCourts.filter(c => c.indoor);

        console.log(`  Total DB: ${finalCourts.length}`);
        console.log(`  Indoor: ${indoor.length}`);
        console.log(`  Outdoor: ${outdoor.length}`);

        const stateCount = {};
        for (const c of outdoor) {
            const m = c.city && c.city.match(/, ([A-Z]{2})$/);
            if (m) stateCount[m[1]] = (stateCount[m[1]] || 0) + 1;
        }
        console.log('\n  Outdoor by state (top 20):');
        for (const [s, cnt] of Object.entries(stateCount).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
            console.log(`    ${s}: ${cnt}`);
        }
    } catch (e) {
        console.log('  Verification fetch failed:', e.message);
    }

    console.log('\n══════════════════════════════════════════════════');
    console.log('OSM OUTDOOR IMPORT COMPLETE');
    console.log('══════════════════════════════════════════════════');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

/**
 * Portland Metro School Gap-Fill
 * 
 * The initial broad discovery missed many schools because Google Places API
 * only returns 20 results per query. This script runs city-by-city queries
 * specifically targeting schools with gymnasiums, including:
 *   - Catholic / private / religious schools
 *   - Elementary, middle, and high schools per city
 *   - Charter and alternative schools
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
        const options = { hostname, path, method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, timeout: 15000 };
        const req = https.request(options, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); } }); });
        req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        if (body) req.write(JSON.stringify(body)); req.end();
    });
}

function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { timeout: 30000 }, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('JSON parse error')); } }); }).on('error', reject);
    });
}

function httpPostRailway(path) {
    return new Promise((resolve, reject) => {
        const options = { hostname: BASE, path, method: 'POST', headers: { 'x-user-id': USER_ID }, timeout: 10000 };
        const req = https.request(options, (res) => { let data = ''; res.on('data', chunk => data += chunk); res.on('end', () => resolve({ status: res.statusCode, data })); });
        req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); }); req.end();
    });
}

function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── CITY-BY-CITY SCHOOL QUERIES ─────────────────────────────────
// Each city gets multiple focused queries to find ALL schools
const CITIES = [
    // Portland proper - by area to get past the 20-result limit
    {
        city: 'Portland', state: 'OR', queries: [
            'elementary school Portland Oregon',
            'middle school Portland Oregon',
            'high school Portland Oregon',
            'Catholic school Portland Oregon',
            'private school Portland Oregon',
            'charter school Portland Oregon',
            'Christian school Portland Oregon',
            'Lutheran school Portland Oregon',
            'Montessori school Portland Oregon',
            'elementary school Northeast Portland Oregon',
            'elementary school Southeast Portland Oregon',
            'elementary school North Portland Oregon',
            'elementary school Southwest Portland Oregon',
            'middle school Northeast Portland Oregon',
            'middle school Southeast Portland Oregon',
            'school gymnasium inner NE Portland Oregon',
            'school gymnasium inner SE Portland Oregon',
        ]
    },
    // Major suburbs - each gets comprehensive school queries
    {
        city: 'Beaverton', state: 'OR', queries: [
            'elementary school Beaverton Oregon',
            'middle school Beaverton Oregon',
            'high school Beaverton Oregon',
            'Catholic school Beaverton Oregon',
            'private school Beaverton Oregon',
        ]
    },
    {
        city: 'Hillsboro', state: 'OR', queries: [
            'elementary school Hillsboro Oregon',
            'middle school Hillsboro Oregon',
            'high school Hillsboro Oregon',
            'Catholic school Hillsboro Oregon',
        ]
    },
    {
        city: 'Gresham', state: 'OR', queries: [
            'elementary school Gresham Oregon',
            'middle school Gresham Oregon',
            'high school Gresham Oregon',
        ]
    },
    {
        city: 'Lake Oswego', state: 'OR', queries: [
            'elementary school Lake Oswego Oregon',
            'middle school Lake Oswego Oregon',
            'high school Lake Oswego Oregon',
            'private school Lake Oswego Oregon',
        ]
    },
    {
        city: 'Tigard', state: 'OR', queries: [
            'elementary school Tigard Oregon',
            'middle school Tigard Oregon',
            'Catholic school Tigard Oregon',
        ]
    },
    {
        city: 'Tualatin', state: 'OR', queries: [
            'elementary school Tualatin Oregon',
            'school gymnasium Tualatin Oregon',
        ]
    },
    {
        city: 'West Linn', state: 'OR', queries: [
            'elementary school West Linn Oregon',
            'middle school West Linn Oregon',
        ]
    },
    {
        city: 'Oregon City', state: 'OR', queries: [
            'elementary school Oregon City Oregon',
            'middle school Oregon City Oregon',
            'high school Oregon City Oregon',
            'Catholic school Oregon City Oregon',
        ]
    },
    {
        city: 'Milwaukie', state: 'OR', queries: [
            'elementary school Milwaukie Oregon',
            'middle school Milwaukie Oregon',
            'high school Milwaukie Oregon',
        ]
    },
    {
        city: 'Sherwood', state: 'OR', queries: [
            'elementary school Sherwood Oregon',
            'middle school Sherwood Oregon',
        ]
    },
    {
        city: 'Wilsonville', state: 'OR', queries: [
            'school Wilsonville Oregon',
            'elementary school Wilsonville Oregon',
        ]
    },
    {
        city: 'Forest Grove', state: 'OR', queries: [
            'elementary school Forest Grove Oregon',
            'middle school Forest Grove Oregon',
        ]
    },
    {
        city: 'Newberg', state: 'OR', queries: [
            'elementary school Newberg Oregon',
            'middle school Newberg Oregon',
            'private school Newberg Oregon',
        ]
    },
    {
        city: 'Happy Valley', state: 'OR', queries: [
            'elementary school Happy Valley Oregon',
            'middle school Happy Valley Oregon',
            'school Happy Valley Clackamas Oregon',
        ]
    },
    {
        city: 'McMinnville', state: 'OR', queries: [
            'elementary school McMinnville Oregon',
            'middle school McMinnville Oregon',
            'Catholic school McMinnville Oregon',
        ]
    },
    {
        city: 'Canby', state: 'OR', queries: [
            'school Canby Oregon',
            'school gymnasium Canby Oregon',
        ]
    },
    {
        city: 'Sandy', state: 'OR', queries: [
            'school Sandy Oregon',
            'elementary school Sandy Oregon',
        ]
    },
    {
        city: 'Woodburn', state: 'OR', queries: [
            'school Woodburn Oregon',
            'Catholic school Woodburn Oregon',
        ]
    },
    {
        city: 'Estacada', state: 'OR', queries: [
            'school Estacada Oregon',
        ]
    },
    {
        city: 'Molalla', state: 'OR', queries: [
            'school Molalla Oregon',
            'elementary school Molalla Oregon',
        ]
    },
    {
        city: 'Gladstone', state: 'OR', queries: [
            'school Gladstone Oregon',
        ]
    },
    {
        city: 'Troutdale', state: 'OR', queries: [
            'school Troutdale Oregon',
            'elementary school Troutdale Oregon',
        ]
    },
    {
        city: 'Cornelius', state: 'OR', queries: [
            'school Cornelius Oregon',
        ]
    },
    {
        city: 'Damascus', state: 'OR', queries: [
            'school Damascus Oregon',
        ]
    },
    {
        city: 'Clackamas', state: 'OR', queries: [
            'school Clackamas Oregon',
            'elementary school Clackamas Oregon',
        ]
    },
    // Vancouver WA and Clark County
    {
        city: 'Vancouver', state: 'WA', queries: [
            'elementary school Vancouver Washington',
            'middle school Vancouver Washington',
            'high school Vancouver Washington',
            'Catholic school Vancouver Washington',
            'private school Vancouver Washington',
        ]
    },
    {
        city: 'Camas', state: 'WA', queries: [
            'school Camas Washington',
            'elementary school Camas Washington',
        ]
    },
    {
        city: 'Washougal', state: 'WA', queries: [
            'school Washougal Washington',
        ]
    },
    {
        city: 'Battle Ground', state: 'WA', queries: [
            'school Battle Ground Washington',
            'elementary school Battle Ground Washington',
        ]
    },
    {
        city: 'Ridgefield', state: 'WA', queries: [
            'school Ridgefield Washington',
        ]
    },
    // Additional suburbs
    {
        city: 'Aloha', state: 'OR', queries: [
            'school Aloha Oregon',
        ]
    },
    {
        city: 'Fairview', state: 'OR', queries: [
            'school Fairview Oregon',
        ]
    },
    {
        city: 'Wood Village', state: 'OR', queries: [
            'school Wood Village Oregon',
        ]
    },
];

const SKIP_PATTERNS = [
    /preschool/i, /pre-school/i, /daycare/i, /child care/i, /childcare/i,
    /pre-k/i, /prek/i, /headstart/i, /head start/i,
    /dance/i, /ballet/i, /music/i, /art school/i,
    /driving/i, /cooking/i, /language/i,
    /swim/i, /aquatic/i, /gymnastics/i,
    /district office/i, /school district$/i,
    /administration/i, /central office/i,
    /store/i, /shop/i, /supply/i,
    /tutoring/i, /learning center/i, /kumon/i,
    /sylvan/i, /mathnasium/i,
];

const SCHOOL_PATTERNS = [
    /elementary/i, /middle school/i, /high school/i,
    /school/i, /academy/i, /preparatory/i,
    /catholic/i, /christian/i, /lutheran/i, /baptist/i,
    /episcopal/i, /adventist/i, /montessori/i,
    /waldorf/i, /charter/i,
];

function isSchool(name, types) {
    for (const pat of SKIP_PATTERNS) {
        if (pat.test(name)) return false;
    }
    // Check Google types
    if (types.includes('school') || types.includes('primary_school') || types.includes('secondary_school')) return true;
    // Check name patterns
    for (const pat of SCHOOL_PATTERNS) {
        if (pat.test(name)) return true;
    }
    return false;
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
    console.log('║  PORTLAND METRO SCHOOL GAP-FILL                      ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // Load existing courts to check for dupes
    console.log('Loading existing courts...');
    const existingCourts = await httpGet(`https://${BASE}/courts`);
    const existingCoords = existingCourts.map(c => ({ lat: parseFloat(c.lat), lng: parseFloat(c.lng), name: c.name }));
    console.log(`  ${existingCourts.length} courts in database\n`);

    const discovered = new Map();
    let queriesRun = 0;
    let totalResults = 0;
    let skippedNotSchool = 0;
    let skippedDupe = 0;

    const totalQueries = CITIES.reduce((sum, c) => sum + c.queries.length, 0);
    console.log(`Running ${totalQueries} queries across ${CITIES.length} cities...\n`);

    for (const cityDef of CITIES) {
        for (const query of cityDef.queries) {
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

                    if (!isSchool(name, types)) {
                        skippedNotSchool++;
                        continue;
                    }

                    // Check against existing DB courts (within 100m)
                    let existsInDB = false;
                    for (const ec of existingCoords) {
                        if (ec.lat && ec.lng && haversineKm(lat, lng, ec.lat, ec.lng) < 0.1) {
                            existsInDB = true;
                            break;
                        }
                    }
                    if (existsInDB) {
                        skippedDupe++;
                        continue;
                    }

                    // Check against other discoveries (within 100m)
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

                if (queriesRun % 20 === 0) {
                    console.log(`  Queries: ${queriesRun}/${totalQueries} | New schools: ${discovered.size} | Already in DB: ${skippedDupe}`);
                }

                await sleep(200);
            } catch (err) {
                console.log(`  ⚠️ Query failed: "${query}" — ${err.message}`);
            }
        }
    }

    console.log(`\n  Total queries: ${queriesRun}`);
    console.log(`  Total results: ${totalResults}`);
    console.log(`  Skipped (not school): ${skippedNotSchool}`);
    console.log(`  Already in DB: ${skippedDupe}`);
    console.log(`  NEW schools found: ${discovered.size}\n`);

    // Import
    console.log('═══ IMPORTING NEW SCHOOLS ═══\n');

    let imported = 0;
    const venues = Array.from(discovered.values()).sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));

    for (const v of venues) {
        try {
            const id = generateUUID(v.name + v.city);
            const courtName = v.name.endsWith(' Gym') || v.name.endsWith(' Gymnasium')
                ? v.name : v.name + ' Gym';

            const params = new URLSearchParams({
                id, name: courtName, city: v.city,
                lat: String(v.lat), lng: String(v.lng),
                indoor: 'true', rims: '2', access: 'public',
            });
            await httpPostRailway(`/courts/admin/create?${params.toString()}`);
            imported++;
            console.log(`  ✅ ${courtName} (${v.city})`);
        } catch (err) {
            console.log(`  ❌ ${v.name}: ${err.message}`);
        }
        if (imported % 20 === 0) await sleep(100);
    }

    // Classify all as school
    console.log('\n═══ CLASSIFYING ═══\n');
    await sleep(1000);
    // Reclassify all schools that don't have a venue_type yet
    const schoolPatterns = [
        '%Elementary%', '%Middle School%', '%High School%',
        '%School Gym%', '%School Gymnasium%', '%Academy%',
        '%Preparatory%', '%Catholic%School%', '%Catholic%Gym%',
        '%Christian%School%', '%Christian%Gym%',
        '%Lutheran%School%', '%Lutheran%Gym%',
        '%Baptist%School%', '%Baptist%Gym%',
        '%Adventist%School%', '%Adventist%Gym%',
        '%Montessori%', '%Waldorf%', '%Charter%',
        '%Saint%School%', '%Saint%Gym%',
        '%St.%School%', '%St.%Gym%',
    ];
    for (const pat of schoolPatterns) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=school&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }

    // Final counts
    console.log('═══ VERIFICATION ═══\n');
    await sleep(2000);
    const finalCourts = await httpGet(`https://${BASE}/courts`);
    const pdxCities = [
        'Portland', 'Beaverton', 'Hillsboro', 'Gresham', 'Lake Oswego', 'Tigard',
        'Tualatin', 'West Linn', 'Oregon City', 'Milwaukie', 'Clackamas', 'Wilsonville',
        'Sherwood', 'Happy Valley', 'Troutdale', 'Fairview', 'Gladstone',
        'Forest Grove', 'Cornelius', 'Newberg', 'Canby', 'Sandy', 'McMinnville',
        'Aloha', 'Damascus', 'Woodburn', 'Estacada', 'Molalla',
        'Vancouver', 'Camas', 'Washougal', 'Battle Ground', 'Ridgefield',
    ];
    const pdxIndoor = finalCourts.filter(c =>
        c.indoor && c.city && pdxCities.some(city => c.city.startsWith(city + ','))
    );

    const vtDist = {};
    for (const c of pdxIndoor) { vtDist[c.venue_type || '?'] = (vtDist[c.venue_type || '?'] || 0) + 1; }

    const schools = pdxIndoor.filter(c => c.venue_type === 'school');
    const byCitySchools = {};
    for (const c of schools) { if (!byCitySchools[c.city]) byCitySchools[c.city] = []; byCitySchools[c.city].push(c); }

    console.log(`Portland Metro Indoor: ${pdxIndoor.length} courts (was 334)`);
    console.log(`\nVenue types:`);
    for (const [type, count] of Object.entries(vtDist).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${type}: ${count}`);
    }

    console.log(`\nSchools by city:`);
    for (const [city, cts] of Object.entries(byCitySchools).sort((a, b) => b[1].length - a[1].length)) {
        console.log(`  ${city}: ${cts.length}`);
    }

    // Spot check specific schools
    console.log('\n═══ SPOT CHECKS ═══');
    const check = (name) => {
        const matches = pdxIndoor.filter(c => c.name.toLowerCase().includes(name.toLowerCase()));
        console.log(`  "${name}": ${matches.length > 0 ? matches.map(c => `${c.name} (${c.city})`).join('; ') : 'NOT FOUND'}`);
    };
    check('Kraxberger');
    check('Saint John');
    check('St. John');
    check('Catholic');
    check('La Salle');
    check('Jesuit');
    check('Central Catholic');
    check('De La Salle');

    console.log(`\nTotal DB: ${finalCourts.length}`);
    console.log('\n══════════════════════════════════════════════════');
    console.log('SCHOOL GAP-FILL COMPLETE');
    console.log('══════════════════════════════════════════════════\n');
}

main().catch(console.error);

/**
 * Bay Area School Gap-Fill
 * 
 * Runs city-by-city school queries across all 9 Bay Area counties to find
 * schools missed by the initial broad discovery. Same approach that found
 * 475 new schools in Portland metro.
 *
 * Counties: Marin, San Francisco, Alameda, Contra Costa, San Mateo,
 *           Santa Clara, Sonoma, Napa, Solano
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
const CITIES = [
    // ─── MARIN COUNTY ────────────────────────────────────────────
    {
        city: 'San Rafael', state: 'CA', queries: [
            'elementary school San Rafael California',
            'middle school San Rafael California',
            'high school San Rafael California',
            'Catholic school San Rafael California',
            'private school San Rafael California',
        ]
    },
    {
        city: 'Novato', state: 'CA', queries: [
            'elementary school Novato California',
            'middle school Novato California',
            'high school Novato California',
            'private school Novato California',
        ]
    },
    {
        city: 'Mill Valley', state: 'CA', queries: [
            'school Mill Valley California',
            'elementary school Mill Valley California',
        ]
    },
    {
        city: 'San Anselmo', state: 'CA', queries: [
            'school San Anselmo Fairfax California',
        ]
    },
    {
        city: 'Tiburon', state: 'CA', queries: [
            'school Tiburon Belvedere California',
        ]
    },
    {
        city: 'Larkspur', state: 'CA', queries: [
            'school Larkspur Corte Madera California',
        ]
    },
    {
        city: 'Sausalito', state: 'CA', queries: [
            'school Sausalito California',
        ]
    },

    // ─── SAN FRANCISCO ───────────────────────────────────────────
    {
        city: 'San Francisco', state: 'CA', queries: [
            'elementary school San Francisco California',
            'middle school San Francisco California',
            'high school San Francisco California',
            'Catholic school San Francisco California',
            'private school San Francisco California',
            'charter school San Francisco California',
            'Christian school San Francisco California',
            'elementary school Mission District San Francisco',
            'elementary school Sunset District San Francisco',
            'elementary school Richmond District San Francisco',
            'elementary school Bayview San Francisco',
            'middle school SFUSD San Francisco',
            'school gymnasium Excelsior San Francisco',
            'school gymnasium Visitacion Valley San Francisco',
        ]
    },

    // ─── ALAMEDA COUNTY ──────────────────────────────────────────
    {
        city: 'Oakland', state: 'CA', queries: [
            'elementary school Oakland California',
            'middle school Oakland California',
            'high school Oakland California',
            'Catholic school Oakland California',
            'charter school Oakland California',
            'private school Oakland California',
            'elementary school East Oakland California',
            'elementary school West Oakland California',
        ]
    },
    {
        city: 'Berkeley', state: 'CA', queries: [
            'elementary school Berkeley California',
            'middle school Berkeley California',
            'high school Berkeley California',
            'private school Berkeley California',
        ]
    },
    {
        city: 'Fremont', state: 'CA', queries: [
            'elementary school Fremont California',
            'middle school Fremont California',
            'high school Fremont California',
            'private school Fremont California',
        ]
    },
    {
        city: 'Hayward', state: 'CA', queries: [
            'elementary school Hayward California',
            'middle school Hayward California',
            'high school Hayward California',
        ]
    },
    {
        city: 'San Leandro', state: 'CA', queries: [
            'elementary school San Leandro California',
            'middle school San Leandro California',
            'high school San Leandro California',
        ]
    },
    {
        city: 'Alameda', state: 'CA', queries: [
            'school Alameda California',
            'elementary school Alameda California',
        ]
    },
    {
        city: 'Union City', state: 'CA', queries: [
            'school Union City California',
        ]
    },
    {
        city: 'Newark', state: 'CA', queries: [
            'school Newark California',
        ]
    },
    {
        city: 'Pleasanton', state: 'CA', queries: [
            'elementary school Pleasanton California',
            'middle school Pleasanton California',
            'high school Pleasanton California',
        ]
    },
    {
        city: 'Livermore', state: 'CA', queries: [
            'elementary school Livermore California',
            'middle school Livermore California',
            'high school Livermore California',
        ]
    },
    {
        city: 'Dublin', state: 'CA', queries: [
            'school Dublin California',
            'elementary school Dublin California',
        ]
    },
    {
        city: 'Emeryville', state: 'CA', queries: [
            'school Emeryville California',
        ]
    },
    {
        city: 'Albany', state: 'CA', queries: [
            'school Albany California',
        ]
    },
    {
        city: 'El Cerrito', state: 'CA', queries: [
            'school El Cerrito California',
        ]
    },

    // ─── CONTRA COSTA COUNTY ─────────────────────────────────────
    {
        city: 'Concord', state: 'CA', queries: [
            'elementary school Concord California',
            'middle school Concord California',
            'high school Concord California',
        ]
    },
    {
        city: 'Walnut Creek', state: 'CA', queries: [
            'elementary school Walnut Creek California',
            'middle school Walnut Creek California',
            'high school Walnut Creek California',
            'private school Walnut Creek California',
        ]
    },
    {
        city: 'Richmond', state: 'CA', queries: [
            'elementary school Richmond California',
            'middle school Richmond California',
            'high school Richmond California',
        ]
    },
    {
        city: 'Antioch', state: 'CA', queries: [
            'elementary school Antioch California',
            'middle school Antioch California',
            'high school Antioch California',
        ]
    },
    {
        city: 'Pittsburg', state: 'CA', queries: [
            'school Pittsburg California',
            'elementary school Pittsburg California',
        ]
    },
    {
        city: 'San Ramon', state: 'CA', queries: [
            'elementary school San Ramon California',
            'middle school San Ramon California',
            'high school San Ramon California',
        ]
    },
    {
        city: 'Danville', state: 'CA', queries: [
            'school Danville California',
            'elementary school Danville California',
        ]
    },
    {
        city: 'Martinez', state: 'CA', queries: [
            'school Martinez California',
        ]
    },
    {
        city: 'Pleasant Hill', state: 'CA', queries: [
            'school Pleasant Hill California',
        ]
    },
    {
        city: 'Brentwood', state: 'CA', queries: [
            'school Brentwood California',
            'elementary school Brentwood California',
        ]
    },
    {
        city: 'Hercules', state: 'CA', queries: [
            'school Hercules Pinole Rodeo California',
        ]
    },
    {
        city: 'Lafayette', state: 'CA', queries: [
            'school Lafayette California',
        ]
    },
    {
        city: 'Orinda', state: 'CA', queries: [
            'school Orinda Moraga California',
        ]
    },

    // ─── SAN MATEO COUNTY ────────────────────────────────────────
    {
        city: 'San Mateo', state: 'CA', queries: [
            'elementary school San Mateo California',
            'middle school San Mateo California',
            'high school San Mateo California',
            'Catholic school San Mateo California',
        ]
    },
    {
        city: 'Redwood City', state: 'CA', queries: [
            'elementary school Redwood City California',
            'middle school Redwood City California',
            'high school Redwood City California',
        ]
    },
    {
        city: 'Daly City', state: 'CA', queries: [
            'school Daly City California',
            'elementary school Daly City California',
        ]
    },
    {
        city: 'South San Francisco', state: 'CA', queries: [
            'school South San Francisco California',
        ]
    },
    {
        city: 'San Bruno', state: 'CA', queries: [
            'school San Bruno California',
        ]
    },
    {
        city: 'Burlingame', state: 'CA', queries: [
            'school Burlingame California',
        ]
    },
    {
        city: 'San Carlos', state: 'CA', queries: [
            'school San Carlos California',
        ]
    },
    {
        city: 'Menlo Park', state: 'CA', queries: [
            'school Menlo Park Atherton California',
            'private school Menlo Park California',
        ]
    },
    {
        city: 'Foster City', state: 'CA', queries: [
            'school Foster City Belmont California',
        ]
    },
    {
        city: 'Pacifica', state: 'CA', queries: [
            'school Pacifica California',
        ]
    },
    {
        city: 'Half Moon Bay', state: 'CA', queries: [
            'school Half Moon Bay California',
        ]
    },

    // ─── SANTA CLARA COUNTY ──────────────────────────────────────
    {
        city: 'San Jose', state: 'CA', queries: [
            'elementary school San Jose California',
            'middle school San Jose California',
            'high school San Jose California',
            'Catholic school San Jose California',
            'private school San Jose California',
            'charter school San Jose California',
            'elementary school East San Jose California',
            'elementary school South San Jose California',
            'elementary school West San Jose California',
            'middle school Evergreen San Jose California',
        ]
    },
    {
        city: 'Sunnyvale', state: 'CA', queries: [
            'elementary school Sunnyvale California',
            'middle school Sunnyvale California',
            'high school Sunnyvale California',
        ]
    },
    {
        city: 'Santa Clara', state: 'CA', queries: [
            'school Santa Clara California',
            'elementary school Santa Clara California',
        ]
    },
    {
        city: 'Mountain View', state: 'CA', queries: [
            'school Mountain View California',
            'elementary school Mountain View California',
        ]
    },
    {
        city: 'Palo Alto', state: 'CA', queries: [
            'school Palo Alto California',
            'elementary school Palo Alto California',
            'private school Palo Alto California',
        ]
    },
    {
        city: 'Milpitas', state: 'CA', queries: [
            'school Milpitas California',
            'elementary school Milpitas California',
        ]
    },
    {
        city: 'Cupertino', state: 'CA', queries: [
            'school Cupertino California',
            'elementary school Cupertino California',
        ]
    },
    {
        city: 'Campbell', state: 'CA', queries: [
            'school Campbell California',
        ]
    },
    {
        city: 'Los Gatos', state: 'CA', queries: [
            'school Los Gatos California',
        ]
    },
    {
        city: 'Saratoga', state: 'CA', queries: [
            'school Saratoga California',
        ]
    },
    {
        city: 'Morgan Hill', state: 'CA', queries: [
            'school Morgan Hill California',
            'elementary school Morgan Hill California',
        ]
    },
    {
        city: 'Gilroy', state: 'CA', queries: [
            'school Gilroy California',
            'elementary school Gilroy California',
        ]
    },

    // ─── SONOMA COUNTY ───────────────────────────────────────────
    {
        city: 'Santa Rosa', state: 'CA', queries: [
            'elementary school Santa Rosa California',
            'middle school Santa Rosa California',
            'high school Santa Rosa California',
            'Catholic school Santa Rosa California',
        ]
    },
    {
        city: 'Petaluma', state: 'CA', queries: [
            'school Petaluma California',
            'elementary school Petaluma California',
        ]
    },
    {
        city: 'Rohnert Park', state: 'CA', queries: [
            'school Rohnert Park Cotati California',
        ]
    },
    {
        city: 'Windsor', state: 'CA', queries: [
            'school Windsor California',
        ]
    },
    {
        city: 'Healdsburg', state: 'CA', queries: [
            'school Healdsburg California',
        ]
    },
    {
        city: 'Sebastopol', state: 'CA', queries: [
            'school Sebastopol California',
        ]
    },
    {
        city: 'Sonoma', state: 'CA', queries: [
            'school Sonoma California',
        ]
    },

    // ─── NAPA COUNTY ─────────────────────────────────────────────
    {
        city: 'Napa', state: 'CA', queries: [
            'elementary school Napa California',
            'middle school Napa California',
            'high school Napa California',
            'Catholic school Napa California',
        ]
    },
    {
        city: 'American Canyon', state: 'CA', queries: [
            'school American Canyon California',
        ]
    },

    // ─── SOLANO COUNTY ───────────────────────────────────────────
    {
        city: 'Vallejo', state: 'CA', queries: [
            'elementary school Vallejo California',
            'middle school Vallejo California',
            'high school Vallejo California',
        ]
    },
    {
        city: 'Fairfield', state: 'CA', queries: [
            'elementary school Fairfield California',
            'middle school Fairfield California',
            'high school Fairfield California',
        ]
    },
    {
        city: 'Vacaville', state: 'CA', queries: [
            'elementary school Vacaville California',
            'middle school Vacaville California',
            'high school Vacaville California',
        ]
    },
    {
        city: 'Benicia', state: 'CA', queries: [
            'school Benicia California',
        ]
    },
    {
        city: 'Suisun City', state: 'CA', queries: [
            'school Suisun City California',
        ]
    },
    {
        city: 'Dixon', state: 'CA', queries: [
            'school Dixon California',
        ]
    },
];

const SKIP_PATTERNS = [
    /preschool/i, /pre-school/i, /daycare/i, /child care/i, /childcare/i,
    /pre-k/i, /prek/i, /headstart/i, /head start/i,
    /dance/i, /ballet/i, /music school/i,
    /driving/i, /cooking/i, /language school/i,
    /swim/i, /aquatic/i, /gymnastics/i,
    /district office/i, /school district$/i,
    /administration/i, /central office/i,
    /store/i, /shop/i, /supply/i,
    /tutoring/i, /learning center/i, /kumon/i,
    /sylvan/i, /mathnasium/i,
    /little gym/i, /my gym/i, /goddard school/i,
    /pharmacies?/i, /salon/i, /kitchen/i,
    /transport/i, /football field/i, /performing arts/i,
    /fire dept/i, /fire station/i,
];

const SCHOOL_PATTERNS = [
    /elementary/i, /middle school/i, /high school/i,
    /school/i, /academy/i, /preparatory/i,
    /catholic/i, /christian/i, /lutheran/i, /baptist/i,
    /episcopal/i, /adventist/i, /montessori/i,
    /waldorf/i, /charter/i,
];

function isSchool(name, types) {
    for (const pat of SKIP_PATTERNS) { if (pat.test(name)) return false; }
    if (types.includes('school') || types.includes('primary_school') || types.includes('secondary_school')) return true;
    for (const pat of SCHOOL_PATTERNS) { if (pat.test(name)) return true; }
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
    console.log('║  BAY AREA SCHOOL GAP-FILL                            ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // Load existing courts for dedup
    console.log('Loading existing courts...');
    const existingCourts = await httpGet(`https://${BASE}/courts`);
    const existingCoords = existingCourts.map(c => ({ lat: parseFloat(c.lat), lng: parseFloat(c.lng), name: c.name }));
    const existingBA = existingCourts.filter(c => c.indoor && c.city?.endsWith(', CA'));
    console.log(`  ${existingCourts.length} total | Bay Area indoor CA: ${existingBA.length}\n`);

    const discovered = new Map();
    let queriesRun = 0, totalResults = 0, skippedNotSchool = 0, skippedDupe = 0;
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

                    if (!isSchool(name, types)) { skippedNotSchool++; continue; }

                    // Check existing DB
                    let existsInDB = false;
                    for (const ec of existingCoords) {
                        if (ec.lat && ec.lng && haversineKm(lat, lng, ec.lat, ec.lng) < 0.1) {
                            existsInDB = true; break;
                        }
                    }
                    if (existsInDB) { skippedDupe++; continue; }

                    // Check other discoveries
                    let isDupe = false;
                    for (const [key, existing] of discovered) {
                        if (haversineKm(lat, lng, existing.lat, existing.lng) < 0.1) {
                            isDupe = true; break;
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
    console.log(`  NEW schools: ${discovered.size}\n`);

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
        if (imported % 30 === 0) await sleep(100);
    }

    console.log(`\n  Imported: ${imported}\n`);

    // Classify
    console.log('═══ CLASSIFYING ═══\n');
    await sleep(1000);
    const schoolPats = [
        '%Elementary%', '%Middle School%', '%High School%',
        '%School Gym%', '%School Gymnasium%', '%Academy Gym%',
        '%Preparatory%', '%Catholic%', '%Christian%',
        '%Lutheran%', '%Baptist%', '%Adventist%',
        '%Montessori%', '%Waldorf%', '%Charter%',
        '%Saint%', '%St.%',
    ];
    for (const pat of schoolPats) {
        await httpPostRailway(`/courts/admin/update-venue-type?venue_type=school&name_pattern=${encodeURIComponent(pat)}&indoor=true`);
    }

    // Verification
    console.log('═══ VERIFICATION ═══\n');
    await sleep(2000);
    const finalCourts = await httpGet(`https://${BASE}/courts`);
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
        'Morgan Hill', 'Gilroy',
        'San Mateo', 'Redwood City', 'Daly City', 'San Bruno', 'South San Francisco',
        'Belmont', 'Foster City', 'Half Moon Bay', 'Pacifica', 'Burlingame',
        'San Carlos', 'Menlo Park', 'Atherton',
        'Santa Rosa', 'Petaluma', 'Napa', 'Rohnert Park', 'Windsor',
        'Healdsburg', 'Sebastopol', 'Sonoma', 'American Canyon',
        'Fairfield', 'Vallejo', 'Vacaville', 'Suisun City', 'Dixon',
        'Benicia',
    ];

    const baIndoor = finalCourts.filter(c =>
        c.indoor && c.city && bayAreaCities.some(city => c.city.startsWith(city + ','))
    );

    const vtDist = {};
    for (const c of baIndoor) { vtDist[c.venue_type || '?'] = (vtDist[c.venue_type || '?'] || 0) + 1; }

    console.log(`Bay Area Indoor: ${baIndoor.length} (was ${existingBA.length})`);
    console.log('\nVenue types:');
    for (const [t, count] of Object.entries(vtDist).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${t}: ${count}`);
    }

    // By county
    const counties = {
        'Marin': ['San Rafael', 'Novato', 'Mill Valley', 'San Anselmo', 'Fairfax', 'Kentfield', 'Tiburon', 'Larkspur', 'Ross', 'Sausalito', 'Corte Madera'],
        'SF': ['San Francisco'],
        'Alameda': ['Oakland', 'Berkeley', 'Fremont', 'Hayward', 'San Leandro', 'Alameda', 'Union City', 'Newark', 'Pleasanton', 'Livermore', 'Dublin', 'Emeryville', 'Albany', 'El Cerrito'],
        'Contra Costa': ['Concord', 'Walnut Creek', 'Richmond', 'Antioch', 'Pittsburg', 'San Ramon', 'Danville', 'Martinez', 'Pleasant Hill', 'Brentwood', 'Hercules', 'Pinole', 'Lafayette', 'Orinda', 'Moraga'],
        'San Mateo': ['San Mateo', 'Redwood City', 'Daly City', 'San Bruno', 'South San Francisco', 'Belmont', 'Foster City', 'Half Moon Bay', 'Pacifica', 'Burlingame', 'San Carlos', 'Menlo Park', 'Atherton'],
        'Santa Clara': ['San Jose', 'Palo Alto', 'Mountain View', 'Sunnyvale', 'Santa Clara', 'Milpitas', 'Campbell', 'Los Gatos', 'Cupertino', 'Saratoga', 'Morgan Hill', 'Gilroy'],
        'Sonoma': ['Santa Rosa', 'Petaluma', 'Rohnert Park', 'Windsor', 'Healdsburg', 'Sebastopol', 'Sonoma'],
        'Napa': ['Napa', 'American Canyon'],
        'Solano': ['Vallejo', 'Fairfield', 'Vacaville', 'Suisun City', 'Dixon', 'Benicia'],
    };

    console.log('\nBy county:');
    for (const [county, cities] of Object.entries(counties)) {
        const count = baIndoor.filter(c => cities.some(city => c.city.startsWith(city + ','))).length;
        console.log(`  ${county}: ${count}`);
    }

    console.log(`\nTotal DB: ${finalCourts.length}`);
    console.log('\n══════════════════════════════════════════════════');
    console.log('BAY AREA SCHOOL GAP-FILL COMPLETE');
    console.log('══════════════════════════════════════════════════\n');
}

main().catch(console.error);

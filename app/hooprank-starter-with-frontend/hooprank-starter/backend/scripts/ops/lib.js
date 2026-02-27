#!/usr/bin/env node
/**
 * ops/lib.js — Shared helpers for court discovery & run seeding
 *
 * Used by discover_courts.js and seed_runs.js.
 * No standalone execution — import with require().
 */

const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════════
//  Constants
// ═══════════════════════════════════════════════════════════════════

const BASE = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const BASE_HOST = 'heartfelt-appreciation-production-65f1.up.railway.app';
const BRETT_ID = 'Nb6UhM5ExOeUMWIRMeaxswVnLQl2';
const DAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const STATE_NAMES = { NY: 'New York', IL: 'Illinois', FL: 'Florida', PA: 'Pennsylvania', OH: 'Ohio', MI: 'Michigan', GA: 'Georgia', NC: 'North Carolina', NJ: 'New Jersey', VA: 'Virginia', IN: 'Indiana', TN: 'Tennessee', MD: 'Maryland', MO: 'Missouri', WI: 'Wisconsin', MN: 'Minnesota', AL: 'Alabama', SC: 'South Carolina', LA: 'Louisiana', KY: 'Kentucky', CO: 'Colorado', AZ: 'Arizona', CT: 'Connecticut', OK: 'Oklahoma', MS: 'Mississippi', NV: 'Nevada', KS: 'Kansas', IA: 'Iowa', UT: 'Utah', NE: 'Nebraska', NM: 'New Mexico', WV: 'West Virginia', HI: 'Hawaii', DC: 'District of Columbia', DE: 'Delaware', ME: 'Maine', VT: 'Vermont', ID: 'Idaho', MT: 'Montana', WY: 'Wyoming', ND: 'North Dakota', SD: 'South Dakota', AK: 'Alaska', CA: 'California', TX: 'Texas', WA: 'Washington', OR: 'Oregon' };

// ═══════════════════════════════════════════════════════════════════
//  Utility
// ═══════════════════════════════════════════════════════════════════

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Automatically fetch a Firebase token via a temporary local server */
async function getTokenInteractive() {
    const http = require('http');
    const { exec } = require('child_process');
    const fs = require('fs');
    const path = require('path');

    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            if (req.url === '/') {
                const htmlPath = path.join(__dirname, '../../get_token.html');
                const html = fs.readFileSync(htmlPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);
            } else if (req.url === '/callback' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk.toString());
                req.on('end', () => {
                    res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
                    res.end('OK');
                    server.close();
                    resolve(body);
                });
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        server.on('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                console.log('⚠️  Port 8888 is in use (another server running?). Please kill it or run with TOKEN=...');
                reject(e);
            }
        });

        server.listen(8888, () => {
            console.log('\n🏀 Launching browser for Firebase authentication...');
            console.log('   (If it does not open, navigate to http://localhost:8888)');
            const url = 'http://localhost:8888';
            const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
            exec(`${cmd} ${url}`);
        });
    });
}

/** Extract user_id from Firebase JWT to prevent auth mismatches */
function getUserIdFromToken(token) {
    if (!token || token === 'dry') return BRETT_ID;
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        return payload.user_id || payload.sub || BRETT_ID;
    } catch (e) {
        return BRETT_ID;
    }
}

/** Deterministic UUID from name+city (used by discovery pipeline) */
function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ═══════════════════════════════════════════════════════════════════
//  Date helpers
// ═══════════════════════════════════════════════════════════════════

/**
 * Get the next N weeks of dates for a given day of the week, anchored to the target timezone.
 * Uses luxon to accurately calculate absolute UTC coordinates corresponding to the local market time.
 */
function getNextOccurrences(dayOfWeek, hour, minute, weeks = 4, timezone = 'America/New_York') {
    const { DateTime } = require('luxon');
    const dates = [];
    const now = DateTime.utc();

    // Start processing from today or a few days ago
    let startLocal = DateTime.now().setZone(timezone).startOf('day');

    for (let w = 0; w < weeks; w++) {
        for (let d = 0; d < 7; d++) {
            let candidateLocal = startLocal.plus({ days: (w * 7) + d });
            // JS dayOfWeek: 0=Sun, 1=Mon. Luxon: 1=Mon, 7=Sun
            let luxonDay = dayOfWeek === 0 ? 7 : dayOfWeek;

            if (candidateLocal.weekday === luxonDay) {
                // Set the exact local hour and minute in that specific timezone
                candidateLocal = candidateLocal.set({ hour, minute });
                const jsDate = candidateLocal.toJSDate();
                if (jsDate > now.toJSDate()) dates.push(jsDate);
            }
        }
    }
    return dates;
}

// ═══════════════════════════════════════════════════════════════════
//  API wrappers
// ═══════════════════════════════════════════════════════════════════

/**
 * Create a court via admin API.
 * Supports both Bearer token and x-user-id auth.
 */
async function createCourt(court, token) {
    // 1. Check if the court already exists by exact name/city
    const userId = token ? getUserIdFromToken(token) : BRETT_ID;
    const headers = { 'x-user-id': userId };
    if (token && token !== 'dry') headers['Authorization'] = `Bearer ${token}`;
    if (process.env.ADMIN_SECRET) headers['x-admin-secret'] = process.env.ADMIN_SECRET;

    const searchRes = await fetch(`${BASE}/courts?minLat=${court.lat - 0.01}&maxLat=${court.lat + 0.01}&minLng=${court.lng - 0.01}&maxLng=${court.lng + 0.01}`, { headers });
    if (searchRes.ok) {
        const nearCourts = await searchRes.json();
        const existing = nearCourts.find(c => c.name === court.name && c.city === court.city);
        if (existing) {
            console.log(`\n    [Lib] Found existing court: ${existing.name} -> ID: ${existing.id}`);
            return { id: existing.id, result: existing };
        }
    }

    const id = court.id || crypto.randomUUID();
    const qs = new URLSearchParams({
        id,
        name: court.name,
        city: court.city,
        lat: String(court.lat),
        lng: String(court.lng),
        indoor: String(court.indoor !== false),
        access: court.access || 'public',
        venue_type: court.venue_type || '',
        address: court.address || '',
    });
    if (token && token !== 'dry') headers['Authorization'] = `Bearer ${token}`;
    if (process.env.ADMIN_SECRET) headers['x-admin-secret'] = process.env.ADMIN_SECRET;

    const res = await fetch(`${BASE}/courts/admin/create?${qs}`, {
        method: 'POST',
        headers,
    });
    const result = await res.json();
    if (!res.ok) {
        throw new Error(result.message || 'Server error: ' + res.status);
    }
    return { id: result.court?.id || result.id || id, result };
}

/**
 * Seed a single run occurrence.
 */
async function seedRun(body, token) {
    const userId = token ? getUserIdFromToken(token) : BRETT_ID;
    const headers = {
        'Content-Type': 'application/json',
        'x-user-id': userId,
    };
    if (token && token !== 'dry') headers['Authorization'] = `Bearer ${token}`;
    if (process.env.ADMIN_SECRET) headers['x-admin-secret'] = process.env.ADMIN_SECRET;

    const res = await fetch(`${BASE}/runs`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    return res.json();
}

// ═══════════════════════════════════════════════════════════════════
//  Google Places Discovery — Filters
// ═══════════════════════════════════════════════════════════════════

const SKIP = [/gymnastics/i, /gym ?world/i, /parkour/i, /yoga/i, /pilates/i, /boxing/i, /martial/i, /karate/i, /jiu.?jitsu/i, /taekwondo/i, /kung fu/i, /swim/i, /aquatic/i, /pool/i, /dance/i, /ballet/i, /spin/i, /climbing/i, /boulder/i, /trampoline/i, /cheer/i, /golf/i, /tennis only/i, /racquet/i, /pickleball/i, /badminton/i, /volleyball(?! .*basketball)/i, /supply/i, /store/i, /shop/i, /equipment/i, /camp(?:s|ing)?\b/i, /athletic department/i, /physical therapy/i, /rehab/i, /chiropract/i, /preschool(?! gym)/i, /daycare/i, /child care/i, /childcare/i, /dog\s/i, /pet\s/i, /veterinar/i, /salon/i, /beauty/i, /nail/i, /barber/i, /nursing/i, /dental/i, /medical/i, /pharmacy/i, /skating rink/i, /ice rink/i, /hockey rink/i, /crossfit(?! .*basketball)/i, /rowing/i, /crew house/i, /boathouse/i, /church(?!.*gym)/i, /mosque/i, /temple/i, /synagogue(?!.*gym)/i, /spa\b/i, /tattoo/i];
const KEEP = [/school/i, /elementary/i, /middle school/i, /high school/i, /gymnasium/i, /gym\b/i, /recreation/i, /community center/i, /ymca/i, /ywca/i, /jcc/i, /boys.*girls.*club/i, /basketball/i, /fitness/i, /athletic/i, /sports/i, /university/i, /college/i, /academy/i, /24 hour/i, /life time/i, /la fitness/i, /planet fitness/i, /gold'?s? gym/i, /bay club/i, /equinox/i];

function shouldInclude(name, types) {
    for (const p of SKIP) if (p.test(name)) return false;
    for (const p of KEEP) if (p.test(name)) return true;
    if ((types || []).some(t => ['gym', 'school', 'university', 'community_center', 'sports_complex', 'health', 'stadium'].some(bt => t.includes(bt)))) return true;
    return false;
}

/**
 * Search Google Places API (New) for a text query.
 * @param {string} query - Text search query
 * @param {string} apiKey - Google API key
 * @returns {Promise<Array>} Array of place results
 */
async function discoverPlaces(query, apiKey) {
    const body = JSON.stringify({ textQuery: query, maxResultCount: 20 });
    const res = await fetch(
        'https://places.googleapis.com/v1/places:searchText',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask':
                    'places.displayName,places.formattedAddress,places.location,places.types',
            },
            body,
        },
    );
    const result = await res.json();
    return result.places || [];
}

/**
 * Lookup a single venue by name via Google Places API.
 * Returns the first matching result.
 */
async function lookupVenue(name, apiKey) {
    const places = await discoverPlaces(name, apiKey);
    if (!places.length) return null;
    const p = places[0];
    const loc = p.location || {};
    return {
        name: p.displayName?.text || name,
        address: p.formattedAddress || '',
        lat: loc.latitude,
        lng: loc.longitude,
        types: p.types || [],
    };
}

// ═══════════════════════════════════════════════════════════════════
//  Address / City parsing
// ═══════════════════════════════════════════════════════════════════

/** Extract "City, ST" from a formatted Google address */
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

/** Infer venue_type from name */
function inferVenueType(name) {
    const n = name.toLowerCase();
    if (/elementary|middle school|high school|prep school|junior high|academy|montessori/i.test(n)) return 'school';
    if (/college|university/i.test(n)) return 'college';
    if (/ymca|ywca|jcc|community center|recreation|rec center|boys.*girls.*club|parks/i.test(n)) return 'rec_center';
    if (/church/i.test(n)) return 'church';
    return 'gym';
}

// ═══════════════════════════════════════════════════════════════════
//  Backend helpers (for 4-phase pipeline)
// ═══════════════════════════════════════════════════════════════════

/** Simple GET returning parsed JSON */
async function httpGet(url) {
    const res = await fetch(url);
    return res.json();
}

/** POST to Railway admin endpoint (no body, uses query params) */
async function adminPost(path) {
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'x-user-id': BRETT_ID },
    });
    let data;
    try { data = await res.json(); } catch { data = { status: res.status }; }
    return data;
}

/** Run Phase 3 classification rules against indoor courts */
async function classifyVenues(state) {
    const schoolPatterns = ['%Elementary%', '%Middle School%', '%High School%', '%Prep School%', '%School Gym%', '%School Gymnasium%', '%Junior High%', '%Academy%', '%Montessori%'];
    const collegePatterns = ['%College%', '%University%'];
    const recPatterns = ['%YMCA%', '%YWCA%', '%JCC%', '%Community Center%', '%Recreation%', '%Rec Center%', '%Boys%Girls%Club%', '%Parks%'];
    const gymPatterns = ['%24 Hour%', '%Life Time%', '%LA Fitness%', '%Planet Fitness%', '%Fitness%', '%Athletic Club%', '%Gold%Gym%', '%Health Club%', '%Training%', '%Sport%'];

    for (const p of schoolPatterns)
        await adminPost(`/courts/admin/update-venue-type?venue_type=school&name_pattern=${encodeURIComponent(p)}&indoor=true`);
    for (const p of collegePatterns)
        await adminPost(`/courts/admin/update-venue-type?venue_type=college&name_pattern=${encodeURIComponent(p)}&indoor=true`);
    for (const p of recPatterns)
        await adminPost(`/courts/admin/update-venue-type?venue_type=rec_center&name_pattern=${encodeURIComponent(p)}&indoor=true`);
    for (const p of gymPatterns)
        await adminPost(`/courts/admin/update-venue-type?venue_type=gym&name_pattern=${encodeURIComponent(p)}&indoor=true`);
}

// ═══════════════════════════════════════════════════════════════════
//  Exports
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    BASE,
    BASE_HOST,
    BRETT_ID,
    DAY,
    STATE_NAMES,
    sleep,
    getTokenInteractive,
    generateUUID,
    haversineKm,
    getNextOccurrences,
    createCourt,
    seedRun,
    shouldInclude,
    discoverPlaces,
    lookupVenue,
    extractCity,
    inferVenueType,
    httpGet,
    adminPost,
    classifyVenues,
};

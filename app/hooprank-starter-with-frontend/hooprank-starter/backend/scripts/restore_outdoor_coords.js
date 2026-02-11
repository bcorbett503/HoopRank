/**
 * Restore Outdoor Court Coordinates v2
 * 
 * Strategy: For each of the 55 outdoor courts, find the closest matching 
 * court in the seed data within the SAME CITY. If no city match, use 
 * Google Geocoding API as fallback.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GOOGLE_API_KEY = 'AIzaSyCbro8Tiei_T2NtLhN87e9o3N3p9x_A4NA';
const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

function httpGet(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { timeout: 15000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('JSON parse error')); }
            });
        }).on('error', reject);
    });
}

function httpPost(path_str) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: BASE, path: path_str, method: 'POST',
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

function normalize(s) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function geocode(query) {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
    const result = await httpGet(url);
    if (result.status === 'OK' && result.results && result.results.length > 0) {
        const loc = result.results[0].geometry.location;
        return { lat: loc.lat, lng: loc.lng, formatted: result.results[0].formatted_address };
    }
    return null;
}

async function updateCourt(court, newLat, newLng) {
    const id = generateUUID(court.name + court.city);
    const params = new URLSearchParams({
        id, name: court.name, city: court.city,
        lat: String(newLat), lng: String(newLng),
        indoor: 'false', access: court.access || 'public',
    });
    return httpPost(`/courts/admin/create?${params.toString()}`);
}

async function main() {
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║  RESTORE OUTDOOR COORDS v2 (City + Google)      ║');
    console.log('╚══════════════════════════════════════════════════╝\n');

    // 1. Load seed data
    const seedPath = path.join(__dirname, '..', 'src', 'courts-us-popular-expanded.json');
    const seeds = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
    const outdoorSeeds = seeds.filter(s => !s.indoor);
    console.log(`Loaded ${outdoorSeeds.length} outdoor seed courts\n`);

    // Index seeds by normalized city
    const seedsByCity = new Map();
    for (const s of outdoorSeeds) {
        const city = normalize(s.city || '');
        if (!seedsByCity.has(city)) seedsByCity.set(city, []);
        seedsByCity.get(city).push(s);
    }

    // 2. Fetch current outdoor courts
    const courts = await httpGet(`https://${BASE}/courts`);
    const outdoor = courts.filter(c => !c.indoor);
    console.log(`Current outdoor courts: ${outdoor.length}\n`);

    let googleCalls = 0;
    let restored = 0, googleFixed = 0, failed = 0;

    for (const court of outdoor) {
        const courtCity = normalize(court.city || '');
        const courtName = normalize(court.name || '');

        // Strategy 1: Find best match in seed data by city + name similarity
        let bestMatch = null;
        let bestScore = 0;

        const cityCourts = seedsByCity.get(courtCity) || [];
        for (const s of cityCourts) {
            const seedName = normalize(s.name || '');
            // Simple name similarity: count matching characters
            let matches = 0;
            const shorter = courtName.length < seedName.length ? courtName : seedName;
            const longer = courtName.length >= seedName.length ? courtName : seedName;
            for (let i = 0; i < shorter.length; i++) {
                if (longer.includes(shorter.substring(i, i + 3))) matches++;
            }
            const score = matches / shorter.length;
            if (score > bestScore && score > 0.5) {
                bestScore = score;
                bestMatch = s;
            }
        }

        if (bestMatch) {
            const dist = haversineKm(court.lat, court.lng, bestMatch.lat, bestMatch.lng);
            if (dist > 0.01) {
                await updateCourt(court, bestMatch.lat, bestMatch.lng);
                console.log(`  ✅ ${court.name} → seed match "${bestMatch.name}" (${dist.toFixed(2)}km corrected)`);
            } else {
                console.log(`  ✅ ${court.name} — already accurate`);
            }
            restored++;
            continue;
        }

        // Strategy 2: Google Geocoding as fallback
        console.log(`  🔍 No seed match for "${court.name}" — trying Google...`);
        const geo = await geocode(`${court.name}, ${court.city}`);
        googleCalls++;

        if (geo) {
            const dist = haversineKm(court.lat, court.lng, geo.lat, geo.lng);
            await updateCourt(court, geo.lat, geo.lng);
            console.log(`  🔧 ${court.name} → Google: ${geo.formatted} (${dist.toFixed(2)}km corrected)`);
            googleFixed++;
        } else {
            // Try without "Courts" suffix
            const altName = court.name.replace(/ Courts$/, '').replace(/ Court$/, '');
            const geo2 = await geocode(`${altName}, ${court.city}`);
            googleCalls++;

            if (geo2) {
                await updateCourt(court, geo2.lat, geo2.lng);
                console.log(`  🔧 ${court.name} → Google (alt): ${geo2.formatted}`);
                googleFixed++;
            } else {
                console.log(`  ❌ ${court.name} — no match found`);
                failed++;
            }
        }

        await sleep(100); // Rate limit
    }

    console.log(`\n${'═'.repeat(50)}`);
    console.log('OUTDOOR RESTORE RESULTS');
    console.log(`${'═'.repeat(50)}`);
    console.log(`Total outdoor: ${outdoor.length}`);
    console.log(`Restored from seed: ${restored}`);
    console.log(`Fixed via Google: ${googleFixed} (${googleCalls} API calls used)`);
    console.log(`Failed: ${failed}`);
    console.log(`${'═'.repeat(50)}\n`);
}

main().catch(console.error);

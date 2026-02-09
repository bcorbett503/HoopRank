/**
 * Court Data Quality Fixes — Batch 1 (NYC + issues found)
 * Based on Google Maps verification
 */
const https = require('https');
const crypto = require('crypto');
const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const UID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

function uuid(n) { const h = crypto.createHash('md5').update(n).digest('hex'); return h.substr(0, 8) + '-' + h.substr(8, 4) + '-' + h.substr(12, 4) + '-' + h.substr(16, 4) + '-' + h.substr(20, 12); }

function upsert(court) {
    return new Promise((resolve, reject) => {
        const id = uuid(court.name + court.city);
        const p = new URLSearchParams({ id, name: court.name, city: court.city, lat: String(court.lat), lng: String(court.lng), indoor: String(court.indoor !== false), access: court.access || 'public' });
        const opts = { hostname: BASE, path: '/courts/admin/create?' + p.toString(), method: 'POST', headers: { 'x-user-id': UID }, timeout: 10000 };
        const req = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ s: res.statusCode })); });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
    });
}

function del(name, city) {
    return new Promise((resolve, reject) => {
        const id = uuid(name + city);
        const p = new URLSearchParams({ id });
        const opts = { hostname: BASE, path: '/courts/admin/delete?' + p.toString(), method: 'POST', headers: { 'x-user-id': UID }, timeout: 10000 };
        const req = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ s: res.statusCode })); });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.end();
    });
}

async function main() {
    console.log('=== COURT DATA QUALITY FIXES ===\n');

    // ---- NYC FIXES ----
    console.log('📍 NYC Fixes:');

    // 1. Remove Asser Levy (outdoor only, no indoor basketball)
    try { await del('Asser Levy Recreation Center', 'New York, NY'); console.log('  🗑️  Removed Asser Levy Recreation Center (outdoor only)'); }
    catch (e) { console.log('  ❌ Asser Levy: ' + e.message); }

    // 2. Remove Hamilton Fish (outdoor only)
    try { await del('Hamilton Fish Recreation Center', 'New York, NY'); console.log('  🗑️  Removed Hamilton Fish Recreation Center (outdoor only)'); }
    catch (e) { console.log('  ❌ Hamilton Fish: ' + e.message); }

    // 3. Remove Tony Dapolito (permanently closed)
    try { await del('Tony Dapolito Recreation Center', 'New York, NY'); console.log('  🗑️  Removed Tony Dapolito Recreation Center (permanently closed)'); }
    catch (e) { console.log('  ❌ Tony Dapolito: ' + e.message); }

    // 4. Fix Hansborough coords (verified: 40.8122, -73.9424)
    try { await upsert({ name: 'Hansborough Recreation Center', city: 'New York, NY', lat: 40.8122, lng: -73.9424, access: 'public' }); console.log('  ✏️  Fixed Hansborough coords → 40.8122, -73.9424'); }
    catch (e) { console.log('  ❌ Hansborough: ' + e.message); }

    // 5. Fix Harlem YMCA coords (verified: 40.8141, -73.9421)
    try { await upsert({ name: 'Harlem YMCA', city: 'New York, NY', lat: 40.8141, lng: -73.9421, access: 'members' }); console.log('  ✏️  Fixed Harlem YMCA coords → 40.8141, -73.9421'); }
    catch (e) { console.log('  ❌ Harlem YMCA: ' + e.message); }

    // 6. Fix Equinox Sports Club NYC (should be 160 Columbus Ave, not Hudson Yards)
    try { await upsert({ name: 'Equinox Sports Club NYC', city: 'New York, NY', lat: 40.7725, lng: -73.9818, access: 'members' }); console.log('  ✏️  Fixed Equinox Sports Club → 160 Columbus Ave (40.7725, -73.9818)'); }
    catch (e) { console.log('  ❌ Equinox: ' + e.message); }

    // 7. Add Basketball City (Pier 36) — major missing facility
    try { await upsert({ name: 'Basketball City (Pier 36)', city: 'New York, NY', lat: 40.7101, lng: -73.9852, access: 'members' }); console.log('  ➕ Added Basketball City (Pier 36)'); }
    catch (e) { console.log('  ❌ Basketball City: ' + e.message); }

    console.log('\nDone!');
}
main();

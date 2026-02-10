const https = require('https');
const crypto = require('crypto');
const BASE = 'heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

function generateUUID(name) {
    const hash = crypto.createHash('md5').update(name).digest('hex');
    return `${hash.substr(0, 8)}-${hash.substr(8, 4)}-${hash.substr(12, 4)}-${hash.substr(16, 4)}-${hash.substr(20, 12)}`;
}

function postCourt(court) {
    return new Promise((resolve, reject) => {
        const id = generateUUID(court.name + court.city);
        const params = new URLSearchParams({
            id, name: court.name, city: court.city,
            lat: String(court.lat), lng: String(court.lng),
            indoor: 'true', access: court.access || 'public',
        });
        const options = {
            hostname: BASE, path: `/courts/admin/create?${params.toString()}`,
            method: 'POST', headers: { 'x-user-id': USER_ID }, timeout: 10000,
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

async function runImport(label, courts) {
    console.log(`\n=== ${label}: ${courts.length} COURTS ===\n`);
    let ok = 0, fail = 0;
    for (const c of courts) {
        try {
            const r = await postCourt(c);
            console.log(`  ✅ ${c.name} (${c.city})`);
            ok++;
        } catch (err) {
            console.log(`  ❌ ${c.name}: ${err.message}`);
            fail++;
        }
    }
    console.log(`\n→ ${ok} ok, ${fail} failed out of ${courts.length}\n`);
    return { ok, fail };
}

module.exports = { generateUUID, postCourt, runImport };

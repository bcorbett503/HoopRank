const https = require('https');

const BASE_URL = 'heartfelt-appreciation-production-65f1.up.railway.app';
const ADMIN_SECRET = 'wXz9rB5vQ8p2L6nK4m7J1gH3sD0fA2e9';

function request(method, path) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: BASE_URL,
            port: 443,
            path: path,
            method,
            headers: {
                'x-user-id': '4ODZUrySRUhFDC5wVW6dCySBprD2',
                'x-admin-secret': ADMIN_SECRET,
            },
        }, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(data); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    console.log("Memory Array Deduplication sweep initialized.");

    // SF Bounds
    const qs = new URLSearchParams({
        minLat: 37.75, maxLat: 37.81,
        minLng: -122.51, maxLng: -122.38
    });

    const courts = await request('GET', `/courts?${qs}`);
    if (!Array.isArray(courts)) {
        console.error("Failed to load courts:", courts);
        return;
    }

    let wiped = 0;
    console.log(`Scanning ${courts.length} active venues...`);

    for (const c of courts) {
        const runs = await request('GET', `/courts/${c.id}/runs`);
        if (!Array.isArray(runs)) continue;

        // Group master templates by identity
        const templates = runs.filter(r => r.isRecurring === true);
        const map = {};

        for (const t of templates) {
            const key = `${t.title}_${t.gameMode}`;
            if (!map[key]) map[key] = [];
            map[key].push(t.id);
        }

        // Obliterate clones
        for (const [key, ids] of Object.entries(map)) {
            if (ids.length > 1) {
                const redundant = ids.slice(1);
                for (const kill of redundant) {
                    console.log(`[${c.name}] Deleting duplicate template: ${key} (${kill})`);
                    await request('DELETE', `/runs/${kill}`);
                    wiped++;
                }
            }
        }
    }

    console.log(`Sweep complete. Successfully erased ${wiped} duplicate templates.`);
}

run().catch(console.error);

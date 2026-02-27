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
                'x-user-id': 'admin-user',
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
    console.log("Fetching all live courts from production...");
    const allCourts = await request('GET', '/courts');
    if (!Array.isArray(allCourts)) {
        console.error("Failed to fetch absolute court list", allCourts);
        return;
    }

    console.log(`Successfully retrieved ${allCourts.length} courts. Grouping for duplicates...`);

    const courtMap = new Map();
    for (const c of allCourts) {
        // Skip user-created courts maybe? No, duplicates are mostly seeded
        const key = `${c.name}::${c.city}`.toLowerCase();
        if (courtMap.has(key)) {
            courtMap.get(key).push(c);
        } else {
            courtMap.set(key, [c]);
        }
    }

    const duplicates = [];
    for (const [key, courts] of courtMap.entries()) {
        if (courts.length > 1) {
            duplicates.push(courts[0]); // store the reference
        }
    }

    if (duplicates.length === 0) {
        console.log("✅ No duplicate courts discovered!");
        return;
    }

    console.log(`Found ${duplicates.length} overlapping duplicate clusters. Initiating mass purge...`);

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    let totalDeleted = 0;
    for (const d of duplicates) {
        const qs = new URLSearchParams({ name: d.name, city: d.city });
        const res = await request('POST', `/courts/admin/delete?${qs}`);
        if (res && res.success) {
            console.log(`  ✓ Purged overlapping clusters for: ${d.name} in ${d.city} (${res.deleted} ghost courts removed)`);
            totalDeleted += res.deleted || 0;
        } else {
            console.error(`  ✗ Failed to purge: ${d.name} ->`, res);
        }
        await sleep(300); // 300ms delay to avoid 429 Throttle
    }

    console.log(`\n✅ Database Court Deduplication Complete! Wiped ${totalDeleted} identical geographic structures.`);
}

run().catch(console.error);

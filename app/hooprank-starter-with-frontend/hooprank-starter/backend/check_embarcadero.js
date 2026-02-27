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
    console.log("Fetching duplicated templates globally...");
    const dups = await request('GET', '/cleanup/find-duplicates');

    if (!dups || !dups.success) {
        console.error("Failed to fetch duplicates:", dups);
        return;
    }

    const { duplicateRuns } = dups;
    if (!duplicateRuns || duplicateRuns.length === 0) {
        console.log("✅ Zero duplicate master templates found.");
        return;
    }

    console.log(`Found ${duplicateRuns.length} overlapping templates.`);
    for (const group of duplicateRuns) {
        // Keep the first ID, delete the rest
        const toDelete = group.ids.slice(1);
        for (const runId of toDelete) {
            console.log(`Erasing redundant template: ${runId}`);
            await request('DELETE', `/runs/${runId}`);
        }
    }
    console.log("Sweep complete.");
}

run().catch(console.error);

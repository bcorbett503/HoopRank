const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3000;
const ADMIN_SECRET = 'wXz9rB5vQ8p2L6nK4m7J1gH3sD0fA2e9';
const BRETT_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

function request(method, path) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: BASE_URL,
            port: PORT,
            path: path,
            method,
            headers: {
                'x-user-id': BRETT_ID,
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
    console.log("Fetching courts...");
    const courts = await request('GET', '/runs/courts-with-runs');
    if (!Array.isArray(courts)) {
        console.error("Failed to fetch courts", courts);
        return;
    }

    let totalDeleted = 0;
    console.log(`Found ${courts.length} active courts with runs. Parsing runs...`);

    for (const court of courts) {
        const runs = await request('GET', `/courts/${court.courtId}/runs`);
        if (!Array.isArray(runs)) continue;

        // Filter strictly for System (Seeded) runs
        const seededRuns = runs.filter(r => r.createdBy === BRETT_ID);

        for (const runData of seededRuns) {
            await request('DELETE', `/runs/${runData.id}`);
            totalDeleted++;
            process.stdout.write(`\rDeleted ${totalDeleted} seeded template sequences...`);
        }
    }
    console.log(`\n✅ Database Purge Complete! Cleaned ${totalDeleted} runs.`);
}

run().catch(console.error);

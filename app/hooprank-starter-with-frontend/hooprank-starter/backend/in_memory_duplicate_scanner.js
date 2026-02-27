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
    console.log("Fetching all active courts...");
    const allCourtsRes = await request('GET', '/runs/courts-with-runs'); // Wait, we need all courts. Let's hit the main feed or search endpoint.
    // Actually, getting all courts is tricky without a direct endpoint. 
    // We can use the 'courts-with-runs' to find duplicate courts among those that currently have runs
    const courtsWithRuns = allCourtsRes;

    // Check for duplicate courts by Name
    let courtMap = new Map();
    let duplicateCourts = [];

    for (const c of courtsWithRuns) {
        const nameKey = (c.courtName || c.name || "Unknown").toLowerCase().trim();
        if (courtMap.has(nameKey)) {
            courtMap.get(nameKey).push(c);
        } else {
            courtMap.set(nameKey, [c]);
        }
    }

    for (const [name, courts] of courtMap.entries()) {
        if (courts.length > 1) {
            duplicateCourts.push({ name, count: courts.length, ids: courts.map(c => c.courtId) });
        }
    }

    console.log('\n=== DUPLICATE COURTS (By Name) ===');
    console.table(duplicateCourts);

    console.log(`\nAnalyzing ${courtsWithRuns.length} courts for duplicate active runs...`);
    const runMap = new Map();
    const activeDuplicateRuns = [];

    for (const c of courtsWithRuns) {
        const runs = await request('GET', `/courts/${c.courtId}/runs`);
        if (!Array.isArray(runs)) continue;

        for (const run of runs) {
            // Include ALL runs (templates AND spawned occurrences)
            const scheduledString = run.scheduledAt ? new Date(run.scheduledAt).getTime() : 'NoTime';
            const signature = `${run.courtId}_${run.title}_${scheduledString}`;

            if (runMap.has(signature)) {
                runMap.get(signature).push(run);
            } else {
                runMap.set(signature, [run]);
            }
        }
    }

    for (const [key, similarRuns] of runMap.entries()) {
        if (similarRuns.length > 1) {
            activeDuplicateRuns.push({
                signature: key,
                count: similarRuns.length,
                ids: similarRuns.map(r => r.id),
                title: similarRuns[0].title,
                time: similarRuns[0].scheduledAt,
                isTemplate: similarRuns[0].isRecurringTemplate
            });
        }
    }

    console.log('\n=== DUPLICATE CONCRETE RUNS (Overlapping Time) ===');
    console.table(activeDuplicateRuns.slice(0, 30)); // only show up to 30 to avoid blowing up the terminal
    console.log(`Total overlapping concrete run clusters found: ${activeDuplicateRuns.length}`);
}

run().catch(console.error);

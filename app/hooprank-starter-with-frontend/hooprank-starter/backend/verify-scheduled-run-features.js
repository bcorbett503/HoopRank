// ============================================================================
// HoopRank — Scheduled Run Features Verification
// Tests: player tagging, tag modes, RSVP cap, capacity enforcement
// Run: node verify-scheduled-run-features.js
// ============================================================================

const https = require('https');

const PROD_URL = 'heartfelt-appreciation-production-65f1.up.railway.app';
const TEST_USER = 'DKmjcFcw0AaqVefnJDuzPe1hY5r2'; // John Apple
const TEST_USER_2 = 'test-user-2-verify';  // Second user for capacity test

function request(method, path, data = null, userId = TEST_USER) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: PROD_URL,
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': userId,
            },
            timeout: 15000
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body || '{}') });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

let testNum = 0;
const results = [];

async function test(name, fn) {
    testNum++;
    const label = `${String(testNum).padStart(2, ' ')}. ${name}`;
    try {
        const { pass, detail } = await fn();
        const icon = pass ? '✅' : '❌';
        console.log(`   ${icon} ${label}`);
        if (detail) console.log(`      ${detail}`);
        results.push({ name, pass });
    } catch (e) {
        console.log(`   ❌ ${label}`);
        console.log(`      ERROR: ${e.message}`);
        results.push({ name, pass: false });
    }
}

async function run() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   Scheduled Run Features — Targeted Verification       ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    // First, ensure migration ran
    console.log('\n━━━ Migration ━━━');
    await test('POST /runs/migrate — ensure new columns exist', async () => {
        const res = await request('POST', '/runs/migrate');
        return {
            pass: res.status === 200 || res.status === 201,
            detail: `Response: ${JSON.stringify(res.data).slice(0, 100)}`
        };
    });

    // Get a court to use for tests
    const courtRes = await request('GET', '/courts?limit=1');
    const courtId = courtRes.data?.[0]?.id;
    if (!courtId) {
        console.log('   ❌ No courts found — cannot proceed');
        return;
    }
    console.log(`   ℹ️  Using court: ${courtRes.data[0].name} (${courtId})`);

    // ========== Feature 1 & 2: Create run with tagging ==========
    console.log('\n━━━ Feature 1 & 2: Player Tagging + Tag Modes ━━━');

    let createdRunId = null;

    await test('POST /runs — create run with tagMode=all (no taggedPlayerIds)', async () => {
        const scheduledAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 hrs from now
        const res = await request('POST', '/runs', {
            courtId,
            scheduledAt,
            title: 'Tag Test — All mode',
            gameMode: '3v3',
            maxPlayers: 3,
            tagMode: 'all',
        });
        createdRunId = res.data?.id || res.data?.run?.id;
        return {
            pass: res.data?.success === true && createdRunId != null,
            detail: `Created run ${createdRunId} | tagMode=all`
        };
    });

    // Verify the run has tagMode set
    await test('GET /courts/:id/runs — verify tagMode in response', async () => {
        const res = await request('GET', `/courts/${courtId}/runs`);
        const runs = Array.isArray(res.data) ? res.data : [];
        const tagRun = runs.find(r => r.id === createdRunId);
        return {
            pass: tagRun != null && tagRun.tagMode === 'all',
            detail: tagRun
                ? `tagMode=${tagRun.tagMode} | taggedPlayerIds=${tagRun.taggedPlayerIds || 'null'}`
                : 'Run not found in court runs response'
        };
    });

    // Create run with individual tagging
    let taggedRunId = null;
    await test('POST /runs — create run with tagMode=individual + taggedPlayerIds', async () => {
        const scheduledAt = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
        const res = await request('POST', '/runs', {
            courtId,
            scheduledAt,
            title: 'Tag Test — Individual mode',
            gameMode: '5v5',
            maxPlayers: 3,
            tagMode: 'individual',
            taggedPlayerIds: ['player-abc', 'player-def'],
        });
        taggedRunId = res.data?.id || res.data?.run?.id;
        return {
            pass: res.data?.success === true && taggedRunId != null,
            detail: `Created run ${taggedRunId} | tagMode=individual | tagged 2 players`
        };
    });

    // Verify tagged player IDs are returned
    await test('GET /courts/:id/runs — verify taggedPlayerIds in response', async () => {
        const res = await request('GET', `/courts/${courtId}/runs`);
        const runs = Array.isArray(res.data) ? res.data : [];
        const tagRun = runs.find(r => r.id === taggedRunId);
        if (!tagRun) return { pass: false, detail: 'Tagged run not found' };
        const ids = typeof tagRun.taggedPlayerIds === 'string'
            ? JSON.parse(tagRun.taggedPlayerIds)
            : tagRun.taggedPlayerIds;
        const hasIds = Array.isArray(ids) && ids.length === 2;
        return {
            pass: tagRun.tagMode === 'individual' && hasIds,
            detail: `tagMode=${tagRun.tagMode} | taggedPlayerIds=${JSON.stringify(ids)}`
        };
    });

    // ========== Feature 3: RSVP Cap ==========
    console.log('\n━━━ Feature 3: RSVP Cap Enforcement ━━━');

    // The first run (createdRunId) has maxPlayers=3 and creator auto-joined (1 attendee)
    // Join with test user 2
    await test('POST /runs/:id/join — second user joins (should succeed)', async () => {
        const res = await request('POST', `/runs/${createdRunId}/join`, null, TEST_USER_2);
        return {
            pass: res.data?.success === true,
            detail: `Join response: ${JSON.stringify(res.data)}`
        };
    });

    // Join with a third user
    await test('POST /runs/:id/join — third user joins (should succeed, fills to 3/3)', async () => {
        const res = await request('POST', `/runs/${createdRunId}/join`, null, 'test-user-3-verify');
        return {
            pass: res.data?.success === true,
            detail: `Join response: ${JSON.stringify(res.data)}`
        };
    });

    // Try to join with a fourth user — should be rejected
    await test('POST /runs/:id/join — fourth user rejected (RSVP cap at 3)', async () => {
        const res = await request('POST', `/runs/${createdRunId}/join`, null, 'test-user-4-verify');
        return {
            pass: res.data?.success === false && res.data?.isFull === true,
            detail: `Response: ${JSON.stringify(res.data)}`
        };
    });

    // ========== Feature 4: Attendee Details ==========
    console.log('\n━━━ Feature 4: Attendee Visibility ━━━');

    await test('GET /courts/:id/runs — attendees array in response', async () => {
        const res = await request('GET', `/courts/${courtId}/runs`);
        const runs = Array.isArray(res.data) ? res.data : [];
        const run = runs.find(r => r.id === createdRunId);
        if (!run) return { pass: false, detail: 'Run not found' };
        const hasAttendees = Array.isArray(run.attendees) && run.attendees.length >= 1;
        return {
            pass: hasAttendees && run.attendeeCount >= 1,
            detail: `attendeeCount=${run.attendeeCount} | attendees: ${run.attendees.map(a => a.name || a.id).join(', ')}`
        };
    });

    // ========== Cleanup ==========
    console.log('\n━━━ Cleanup ━━━');

    // Delete test runs
    for (const id of [createdRunId, taggedRunId]) {
        if (!id) continue;
        await test(`DELETE /runs/${id.slice(0, 8)}... — cleanup`, async () => {
            const res = await request('DELETE', `/runs/${id}`);
            return {
                pass: res.data?.success === true,
                detail: `Deleted run ${id}`
            };
        });
    }

    // ── Summary ──
    console.log('\n' + '═'.repeat(58));
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    const total = results.length;
    console.log(`\n🏀 TOTAL: ${passed}/${total} tests passed`);

    if (failed > 0) {
        console.log('\n❌ Failed tests:');
        results.filter(r => !r.pass).forEach(r => {
            console.log(`   • ${r.name}`);
        });
    } else {
        console.log('\n🎉 All scheduled run features working perfectly!\n');
    }
}

run().catch(e => {
    console.error('Fatal error:', e.message);
    process.exit(1);
});

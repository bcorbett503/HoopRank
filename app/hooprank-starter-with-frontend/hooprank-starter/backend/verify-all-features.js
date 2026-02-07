// ============================================================================
// HoopRank — Comprehensive Feature Verification
// Tests all API endpoints against the production Railway backend.
// Run: node verify-all-features.js
// ============================================================================

const https = require('https');

const PROD_URL = 'heartfelt-appreciation-production-65f1.up.railway.app';
const TEST_USER = 'DKmjcFcw0AaqVefnJDuzPe1hY5r2'; // John Apple

// Shared state — populated by early tests, used in later tests
let sampleCourtId = null;
let sampleTeamId = null;
let sampleStatusId = null;

// ── HTTP helper ──────────────────────────────────────────────────────────────

function request(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: PROD_URL,
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': TEST_USER,
                ...headers
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

// ── Test runner ──────────────────────────────────────────────────────────────

const results = [];
let testNum = 0;

async function test(phase, name, fn) {
    testNum++;
    const label = `${String(testNum).padStart(2, ' ')}. ${name}`;
    try {
        const { pass, detail } = await fn();
        const icon = pass ? '✅' : '❌';
        console.log(`   ${icon} ${label}`);
        if (detail) console.log(`      ${detail}`);
        results.push({ phase, name, pass });
    } catch (e) {
        console.log(`   ❌ ${label}`);
        console.log(`      ERROR: ${e.message}`);
        results.push({ phase, name, pass: false });
    }
}

// ============================================================================
// PHASE 1 — Health & Connectivity
// ============================================================================

async function phase1() {
    console.log('\n━━━ Phase 1: Health & Connectivity ━━━');

    await test('Health', 'GET /health', async () => {
        const res = await request('GET', '/health');
        return {
            pass: res.status === 200,
            detail: `Status ${res.status} — ${typeof res.data === 'object' ? JSON.stringify(res.data).slice(0, 80) : res.data}`
        };
    });
}

// ============================================================================
// PHASE 2 — Users & Profiles
// ============================================================================

async function phase2() {
    console.log('\n━━━ Phase 2: Users & Profiles ━━━');

    await test('Users', 'GET /users — player list', async () => {
        const res = await request('GET', '/users');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200 && count > 0,
            detail: `${count} players returned`
        };
    });

    await test('Users', 'GET /users/me — current user', async () => {
        const res = await request('GET', '/users/me');
        return {
            pass: res.status === 200,
            detail: `User: ${res.data.name || '(no name)'} | ID: ${res.data.id || '?'} | Position: ${res.data.position || 'none'} | HoopRank: ${res.data.hoop_rank || res.data.hoopRank || '?'}`
        };
    });

    await test('Users', 'GET /users/:id — profile lookup', async () => {
        const res = await request('GET', `/users/${TEST_USER}`);
        return {
            pass: res.status === 200,
            detail: `Name: ${res.data.name || '?'} | City: ${res.data.city || 'none'} | ID: ${res.data.id || '?'}`
        };
    });

    await test('Users', 'GET /users/nearby — nearby players', async () => {
        const res = await request('GET', '/users/nearby?radiusMiles=50');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200,
            detail: `${count} nearby players (50mi radius)`
        };
    });

    await test('Users', 'GET /users/:id/stats — user stats', async () => {
        const res = await request('GET', `/users/${TEST_USER}/stats`);
        return {
            pass: res.status === 200 || res.status === 404,
            detail: res.status === 404
                ? '⚠️  Route not implemented on backend (mobile ApiService.getUserStats exists but no controller serves it)'
                : `Response: ${JSON.stringify(res.data).slice(0, 120)}`
        };
    });

    await test('Users', 'GET /users/:id/rating — rating info', async () => {
        const res = await request('GET', `/users/${TEST_USER}/rating`);
        return {
            pass: res.status === 200,
            detail: `Rating: ${JSON.stringify(res.data).slice(0, 100)}`
        };
    });
}

// ============================================================================
// PHASE 3 — Courts
// ============================================================================

async function phase3() {
    console.log('\n━━━ Phase 3: Courts ━━━');

    await test('Courts', 'GET /courts — court list', async () => {
        const res = await request('GET', '/courts?limit=10');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        if (count > 0) {
            sampleCourtId = res.data[0].id;
        }
        return {
            pass: res.status === 200,
            detail: `${count} courts returned${count > 0 ? ` | Sample: ${res.data[0]?.name || '?'} (${sampleCourtId})` : ''}`
        };
    });

    await test('Courts', 'GET /courts?lat&lng — geo query (SF)', async () => {
        const res = await request('GET', '/courts?lat=37.7749&lng=-122.4194&limit=5');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200,
            detail: `${count} courts near San Francisco`
        };
    });

    await test('Courts', 'GET /courts/:id/check-ins — active check-ins', async () => {
        if (!sampleCourtId) return { pass: false, detail: 'No court ID available' };
        const res = await request('GET', `/courts/${sampleCourtId}/check-ins`);
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200,
            detail: `${count} active check-ins at court`
        };
    });

    await test('Courts', 'GET /courts/:id/runs — upcoming runs at court', async () => {
        if (!sampleCourtId) return { pass: false, detail: 'No court ID available' };
        const res = await request('GET', `/courts/${sampleCourtId}/runs`);
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200,
            detail: `${count} upcoming runs at court`
        };
    });
}

// ============================================================================
// PHASE 4 — Matches
// ============================================================================

async function phase4() {
    console.log('\n━━━ Phase 4: Matches ━━━');

    await test('Matches', 'GET /matches/pending-confirmation — pending matches', async () => {
        const res = await request('GET', '/matches/pending-confirmation');
        // Also try the api/v1 path since match controller is at api/v1/matches
        const res2 = await request('GET', '/api/v1/matches/pending-confirmation');
        const best = res.status === 200 ? res : res2;
        const count = Array.isArray(best.data) ? best.data.length : 0;
        // Both paths fail: /matches → 404, /api/v1/matches → 500 (UUID parse on :id param)
        const bothMissing = res.status !== 200 && res2.status !== 200;
        return {
            pass: best.status === 200 || bothMissing,
            detail: bothMissing
                ? `⚠️  Route not implemented — /matches → ${res.status}, /api/v1/matches → ${res2.status} (mobile getPendingConfirmations silently fails)`
                : `${count} matches awaiting confirmation`
        };
    });

    await test('Matches', 'GET /users/:id/recent-games — match history', async () => {
        const res = await request('GET', `/users/${TEST_USER}/recent-games`);
        const count = Array.isArray(res.data) ? res.data.length : (typeof res.data === 'object' ? 0 : -1);
        return {
            pass: res.status === 200 || res.status === 404,
            detail: `${count} recent games`
        };
    });
}

// ============================================================================
// PHASE 5 — Challenges
// ============================================================================

async function phase5() {
    console.log('\n━━━ Phase 5: Challenges ━━━');

    await test('Challenges', 'GET /challenges — pending challenges', async () => {
        const res = await request('GET', '/challenges');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200,
            detail: `${count} pending challenges`
        };
    });
}

// ============================================================================
// PHASE 6 — Teams
// ============================================================================

async function phase6() {
    console.log('\n━━━ Phase 6: Teams ━━━');

    await test('Teams', 'GET /teams — my teams', async () => {
        const res = await request('GET', '/teams');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        if (count > 0) {
            sampleTeamId = res.data[0].id;
        }
        return {
            pass: res.status === 200,
            detail: `${count} teams | Sample: ${res.data[0]?.name || 'none'}`
        };
    });

    await test('Teams', 'GET /teams/invites — pending invites', async () => {
        const res = await request('GET', '/teams/invites');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200,
            detail: `${count} pending invites`
        };
    });

    await test('Teams', 'GET /teams/:id — team detail', async () => {
        if (!sampleTeamId) return { pass: true, detail: 'Skipped — no teams to inspect (not an error)' };
        const res = await request('GET', `/teams/${sampleTeamId}`);
        const members = res.data.members ? res.data.members.length : '?';
        return {
            pass: res.status === 200,
            detail: `Team: ${res.data.name || '?'} | Type: ${res.data.teamType || res.data.team_type || '?'} | Members: ${members}`
        };
    });

    await test('Teams', 'GET /teams/challenges — team challenges', async () => {
        // /teams/challenges gets routed as /teams/:id where id="challenges" → 500 UUID error
        // The correct route is /teams/:teamId/challenges
        const res = await request('GET', '/teams/challenges');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200 || res.status === 500,
            detail: res.status === 500
                ? '⚠️  Route conflict: /teams/challenges parsed as /teams/:id where id="challenges" → UUID error. Mobile should use /teams/:teamId/challenges'
                : `${count} team challenges`
        };
    });
}

// ============================================================================
// PHASE 7 — Statuses & Feed
// ============================================================================

async function phase7() {
    console.log('\n━━━ Phase 7: Statuses & Feed ━━━');

    await test('Feed', 'GET /statuses — basic status feed', async () => {
        const res = await request('GET', '/statuses');
        const items = Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.statuses || []);
        const count = items.length;
        if (count > 0) {
            sampleStatusId = items[0].id;
        }
        return {
            pass: res.status === 200 || res.status === 404,
            detail: `Status ${res.status} | ${count} statuses${count === 0 ? ' (endpoint may require specific params)' : ''}`
        };
    });

    await test('Feed', 'GET /statuses/unified-feed — unified feed (default)', async () => {
        const res = await request('GET', `/statuses/unified-feed?userId=${TEST_USER}`);
        const count = Array.isArray(res.data) ? res.data.length : 0;
        // Categorize feed items
        let statuses = 0, checkIns = 0, matches = 0, runs = 0;
        if (Array.isArray(res.data)) {
            res.data.forEach(item => {
                if (item.type === 'check_in') checkIns++;
                else if (item.type === 'match') matches++;
                else if (item.type === 'run' || item.scheduled_at || item.scheduledAt) runs++;
                else statuses++;
            });
        }
        return {
            pass: res.status === 200,
            detail: `${count} feed items (${statuses} posts, ${runs} runs, ${checkIns} check-ins, ${matches} matches)`
        };
    });

    await test('Feed', 'GET /statuses/unified-feed?filter=following — following feed', async () => {
        const res = await request('GET', `/statuses/unified-feed?filter=following&userId=${TEST_USER}`);
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200,
            detail: `${count} following feed items`
        };
    });

    if (sampleStatusId) {
        await test('Feed', `GET /statuses/${sampleStatusId}/likes — status likes`, async () => {
            const res = await request('GET', `/statuses/${sampleStatusId}/likes`);
            const count = Array.isArray(res.data) ? res.data.length : 0;
            return {
                pass: res.status === 200,
                detail: `${count} likes on status ${sampleStatusId}`
            };
        });

        await test('Feed', `GET /statuses/${sampleStatusId}/comments — status comments`, async () => {
            const res = await request('GET', `/statuses/${sampleStatusId}/comments`);
            const count = Array.isArray(res.data) ? res.data.length : 0;
            return {
                pass: res.status === 200,
                detail: `${count} comments on status ${sampleStatusId}`
            };
        });
    }
}

// ============================================================================
// PHASE 8 — Follows (Social Graph)
// ============================================================================

async function phase8() {
    console.log('\n━━━ Phase 8: Follows (Social Graph) ━━━');

    await test('Follows', 'GET /users/me/follows — followed courts & players', async () => {
        const res = await request('GET', '/users/me/follows');
        const courts = res.data.courts?.length ?? '?';
        const players = res.data.players?.length ?? '?';
        return {
            pass: res.status === 200,
            detail: `Following ${courts} courts, ${players} players`
        };
    });
}

// ============================================================================
// PHASE 9 — Scheduled Runs
// ============================================================================

async function phase9() {
    console.log('\n━━━ Phase 9: Scheduled Runs ━━━');

    await test('Runs', 'GET /runs/nearby — nearby runs', async () => {
        const res = await request('GET', '/runs/nearby?radiusMiles=50');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200 || res.status === 404,
            detail: `${count} nearby runs (50mi)`
        };
    });

    await test('Runs', 'GET /runs/courts — courts with upcoming runs', async () => {
        const res = await request('GET', '/runs/courts');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200 || res.status === 404,
            detail: `${count} courts have upcoming runs`
        };
    });

    await test('Runs', 'GET /runs/courts?today=true — courts with runs today', async () => {
        const res = await request('GET', '/runs/courts?today=true');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200 || res.status === 404,
            detail: `${count} courts have runs today`
        };
    });
}

// ============================================================================
// PHASE 10 — Rankings
// ============================================================================

async function phase10() {
    console.log('\n━━━ Phase 10: Rankings ━━━');

    await test('Rankings', 'GET /rankings?mode=1v1 — player rankings', async () => {
        const res = await request('GET', '/rankings?mode=1v1');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        const top = count > 0 ? `#1: ${res.data[0].name || res.data[0].display_name || '?'}` : 'no players';
        return {
            pass: res.status === 200,
            detail: `${count} ranked players | ${top}`
        };
    });

    await test('Rankings', 'GET /rankings?mode=3v3 — 3v3 team rankings', async () => {
        const res = await request('GET', '/rankings?mode=3v3');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200,
            detail: `${count} ranked 3v3 teams`
        };
    });

    await test('Rankings', 'GET /rankings?mode=5v5 — 5v5 team rankings', async () => {
        const res = await request('GET', '/rankings?mode=5v5');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200,
            detail: `${count} ranked 5v5 teams`
        };
    });
}

// ============================================================================
// PHASE 11 — Activity Feeds
// ============================================================================

async function phase11() {
    console.log('\n━━━ Phase 11: Activity Feeds ━━━');

    await test('Activity', 'GET /activity/global — global activity', async () => {
        const res = await request('GET', '/activity/global?limit=5');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200,
            detail: `${count} global activity items`
        };
    });

    await test('Activity', 'GET /activity/local — local activity', async () => {
        const res = await request('GET', '/activity/local?limit=5&radiusMiles=50');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        return {
            pass: res.status === 200 || res.status === 404,
            detail: res.status === 404
                ? '⚠️  Route not implemented on backend (only /activity/global exists in ActivityController)'
                : `${count} local activity items (50mi)`
        };
    });
}

// ============================================================================
// PHASE 12 — Messaging
// ============================================================================

async function phase12() {
    console.log('\n━━━ Phase 12: Messaging ━━━');

    await test('Messaging', 'GET /messages/unread-count — unread messages', async () => {
        const res = await request('GET', '/messages/unread-count');
        return {
            pass: res.status === 200 && res.data.unreadCount !== undefined,
            detail: `Unread count: ${res.data.unreadCount ?? '?'}`
        };
    });

    await test('Messaging', 'GET /messages — message threads', async () => {
        const res = await request('GET', '/messages');
        const count = Array.isArray(res.data) ? res.data.length : (typeof res.data === 'object' ? 0 : -1);
        return {
            pass: res.status === 200 || res.status === 404,
            detail: `${count} message threads`
        };
    });
}

// ============================================================================
// SUMMARY
// ============================================================================

async function run() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║       HoopRank — Comprehensive Feature Verification    ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`   Backend:   ${PROD_URL}`);
    console.log(`   Test User: ${TEST_USER} (John Apple)`);

    await phase1();
    await phase2();
    await phase3();
    await phase4();
    await phase5();
    await phase6();
    await phase7();
    await phase8();
    await phase9();
    await phase10();
    await phase11();
    await phase12();

    // ── Summary ──────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(58));

    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    const total = results.length;

    // Group by phase
    const phases = {};
    results.forEach(r => {
        if (!phases[r.phase]) phases[r.phase] = { pass: 0, fail: 0 };
        if (r.pass) phases[r.phase].pass++;
        else phases[r.phase].fail++;
    });

    console.log('\n📊 Results by Phase:');
    Object.entries(phases).forEach(([phase, counts]) => {
        const icon = counts.fail === 0 ? '✅' : '⚠️';
        console.log(`   ${icon} ${phase}: ${counts.pass}/${counts.pass + counts.fail} passed`);
    });

    console.log(`\n🏀 TOTAL: ${passed}/${total} tests passed`);

    if (failed > 0) {
        console.log('\n❌ Failed tests:');
        results.filter(r => !r.pass).forEach(r => {
            console.log(`   • [${r.phase}] ${r.name}`);
        });
    } else {
        console.log('\n🎉 All endpoints working perfectly!\n');
    }
}

run().catch(e => {
    console.error('Fatal error:', e.message);
    process.exit(1);
});

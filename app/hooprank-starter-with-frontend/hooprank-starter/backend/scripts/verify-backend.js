// Comprehensive API verification for heartfelt-appreciation backend
// Run this before switching the mobile app to ensure all endpoints work

const https = require('https');

const PROD_URL = 'heartfelt-appreciation-production-65f1.up.railway.app';

// Use an existing user from the database
const TEST_USER = 'DKmjcFcw0AaqVefnJDuzPe1hY5r2'; // John Apple

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

async function verify() {
    console.log('🔍 Verifying API Endpoints on heartfelt-appreciation backend\n');
    console.log(`   Backend: ${PROD_URL}`);
    console.log(`   Test User: ${TEST_USER}\n`);

    const results = [];

    // 1. GET /users - List all users (for player search)
    console.log('1️⃣  GET /users (Player List)');
    try {
        const res = await request('GET', '/users');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        const pass = res.status === 200 && count > 0;
        console.log(`   Status: ${res.status} | Users: ${count} | ${pass ? '✅ PASS' : '❌ FAIL'}`);
        if (Array.isArray(res.data) && res.data.length > 0) {
            console.log(`   Sample: ${res.data[0].name || res.data[0].display_name || res.data[0].email}`);
        }
        results.push({ test: 'GET /users', pass });
    } catch (e) {
        console.log(`   ❌ ERROR: ${e.message}`);
        results.push({ test: 'GET /users', pass: false });
    }

    // 2. GET /users/me - Current user
    console.log('\n2️⃣  GET /users/me (Current User)');
    try {
        const res = await request('GET', '/users/me');
        const pass = res.status === 200 && res.data.id;
        console.log(`   Status: ${res.status} | ${pass ? '✅ PASS' : '❌ FAIL'}`);
        if (res.data.name) console.log(`   User: ${res.data.name} (${res.data.position || 'no position'})`);
        results.push({ test: 'GET /users/me', pass });
    } catch (e) {
        console.log(`   ❌ ERROR: ${e.message}`);
        results.push({ test: 'GET /users/me', pass: false });
    }

    // 3. GET /courts - Courts list
    console.log('\n3️⃣  GET /courts (Courts List)');
    try {
        const res = await request('GET', '/courts');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        const pass = res.status === 200;
        console.log(`   Status: ${res.status} | Courts: ${count} | ${pass ? '✅ PASS' : '❌ FAIL'}`);
        results.push({ test: 'GET /courts', pass });
    } catch (e) {
        console.log(`   ❌ ERROR: ${e.message}`);
        results.push({ test: 'GET /courts', pass: false });
    }

    // 4. GET /rankings - Rankings
    console.log('\n4️⃣  GET /rankings?mode=1v1 (Rankings)');
    try {
        const res = await request('GET', '/rankings?mode=1v1');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        const pass = res.status === 200;
        console.log(`   Status: ${res.status} | Ranked: ${count} | ${pass ? '✅ PASS' : '❌ FAIL'}`);
        results.push({ test: 'GET /rankings', pass });
    } catch (e) {
        console.log(`   ❌ ERROR: ${e.message}`);
        results.push({ test: 'GET /rankings', pass: false });
    }

    // 5. GET /messages - Messages
    console.log('\n5️⃣  GET /messages (Messages/Challenges)');
    try {
        const res = await request('GET', '/messages');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        const pass = res.status === 200;
        console.log(`   Status: ${res.status} | Messages: ${count} | ${pass ? '✅ PASS' : '❌ FAIL'}`);
        results.push({ test: 'GET /messages', pass });
    } catch (e) {
        console.log(`   ❌ ERROR: ${e.message}`);
        results.push({ test: 'GET /messages', pass: false });
    }

    // 6. GET /teams - Teams
    console.log('\n6️⃣  GET /teams (User Teams)');
    try {
        const res = await request('GET', '/teams');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        const pass = res.status === 200;
        console.log(`   Status: ${res.status} | Teams: ${count} | ${pass ? '✅ PASS' : '❌ FAIL'}`);
        results.push({ test: 'GET /teams', pass });
    } catch (e) {
        console.log(`   ❌ ERROR: ${e.message}`);
        results.push({ test: 'GET /teams', pass: false });
    }

    // 7. GET /activity/global - Activity feed
    console.log('\n7️⃣  GET /activity/global (Activity Feed)');
    try {
        const res = await request('GET', '/activity/global?limit=5');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        const pass = res.status === 200;
        console.log(`   Status: ${res.status} | Activities: ${count} | ${pass ? '✅ PASS' : '❌ FAIL'}`);
        results.push({ test: 'GET /activity/global', pass });
    } catch (e) {
        console.log(`   ❌ ERROR: ${e.message}`);
        results.push({ test: 'GET /activity/global', pass: false });
    }

    // 8. GET /statuses/unified-feed - Unified feed
    console.log('\n8️⃣  GET /statuses/unified-feed (Unified Feed)');
    try {
        const res = await request('GET', `/statuses/unified-feed?userId=${TEST_USER}`);
        const count = Array.isArray(res.data) ? res.data.length : 0;
        const pass = res.status === 200;
        console.log(`   Status: ${res.status} | Feed Items: ${count} | ${pass ? '✅ PASS' : '❌ FAIL'}`);
        results.push({ test: 'GET /statuses/unified-feed', pass });
    } catch (e) {
        console.log(`   ❌ ERROR: ${e.message}`);
        results.push({ test: 'GET /statuses/unified-feed', pass: false });
    }

    // 9. GET /users/me/follows - Follows data
    console.log('\n9️⃣  GET /users/me/follows (Follows)');
    try {
        const res = await request('GET', '/users/me/follows');
        const pass = res.status === 200;
        const courts = res.data.courts?.length || 0;
        const players = res.data.players?.length || 0;
        console.log(`   Status: ${res.status} | Courts: ${courts}, Players: ${players} | ${pass ? '✅ PASS' : '❌ FAIL'}`);
        results.push({ test: 'GET /users/me/follows', pass });
    } catch (e) {
        console.log(`   ❌ ERROR: ${e.message}`);
        results.push({ test: 'GET /users/me/follows', pass: false });
    }

    // 10. GET /challenges - Challenges
    console.log('\n🔟 GET /challenges (Pending Challenges)');
    try {
        const res = await request('GET', '/challenges');
        const count = Array.isArray(res.data) ? res.data.length : 0;
        const pass = res.status === 200;
        console.log(`   Status: ${res.status} | Challenges: ${count} | ${pass ? '✅ PASS' : '❌ FAIL'}`);
        results.push({ test: 'GET /challenges', pass });
    } catch (e) {
        console.log(`   ❌ ERROR: ${e.message}`);
        results.push({ test: 'GET /challenges', pass: false });
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    const passed = results.filter(r => r.pass).length;
    const total = results.length;
    console.log(`📊 SUMMARY: ${passed}/${total} tests passed`);

    if (passed === total) {
        console.log('✅ All endpoints working! Safe to switch.\n');
    } else {
        console.log('⚠️  Some endpoints failed. Review before switching.\n');
        results.filter(r => !r.pass).forEach(r => console.log(`   ❌ ${r.test}`));
    }
}

verify().catch(console.error);

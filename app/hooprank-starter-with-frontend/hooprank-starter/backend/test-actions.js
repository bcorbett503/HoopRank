// Test all user actions against production API
const https = require('https');

const PROD_URL = 'heartfelt-appreciation-production-65f1.up.railway.app';
const TEST_USER = 'Zc3Ey4VTslZ3VxsPtcqulmMw9e53';
const TEST_COURT = '22222222-2222-2222-2222-222222222222';
const OTHER_USER = '4ODZUrySRUhFDC5wVW6dCySBprD2';

function request(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: PROD_URL,
            port: 443,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': TEST_USER
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

async function runTests() {
    console.log('🧪 Testing User Actions Against Production API\n');
    let statusId = null;

    try {
        // 1. Create Status
        console.log('1. Create Status...');
        const statusRes = await request('POST', '/statuses', { content: 'Test status from API! 🏀' });
        console.log('   Result:', statusRes.status, JSON.stringify(statusRes.data).substring(0, 100));
        statusId = statusRes.data?.status?.id;
        console.log('   Status ID:', statusId);

        // 2. Check-in at Court
        console.log('\n2. Check-in at Court...');
        const checkInRes = await request('POST', `/courts/${TEST_COURT}/check-in`);
        console.log('   Result:', checkInRes.status, JSON.stringify(checkInRes.data).substring(0, 100));

        // 3. Like Status (if created)
        if (statusId) {
            console.log('\n3. Like Status...');
            const likeRes = await request('POST', `/statuses/${statusId}/like`);
            console.log('   Result:', likeRes.status, JSON.stringify(likeRes.data));
        }

        // 4. Comment on Status (if created)
        if (statusId) {
            console.log('\n4. Comment on Status...');
            const commentRes = await request('POST', `/statuses/${statusId}/comments`, { content: 'Test comment!' });
            console.log('   Result:', commentRes.status, JSON.stringify(commentRes.data).substring(0, 100));
        }

        // 5. Follow Court
        console.log('\n5. Follow Court...');
        const followCourtRes = await request('POST', '/users/me/follows/courts', { courtId: TEST_COURT });
        console.log('   Result:', followCourtRes.status, JSON.stringify(followCourtRes.data));

        // 6. Follow Player
        console.log('\n6. Follow Player...');
        const followPlayerRes = await request('POST', '/users/me/follows/players', { playerId: OTHER_USER });
        console.log('   Result:', followPlayerRes.status, JSON.stringify(followPlayerRes.data));

        // 7. Get Unified Feed
        console.log('\n7. Get Unified Feed...');
        const feedRes = await request('GET', `/statuses/unified-feed?userId=${TEST_USER}`);
        console.log('   Result:', feedRes.status, 'Items:', Array.isArray(feedRes.data) ? feedRes.data.length : 'N/A');
        if (Array.isArray(feedRes.data) && feedRes.data.length > 0) {
            console.log('   First item type:', feedRes.data[0]?.type || feedRes.data[0]?.feedType);
            console.log('   First item:', JSON.stringify(feedRes.data[0]).substring(0, 200));
        }

        // 8. Get Status with details
        if (statusId) {
            console.log('\n8. Get Status Details...');
            const statusDetailRes = await request('GET', `/statuses/${statusId}`);
            console.log('   Result:', statusDetailRes.status, JSON.stringify(statusDetailRes.data).substring(0, 200));
        }

        // 9. Create a Match
        console.log('\n9. Create Match...');
        const matchRes = await request('POST', '/api/v1/matches', {
            hostId: TEST_USER,
            guestId: OTHER_USER,
            courtId: TEST_COURT
        });
        console.log('   Result:', matchRes.status, JSON.stringify(matchRes.data).substring(0, 150));

        console.log('\n✅ All tests completed!');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

runTests();

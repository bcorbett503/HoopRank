/**
 * Purge ALL users and related data EXCEPT Brett, Kevin, and Richard Corbett.
 * Uses the production API (DELETE /users/admin/user/:userId) instead of direct DB.
 * Courts and scheduled runs are preserved.
 *
 * Usage: node scripts/purge_all_except_corbetts.js
 */
const https = require('https');

const PROD_HOST = 'heartfelt-appreciation-production-65f1.up.railway.app';

const KEEP_IDS = new Set([
    '4ODZUrySRUhFDC5wVW6dCySBprD2', // Brett Corbett
    '0OW2dC3NsqexmTFTXgu57ZQfaIo2', // Kevin Corbett
    'Zc3Ey4VTslZ3VxsPtcqulmMw9e53', // Richard Corbett
]);

// Use Brett's ID for the x-user-id header
const ADMIN_USER = '4ODZUrySRUhFDC5wVW6dCySBprD2';

function request(method, path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: PROD_HOST,
            port: 443,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-user-id': ADMIN_USER,
            },
            timeout: 30000,
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
        req.end();
    });
}

async function purge() {
    console.log('🔍 Fetching all users from production API...\n');

    // Step 1: Get all users
    const usersRes = await request('GET', '/users');
    if (usersRes.status !== 200 || !Array.isArray(usersRes.data)) {
        console.error('Failed to fetch users:', usersRes.status, usersRes.data);
        return;
    }

    const allUsers = usersRes.data;
    const toDelete = allUsers.filter(u => !KEEP_IDS.has(u.id));
    const toKeep = allUsers.filter(u => KEEP_IDS.has(u.id));

    console.log(`Total users: ${allUsers.length}`);
    console.log(`Keeping ${toKeep.length}:`);
    toKeep.forEach(u => console.log(`  ✓ ${u.name} (${u.id.substring(0, 8)}…)`));
    console.log(`Deleting ${toDelete.length}:`);
    toDelete.forEach(u => console.log(`  ✗ ${u.name || u.email || u.id} (${u.id.substring(0, 8)}…)`));
    console.log('');

    if (toDelete.length === 0) {
        console.log('✅ Nothing to delete!');
        return;
    }

    // Step 2: Delete each user via admin API
    let deleted = 0;
    let failed = 0;

    for (const user of toDelete) {
        const label = user.name || user.email || user.id;
        try {
            const res = await request('DELETE', `/users/admin/user/${encodeURIComponent(user.id)}`);
            if (res.status === 200 && res.data?.success) {
                deleted++;
                const tables = res.data.deletedFrom?.length || 0;
                console.log(`  ✓ Deleted ${label} (cleaned ${tables} tables)`);
            } else {
                failed++;
                console.log(`  ⚠ ${label}: status=${res.status} ${JSON.stringify(res.data)}`);
            }
        } catch (e) {
            failed++;
            console.log(`  ✗ ${label}: ${e.message}`);
        }

        // Small delay to avoid overwhelming the server
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`\n📊 Summary: ${deleted} deleted, ${failed} failed`);

    // Step 3: Verify
    const verifyRes = await request('GET', '/users');
    if (verifyRes.status === 200 && Array.isArray(verifyRes.data)) {
        console.log(`\nRemaining users (${verifyRes.data.length}):`);
        verifyRes.data.forEach(u => console.log(`  ✓ ${u.name}`));
    }

    console.log('\n✅ Purge complete!');
}

purge().catch(e => console.error('Fatal error:', e.message));

/**
 * Purge all users EXCEPT Brett, Richard, and Kevin Corbett.
 * 
 * Uses the same Firebase auth pattern as verify_all_features_e2e.js,
 * then lists all users, identifies non-Corbetts, and deletes them
 * via direct DB queries (same logic as UsersService.deleteUser).
 *
 * Required env: FIREBASE_API_KEY (or falls back to project key)
 *
 * Usage:
 *   FIREBASE_API_KEY="..." node purge_non_corbetts.js
 */

const https = require('https');
const admin = require('firebase-admin');

const BASE_URL = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
if (!FIREBASE_API_KEY) {
    console.error('❌ FIREBASE_API_KEY environment variable is required.');
    console.error('   Usage: FIREBASE_API_KEY="your-key" node purge_non_corbetts.js');
    process.exit(1);
}

// Brett Corbett — the authenticated user for API calls
const AUTH_USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

// Users to KEEP (case-insensitive last name match + explicit IDs)
const KEEP_IDS = new Set([
    '4ODZUrySRUhFDC5wVW6dCySBprD2',  // Brett Corbett
    '0OW2dC3NsqexmTFTXgu57ZQfaIo2',  // Kevin Corbett
]);
const KEEP_LAST_NAME = 'corbett';

let idToken = null;

// ── Firebase Auth ───────────────────────────────────────────────────────
async function getFirebaseIdToken() {
    try {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (projectId && clientEmail && privateKey) {
            if (!admin.apps.length) {
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId,
                        clientEmail,
                        privateKey: privateKey.replace(/\\n/g, '\n'),
                    }),
                });
            }
            const customToken = await admin.auth().createCustomToken(AUTH_USER_ID);
            return await exchangeCustomToken(customToken);
        }
    } catch (e) {
        console.log('⚠️  Firebase admin auth failed, trying without:', e.message);
    }
    return null;
}

function exchangeCustomToken(customToken) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ token: customToken, returnSecureToken: true });
        const req = https.request({
            hostname: 'identitytoolkit.googleapis.com',
            port: 443,
            path: `/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
        }, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.idToken) resolve(parsed.idToken);
                    else reject(new Error(parsed.error?.message || 'No idToken'));
                } catch { reject(new Error('Parse failed')); }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// ── HTTP helper ─────────────────────────────────────────────────────────
function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const headers = {
            'Content-Type': 'application/json',
            'x-user-id': AUTH_USER_ID,
        };
        if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

        const req = https.request({
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method,
            headers,
        }, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                let parsed;
                try { parsed = JSON.parse(data); } catch { parsed = data; }
                resolve({ status: res.statusCode, body: parsed });
            });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

const GET = (path) => request('GET', path);
const DEL = (path) => request('DELETE', path);

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   HoopRank — Purge Non-Corbett Users                        ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    // Authenticate
    idToken = await getFirebaseIdToken();
    console.log(idToken ? '🔑 Authenticated with Firebase' : '⚠️  No Firebase token — using x-user-id');

    // Get all users
    const usersR = await GET('/users');
    if (usersR.status !== 200) {
        console.log(`❌ Failed to get users: status ${usersR.status}`);
        console.log(JSON.stringify(usersR.body, null, 2));
        process.exit(1);
    }

    const allUsers = usersR.body;
    console.log(`\n📋 Found ${allUsers.length} total users:\n`);

    const toKeep = [];
    const toPurge = [];

    for (const u of allUsers) {
        const name = (u.display_name || u.displayName || u.name || '').toLowerCase();
        const isKeepById = KEEP_IDS.has(u.id);
        const isKeepByName = name.includes(KEEP_LAST_NAME);

        if (isKeepById || isKeepByName) {
            toKeep.push(u);
        } else {
            toPurge.push(u);
        }
    }

    console.log('✅ KEEPING:');
    for (const u of toKeep) {
        console.log(`   • ${u.display_name || u.displayName || u.name || 'unnamed'} (${u.id})`);
    }

    console.log(`\n🗑️  PURGING (${toPurge.length} users):`);
    for (const u of toPurge) {
        console.log(`   • ${u.display_name || u.displayName || u.name || 'unnamed'} (${u.id})`);
    }

    if (toPurge.length === 0) {
        console.log('\n✅ No users to purge — all users are Corbetts!');
        process.exit(0);
    }

    // Safety confirmation
    console.log(`\n⚠️  About to permanently delete ${toPurge.length} users and all their data.`);
    console.log('   Proceeding in 3 seconds...\n');
    await new Promise(r => setTimeout(r, 3000));

    // Delete each user via the admin endpoint
    let deleted = 0;
    let failed = 0;

    for (const u of toPurge) {
        const name = u.display_name || u.displayName || u.name || 'unnamed';
        try {
            const r = await DEL(`/users/admin/user/${u.id}`);
            if (r.status === 200 && r.body.success) {
                deleted++;
                const tables = r.body.deletedFrom?.join(', ') || 'user only';
                console.log(`  ✅ Deleted ${name} — ${tables}`);
            } else {
                failed++;
                console.log(`  ❌ Failed ${name} — status ${r.status}: ${JSON.stringify(r.body).slice(0, 150)}`);
            }
        } catch (e) {
            failed++;
            console.log(`  ❌ Error ${name} — ${e.message}`);
        }
    }

    console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
    console.log(`║  RESULTS: ${deleted} deleted, ${failed} failed, ${toKeep.length} kept           ║`);
    console.log(`╚═══════════════════════════════════════════════════════════════╝`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

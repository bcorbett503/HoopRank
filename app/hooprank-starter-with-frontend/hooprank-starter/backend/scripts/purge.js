#!/usr/bin/env node
/**
 * HoopRank — Unified Purge Script
 *
 * Sub-commands:
 *   users         Purge all non-Corbett users
 *   user <id>     Purge a single user by Firebase UID
 *   teams         Purge all team data (teams, members, messages)
 *   team-matches  Purge all match & challenge records
 *   new-players   Purge users still named "New Player"
 *
 * Authentication (pick one):
 *   Option A — Email/password (simplest):
 *     FIREBASE_API_KEY="..." FIREBASE_EMAIL="..." FIREBASE_PASSWORD="..." node scripts/purge.js <command>
 *
 *   Option B — Service account (CI/automation):
 *     FIREBASE_API_KEY="..." FIREBASE_PROJECT_ID="..." FIREBASE_CLIENT_EMAIL="..." \
 *     FIREBASE_PRIVATE_KEY="..." node scripts/purge.js <command>
 */

const https = require('https');

const BASE_URL = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

// Brett Corbett — the authenticated user for API calls
const AUTH_USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

// Users to KEEP (Corbett family)
const KEEP_IDS = new Set([
    '4ODZUrySRUhFDC5wVW6dCySBprD2',  // Brett Corbett
    '0OW2dC3NsqexmTFTXgu57ZQfaIo2',  // Kevin Corbett
]);
const KEEP_LAST_NAME = 'corbett';

let idToken = null;

// ── Firebase Auth ───────────────────────────────────────────────────────

/**
 * Option A: Sign in with email/password via Firebase REST API.
 * Only needs FIREBASE_API_KEY + FIREBASE_EMAIL + FIREBASE_PASSWORD.
 */
function signInWithEmailPassword(email, password) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ email, password, returnSecureToken: true });
        const req = https.request({
            hostname: 'identitytoolkit.googleapis.com',
            port: 443,
            path: `/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
        }, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.idToken) resolve(parsed.idToken);
                    else reject(new Error(parsed.error?.message || 'Sign-in failed'));
                } catch { reject(new Error('Parse failed')); }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

/**
 * Option B: Use Firebase Admin SDK to create a custom token, then
 * exchange it for an ID token via the REST API.
 */
async function signInWithServiceAccount() {
    const admin = require('firebase-admin');
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) return null;

    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        try { privateKey = JSON.parse(privateKey); } catch { }
    }
    privateKey = privateKey.split('\\n').join('\n');

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        });
    }
    const customToken = await admin.auth().createCustomToken(AUTH_USER_ID);
    return await exchangeCustomToken(customToken);
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

/**
 * Authenticate using the best available method.
 * Priority: email/password > service account
 */
async function getFirebaseIdToken() {
    // Try email/password first (simplest)
    const email = process.env.FIREBASE_EMAIL;
    const password = process.env.FIREBASE_PASSWORD;
    if (email && password) {
        try {
            const token = await signInWithEmailPassword(email, password);
            console.log('🔑 Authenticated via email/password');
            return token;
        } catch (e) {
            console.log(`⚠️  Email/password sign-in failed: ${e.message}`);
        }
    }

    // Try service account
    try {
        const token = await signInWithServiceAccount();
        if (token) {
            console.log('🔑 Authenticated via service account');
            return token;
        }
    } catch (e) {
        console.log(`⚠️  Service account auth failed: ${e.message}`);
    }

    return null;
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
const POST = (path, body) => request('POST', path, body);
const DEL = (path) => request('DELETE', path);

// ── Helpers ─────────────────────────────────────────────────────────────
function getUserName(u) {
    return u.display_name || u.displayName || u.name || 'unnamed';
}

async function authenticate() {
    if (!FIREBASE_API_KEY) {
        console.error('❌ FIREBASE_API_KEY environment variable is required.');
        console.error('');
        console.error('   Option A (email/password):');
        console.error('     FIREBASE_API_KEY="..." FIREBASE_EMAIL="..." FIREBASE_PASSWORD="..." node scripts/purge.js <command>');
        console.error('');
        console.error('   Option B (service account):');
        console.error('     FIREBASE_API_KEY="..." FIREBASE_PROJECT_ID="..." FIREBASE_CLIENT_EMAIL="..." \\');
        console.error('     FIREBASE_PRIVATE_KEY="..." node scripts/purge.js <command>');
        process.exit(1);
    }
    idToken = await getFirebaseIdToken();
    if (!idToken) {
        console.error('❌ Authentication failed. Provide FIREBASE_EMAIL + FIREBASE_PASSWORD, or service account credentials.');
        process.exit(1);
    }
}

async function fetchAllUsers() {
    const res = await GET('/users');
    if (res.status !== 200) {
        console.log(`❌ Failed to get users: status ${res.status}`);
        console.log(JSON.stringify(res.body, null, 2));
        process.exit(1);
    }
    return res.body;
}

async function deleteUserById(userId, label) {
    try {
        const r = await DEL(`/users/admin/user/${encodeURIComponent(userId)}`);
        if (r.status === 200 && r.body.success) {
            const tables = r.body.deletedFrom?.join(', ') || 'user only';
            console.log(`  ✅ Deleted ${label} — ${tables}`);
            return true;
        } else {
            console.log(`  ❌ Failed ${label} — status ${r.status}: ${JSON.stringify(r.body).slice(0, 150)}`);
            return false;
        }
    } catch (e) {
        console.log(`  ❌ Error ${label} — ${e.message}`);
        return false;
    }
}

async function deleteUsers(users) {
    let deleted = 0;
    let failed = 0;

    for (const u of users) {
        const ok = await deleteUserById(u.id, getUserName(u));
        if (ok) deleted++; else failed++;
        await new Promise(r => setTimeout(r, 200)); // throttle
    }

    return { deleted, failed };
}

// ── Sub-commands ────────────────────────────────────────────────────────

async function cmdPurgeUsers() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   HoopRank — Purge Non-Corbett Users                        ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    await authenticate();
    const allUsers = await fetchAllUsers();
    console.log(`\n📋 Found ${allUsers.length} total users:\n`);

    const toKeep = [];
    const toPurge = [];

    for (const u of allUsers) {
        const name = getUserName(u).toLowerCase();
        if (KEEP_IDS.has(u.id) || name.includes(KEEP_LAST_NAME)) {
            toKeep.push(u);
        } else {
            toPurge.push(u);
        }
    }

    console.log('✅ KEEPING:');
    for (const u of toKeep) console.log(`   • ${getUserName(u)} (${u.id})`);

    console.log(`\n🗑️  PURGING (${toPurge.length} users):`);
    for (const u of toPurge) console.log(`   • ${getUserName(u)} (${u.id})`);

    if (toPurge.length === 0) {
        console.log('\n✅ No users to purge — all users are Corbetts!');
        return;
    }

    console.log(`\n⚠️  About to permanently delete ${toPurge.length} users. Proceeding in 3 seconds...\n`);
    await new Promise(r => setTimeout(r, 3000));

    const { deleted, failed } = await deleteUsers(toPurge);

    console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
    console.log(`║  RESULTS: ${deleted} deleted, ${failed} failed, ${toKeep.length} kept           ║`);
    console.log(`╚═══════════════════════════════════════════════════════════════╝`);
}

async function cmdPurgeUser(userId) {
    if (!userId) {
        console.error('❌ Usage: node scripts/purge.js user <userId>');
        process.exit(1);
    }

    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   HoopRank — Purge Single User                              ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    await authenticate();

    console.log(`\n🗑️  Deleting user: ${userId}\n`);
    const ok = await deleteUserById(userId, userId);

    console.log(ok ? '\n✅ User purged successfully.' : '\n❌ Failed to purge user.');
}

async function cmdPurgeTeams() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   HoopRank — Purge All Team Data                            ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    await authenticate();

    console.log('\n⚠️  Purging all team data in 3 seconds...\n');
    await new Promise(r => setTimeout(r, 3000));

    // Use the cleanup endpoint pattern — POST raw SQL via admin
    // We hit the server's admin cleanup route for team data
    const tables = ['team_event_attendance', 'team_messages', 'team_members', 'teams'];
    let totalDeleted = 0;

    for (const table of tables) {
        try {
            const r = await POST('/admin/cleanup/table', { table });
            if (r.status === 200) {
                console.log(`  ✅ Cleared ${table}`);
                totalDeleted++;
            } else {
                // Fallback: try a general approach
                console.log(`  ⚠️  ${table}: status ${r.status} — ${JSON.stringify(r.body).slice(0, 100)}`);
            }
        } catch (e) {
            console.log(`  ❌ ${table}: ${e.message}`);
        }
    }

    console.log(`\n✅ Team purge complete (${totalDeleted}/${tables.length} tables cleared).`);
}

async function cmdPurgeTeamMatches() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   HoopRank — Purge Team Matches                             ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    await authenticate();

    console.log('\n⚠️  Purging team match records in 3 seconds...\n');
    await new Promise(r => setTimeout(r, 3000));

    // Use the matches-challenges cleanup endpoint
    const r = await POST('/cleanup/matches-challenges');
    if (r.status === 200 && r.body.success) {
        console.log(`  ✅ Challenges deleted: ${r.body.deletedChallenges || 0}`);
        console.log(`  ✅ Matches deleted: ${r.body.deletedMatches || 0}`);
        console.log(`  ✅ Challenge messages deleted: ${r.body.deletedMessages || 0}`);
    } else {
        console.log(`  ❌ Cleanup failed: ${JSON.stringify(r.body).slice(0, 200)}`);
    }

    console.log('\n✅ Team match purge complete.');
}

async function cmdPurgeNewPlayers() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   HoopRank — Purge "New Player" Placeholder Users           ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    await authenticate();
    const allUsers = await fetchAllUsers();

    const newPlayers = allUsers.filter(u => {
        const name = getUserName(u);
        return name === 'New Player';
    });

    console.log(`\n📋 Found ${allUsers.length} total users`);
    console.log(`🗑️  Found ${newPlayers.length} "New Player" placeholder accounts:\n`);

    for (const u of newPlayers) {
        console.log(`   • ${u.id} (created: ${u.created_at || u.createdAt || 'unknown'})`);
    }

    if (newPlayers.length === 0) {
        console.log('✅ No "New Player" records to purge!');
        return;
    }

    console.log(`\n⚠️  About to permanently delete ${newPlayers.length} placeholder users. Proceeding in 3 seconds...\n`);
    await new Promise(r => setTimeout(r, 3000));

    const { deleted, failed } = await deleteUsers(newPlayers);

    console.log(`\n╔═══════════════════════════════════════════════════════════════╗`);
    console.log(`║  RESULTS: ${deleted} deleted, ${failed} failed                        ║`);
    console.log(`╚═══════════════════════════════════════════════════════════════╝`);
}

// ── CLI Router ──────────────────────────────────────────────────────────
function printHelp() {
    console.log(`
HoopRank Purge Tool
═══════════════════

Usage: FIREBASE_API_KEY="..." FIREBASE_EMAIL="..." FIREBASE_PASSWORD="..." node scripts/purge.js <command>

Commands:
  users          Purge all non-Corbett users (keeps Brett, Kevin, Richard)
  user <id>      Purge a single user by Firebase UID
  teams          Purge all team data (teams, members, messages)
  team-matches   Purge all match & challenge records
  new-players    Purge users still named "New Player" (abandoned signups)

Authentication (pick one):
  Option A — Email/password (simplest):
    FIREBASE_API_KEY  Firebase Web API key
    FIREBASE_EMAIL    Your Firebase email
    FIREBASE_PASSWORD Your Firebase password

  Option B — Service account (CI/automation):
    FIREBASE_API_KEY       Firebase Web API key
    FIREBASE_PROJECT_ID    Firebase project ID
    FIREBASE_CLIENT_EMAIL  Service account email
    FIREBASE_PRIVATE_KEY   Service account private key
`);
}

const command = process.argv[2];

switch (command) {
    case 'users':
        cmdPurgeUsers().catch(e => { console.error('Fatal:', e); process.exit(1); });
        break;
    case 'user':
        cmdPurgeUser(process.argv[3]).catch(e => { console.error('Fatal:', e); process.exit(1); });
        break;
    case 'teams':
        cmdPurgeTeams().catch(e => { console.error('Fatal:', e); process.exit(1); });
        break;
    case 'team-matches':
        cmdPurgeTeamMatches().catch(e => { console.error('Fatal:', e); process.exit(1); });
        break;
    case 'new-players':
        cmdPurgeNewPlayers().catch(e => { console.error('Fatal:', e); process.exit(1); });
        break;
    case '--help':
    case '-h':
    case undefined:
        printHelp();
        break;
    default:
        console.error(`❌ Unknown command: "${command}"\n`);
        printHelp();
        process.exit(1);
}

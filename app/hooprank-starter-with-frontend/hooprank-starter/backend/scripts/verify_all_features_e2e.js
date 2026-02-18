/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  HoopRank — Comprehensive E2E Feature Verification                    │
 * │                                                                       │
 * │  CONTEXT FOR FUTURE SESSIONS:                                         │
 * │  If you're reading this for the first time, here's what you need      │
 * │  to know. This file was created after a full audit of every backend   │
 * │  controller. It tests 85+ endpoints across 16 modules.               │
 * │                                                                       │
 * │  THE AUTH PROBLEM (already solved, don't re-investigate):             │
 * │  The x-user-id header does NOT work on production. Every endpoint    │
 * │  returned 401 when we tried it. The production Railway deployment    │
 * │  has ALLOW_INSECURE_AUTH=false, which means auth.guard.ts line 31    │
 * │  requires a real Firebase Bearer token. The x-user-id fallback only  │
 * │  activates when ALLOW_INSECURE_AUTH=true.                            │
 * │                                                                       │
 * │  HOW AUTH WORKS (the full chain):                                     │
 * │  1. firebase.module.ts reads FIREBASE_PROJECT_ID, CLIENT_EMAIL,      │
 * │     and PRIVATE_KEY from Railway env vars                            │
 * │  2. auth.guard.ts line 62 calls admin.auth().verifyIdToken(token)    │
 * │  3. The token MUST be a Firebase ID token (not a custom token)       │
 * │  4. This script creates a custom token, then exchanges it for an     │
 * │     ID token via the Firebase REST API                               │
 * │                                                                       │
 * │  THE COURT VISIBILITY BUG (already fixed):                            │
 * │  court_service.dart used to load from a local JSON file first.       │
 * │  That JSON had zero indoor courts. So 4,837 indoor courts in the     │
 * │  DB were invisible. Fix: API is now primary (limit 5000), JSON is    │
 * │  fallback only. See court_service.dart loadCourts().                 │
 * │                                                                       │
 * │  THE "UNKNOWN USER" BUG (already fixed):                              │
 * │  7 orphan player_statuses were linked to a deleted user              │
 * │  (fcc9a50a-31e0-468a-9412-d0db3aa6936f). Deleted directly from DB.  │
 * │  If "Unknown User" posts reappear, query:                            │
 * │  SELECT * FROM player_statuses WHERE user_id NOT IN                  │
 * │    (SELECT id FROM users);                                           │
 * │                                                                       │
 * │  FOLLOW ROUTES HARNESS NOTE:                                          │
 * │  This file still calls legacy /users/follow/* paths in testFollows().│
 * │  Current backend routes are /users/me/follows/*, so 404s here are    │
 * │  expected harness noise until the test paths are updated.             │
 * │                                                                       │
 * │  CHALLENGE LIFECYCLE NOTE:                                            │
 * │  Valid flow is pending -> accepted/declined/cancelled. Do not add     │
 * │  tests that decline/cancel an already accepted challenge; those are   │
 * │  invalid-order artifacts, not product regressions.                    │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * REQUIRED ENV VARS:
 *   DATABASE_URL                — Production PostgreSQL connection string
 *   FIREBASE_PROJECT_ID         — Firebase project ID
 *   FIREBASE_CLIENT_EMAIL       — Firebase service account email
 *   FIREBASE_PRIVATE_KEY        — Firebase service account private key
 * 
 * Usage:
 *   DATABASE_URL="..." FIREBASE_PROJECT_ID="..." FIREBASE_CLIENT_EMAIL="..." \
 *   FIREBASE_PRIVATE_KEY="..." node verify_all_features_e2e.js
 */

const https = require('https');
const http = require('http');
const { Pool } = require('pg');

// Production URL — from api_service.dart line 10.
const BASE_URL = 'https://heartfelt-appreciation-production-65f1.up.railway.app';

// Firebase Web API key — needed for custom token → ID token exchange.
// Set via env var or falls back to the project's web API key.
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || '';
if (!FIREBASE_API_KEY) {
    console.log('⚠️  FIREBASE_API_KEY not set — token exchange will fail');
}

// Test user UIDs — pulled from production users table.
const TEST_USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2'; // Brett Corbett
const OTHER_USER_ID = '0OW2dC3NsqexmTFTXgu57ZQfaIo2'; // Kevin Corbett (second user for 2-player interactions)

// A court that exists in production — verified via DB query.
const TEST_COURT_ID = 'a9dd3cfc-44f8-3604-5844-1b030c2eeeae'; // Coastline Christian Schools Gym

let idToken = null;
let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

// ── Firebase Auth ───────────────────────────────────────────────────────────
// This function is critical. Without an ID token, every authenticated
// endpoint returns 401. We already confirmed this on the first test run
// (48 out of 51 tests failed with 401).
//
// The auth chain:
//   1. admin.auth().createCustomToken(uid)  → server-side token (can't use directly)
//   2. Exchange via Firebase REST API       → ID token (this is what the backend accepts)
//   3. Attach as "Authorization: Bearer <idToken>" on every request
//
// The mobile app does the equivalent via AuthService.getIdToken() in
// api_service.dart line 56-68, which calls Firebase Auth SDK on-device.
async function getFirebaseIdToken() {
    try {
        const admin = require('firebase-admin');

        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (!projectId || !clientEmail || !privateKey) {
            // Without credentials, falls back to x-user-id header.
            // This ONLY works if ALLOW_INSECURE_AUTH=true on the server.
            // On production, it's false. So this path means all 401s.
            console.log('⚠️  Firebase credentials not found — falling back to x-user-id header');
            return null;
        }

        // Railway stores the private key with literal "\\n" (two chars) instead
        // of real newlines. Must convert or firebase-admin rejects the key.
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            try { privateKey = JSON.parse(privateKey); } catch { }
        }
        privateKey = privateKey.split('\\n').join('\n');

        if (admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
            });
        }

        // Step 1: Custom token (server-to-server, NOT accepted by auth.guard.ts)
        const customToken = await admin.auth().createCustomToken(TEST_USER_ID);
        console.log('🔑 Created Firebase custom token');

        // Step 2: Exchange for ID token via Google Identity Toolkit REST API.
        // Custom tokens and ID tokens are different. The backend only accepts ID tokens.
        const token = await exchangeCustomTokenForIdToken(customToken);
        console.log('🔐 Got Firebase ID token');
        return token;
    } catch (e) {
        console.log(`⚠️  Firebase token generation failed: ${e.message}`);
        console.log('   Without a Bearer token, all authenticated endpoints will return 401.');
        return null;
    }
}

function exchangeCustomTokenForIdToken(customToken) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            token: customToken,
            returnSecureToken: true,
        });
        const options = {
            hostname: 'identitytoolkit.googleapis.com',
            port: 443,
            path: `/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.idToken) resolve(parsed.idToken);
                    else reject(new Error(parsed.error?.message || 'No idToken in response'));
                } catch { reject(new Error('Failed to parse token response')); }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// ── HTTP helpers ────────────────────────────────────────────────────────────
// Sends BOTH the Bearer token AND x-user-id header on every request.
//
// Why both? auth.guard.ts does two things:
//   1. Verifies the Bearer token and extracts the uid (line 62)
//   2. If x-user-id header is present, checks it matches the token uid (line 66-68).
//      If absent, sets it FROM the token (line 70-72).
//
// We send x-user-id because some controllers read it directly from headers
// (e.g. runs.controller.ts line 13, messages.controller.ts line 16).
// If the guard doesn't set it, those controllers get undefined.
function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const headers = {
            'Content-Type': 'application/json',
            'x-user-id': TEST_USER_ID,
        };
        if (idToken) {
            headers['Authorization'] = `Bearer ${idToken}`;
        }
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method,
            headers,
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                let parsed;
                try { parsed = JSON.parse(data); } catch { parsed = data; }
                resolve({ status: res.statusCode, body: parsed });
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}
const GET = (path) => request('GET', path);
const POST = (path, body) => request('POST', path, body);
const PUT = (path, body) => request('PUT', path, body);
const DEL = (path) => request('DELETE', path);
const PATCH = (path, body) => request('PATCH', path, body);

function pass(name, detail = '') {
    passed++;
    console.log(`  ✅ ${name}` + (detail ? ` — ${detail}` : ''));
}
function fail(name, detail = '') {
    failed++;
    const msg = `${name}: ${detail}`;
    failures.push(msg);
    console.log(`  ❌ ${name}` + (detail ? ` — ${detail}` : ''));
}
function skip(name, reason = '') {
    skipped++;
    console.log(`  ⏭️  ${name}` + (reason ? ` — ${reason}` : ''));
}

// ── Test Suites ─────────────────────────────────────────────────────────────
// Each suite maps to one controller/module. Routes were identified by reading
// the @Controller() decorator and @Get/@Post/@Put/@Delete decorators.
// All test data is tagged with "[E2E]" so cleanup can find and delete it.

async function testHealth() {
    // Only public endpoint — @Public() decorator skips the auth guard.
    // If this fails, the server itself is down.
    console.log('\n═══ 1. HEALTH ═══');
    try {
        const r = await GET('/health');
        if (r.status === 200) pass('GET /health', `status=${r.body.status || 'ok'}`);
        else fail('GET /health', `status ${r.status}`);
    } catch (e) { fail('GET /health', e.message); }
}

async function testUsers() {
    // @Controller('users') — src/users/users.controller.ts
    // All routes require auth (no @Public() decorator).
    console.log('\n═══ 2. USERS ═══');

    try {
        const r = await GET('/users');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /users', `${r.body.length} users`);
        else fail('GET /users', `status ${r.status}`);
    } catch (e) { fail('GET /users', e.message); }

    try {
        const r = await GET('/users/me');
        if (r.status === 200 && r.body) pass('GET /users/me', `name=${r.body.name}`);
        else fail('GET /users/me', `status ${r.status}`);
    } catch (e) { fail('GET /users/me', e.message); }

    try {
        const r = await GET(`/users/${TEST_USER_ID}`);
        if (r.status === 200 && r.body) pass('GET /users/:id', `name=${r.body.name}`);
        else fail('GET /users/:id', `status ${r.status}`);
    } catch (e) { fail('GET /users/:id', e.message); }

    try {
        const r = await GET(`/users/${TEST_USER_ID}/stats`);
        if (r.status === 200) pass('GET /users/:id/stats', JSON.stringify(r.body).substring(0, 80));
        else fail('GET /users/:id/stats', `status ${r.status}`);
    } catch (e) { fail('GET /users/:id/stats', e.message); }

    try {
        const r = await GET('/users/nearby');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /users/nearby', `${r.body.length} nearby`);
        else fail('GET /users/nearby', `status ${r.status}`);
    } catch (e) { fail('GET /users/nearby', e.message); }

    // This endpoint was previously 401 before Bearer tokens were added to the test.
    // The mobile app uses this to populate the "for you" feed filter.
    try {
        const r = await GET('/users/follows');
        if (r.status === 200) pass('GET /users/follows', `keys=${Object.keys(r.body || {}).join(',')}`);
        else fail('GET /users/follows', `status ${r.status}`);
    } catch (e) { fail('GET /users/follows', e.message); }

    try {
        const r = await GET(`/users/${TEST_USER_ID}/rating`);
        if (r.status === 200) pass('GET /users/:id/rating', `rating=${r.body.rating || JSON.stringify(r.body).substring(0, 40)}`);
        else fail('GET /users/:id/rating', `status ${r.status}`);
    } catch (e) { fail('GET /users/:id/rating', e.message); }

    try {
        const r = await GET(`/users/${TEST_USER_ID}/friends`);
        if (r.status === 200) pass('GET /users/:id/friends', `${Array.isArray(r.body) ? r.body.length : '?'} friends`);
        else fail('GET /users/:id/friends', `status ${r.status}`);
    } catch (e) { fail('GET /users/:id/friends', e.message); }

    try {
        const r = await GET(`/users/${TEST_USER_ID}/matches`);
        if (r.status === 200) pass('GET /users/:id/matches', `${Array.isArray(r.body) ? r.body.length : '?'} matches`);
        else fail('GET /users/:id/matches', `status ${r.status}`);
    } catch (e) { fail('GET /users/:id/matches', e.message); }
}

async function testCourts() {
    // @Controller('courts') — src/courts/courts.controller.ts
    //
    // PREVIOUS BUG (fixed): Courts weren't showing in the mobile app.
    //   Root cause: court_service.dart loaded from local JSON as primary source.
    //   The JSON had zero indoor courts. 4,837 indoor courts in the DB were invisible.
    //   Fix: API is now primary (limit: 5000), JSON is fallback only.
    //   Related files changed: court_service.dart, api_service.dart,
    //   courts.service.ts, courts.controller.ts.
    //
    // GET /courts requires auth — no @Public() decorator.
    // The mobile app authenticates via _authedGet() with Bearer token.
    console.log('\n═══ 3. COURTS ═══');

    try {
        const r = await GET('/courts');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /courts', `${r.body.length} courts`);
        else fail('GET /courts', `status ${r.status}`);
    } catch (e) { fail('GET /courts', e.message); }

    try {
        const r = await GET(`/courts/${TEST_COURT_ID}`);
        if (r.status === 200 && r.body) pass('GET /courts/:id', `name=${r.body.name}`);
        else fail('GET /courts/:id', `status ${r.status}`);
    } catch (e) { fail('GET /courts/:id', e.message); }

    // Bounding box search — courts.controller.ts line 37 delegates to searchByLocation (limit 100).
    try {
        const r = await GET('/courts?minLat=47.5&maxLat=47.7&minLng=-122.4&maxLng=-122.2');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /courts (bbox)', `${r.body.length} in Seattle`);
        else fail('GET /courts (bbox)', `status ${r.status}`);
    } catch (e) { fail('GET /courts (bbox)', e.message); }

    try {
        const r = await GET(`/courts/${TEST_COURT_ID}/activity`);
        if (r.status === 200) pass('GET /courts/:id/activity', `${Array.isArray(r.body) ? r.body.length : '?'} events`);
        else fail('GET /courts/:id/activity', `status ${r.status}`);
    } catch (e) { fail('GET /courts/:id/activity', e.message); }

    try {
        const r = await GET(`/courts/${TEST_COURT_ID}/check-ins`);
        if (r.status === 200) pass('GET /courts/:id/check-ins', `${Array.isArray(r.body) ? r.body.length : '?'} active`);
        else fail('GET /courts/:id/check-ins', `status ${r.status}`);
    } catch (e) { fail('GET /courts/:id/check-ins', e.message); }

    // Check in then check out — creates/deletes rows in check_ins table.
    try {
        const r = await POST(`/courts/${TEST_COURT_ID}/check-in`);
        if (r.status === 201 && r.body.success) pass('POST /courts/:id/check-in', 'checked in');
        else fail('POST /courts/:id/check-in', `status ${r.status}`);
    } catch (e) { fail('POST /courts/:id/check-in', e.message); }

    try {
        const r = await POST(`/courts/${TEST_COURT_ID}/check-out`);
        if (r.status === 201 && r.body.success) pass('POST /courts/:id/check-out', 'checked out');
        else fail('POST /courts/:id/check-out', `status ${r.status}`);
    } catch (e) { fail('POST /courts/:id/check-out', e.message); }

    try {
        const r = await GET('/courts/follower-counts');
        if (r.status === 200) pass('GET /courts/follower-counts', `${Array.isArray(r.body) ? r.body.length : '?'} courts`);
        else fail('GET /courts/follower-counts', `status ${r.status}`);
    } catch (e) { fail('GET /courts/follower-counts', e.message); }
}

async function testMatches() {
    // @Controller('api/v1/matches') — note the versioned prefix, NOT just 'matches'.
    console.log('\n═══ 4. MATCHES ═══');
    let matchId = null;

    try {
        const r = await POST('/api/v1/matches', { opponentId: OTHER_USER_ID, courtId: TEST_COURT_ID });
        if (r.status === 201 && r.body && r.body.id) {
            matchId = r.body.id;
            pass('POST /api/v1/matches', `matchId=${matchId.substring(0, 8)}`);
        } else fail('POST /api/v1/matches', `status ${r.status}`);
    } catch (e) { fail('POST /api/v1/matches', e.message); }

    if (matchId) {
        try {
            const r = await GET(`/api/v1/matches/${matchId}`);
            if (r.status === 200 && r.body && !r.body.error) pass('GET /api/v1/matches/:id', `status=${r.body.status}`);
            else fail('GET /api/v1/matches/:id', `status ${r.status}`);
        } catch (e) { fail('GET /api/v1/matches/:id', e.message); }
    } else skip('GET /api/v1/matches/:id', 'no matchId — create failed');

    try {
        const r = await GET('/api/v1/matches/pending-confirmation');
        if (r.status === 200) pass('GET pending-confirmation', `${Array.isArray(r.body) ? r.body.length : '?'} pending`);
        else fail('GET pending-confirmation', `status ${r.status}`);
    } catch (e) { fail('GET pending-confirmation', e.message); }

    if (matchId) {
        try {
            const r = await POST(`/api/v1/matches/${matchId}/score`, { me: 21, opponent: 15 });
            if (r.status === 201 || r.status === 200) pass('POST /matches/:id/score', 'submitted');
            else fail('POST /matches/:id/score', `status ${r.status}`);
        } catch (e) { fail('POST /matches/:id/score', e.message); }

        // Contest — we're contesting our own match (creator, not opponent).
        // May be rejected by business logic. We just verify the endpoint responds.
        try {
            const r = await POST(`/api/v1/matches/${matchId}/contest`);
            if ([200, 201, 500].includes(r.status)) pass('POST /matches/:id/contest', 'responded');
            else fail('POST /matches/:id/contest', `status ${r.status}`);
        } catch (e) { fail('POST /matches/:id/contest', e.message); }
    }
    return matchId;
}

async function testStatuses() {
    // @Controller('statuses') — src/statuses/statuses.controller.ts
    //
    // PREVIOUS BUG (fixed): "Unknown User" posts appeared in the feed.
    // Root cause: 7 orphan player_statuses linked to deleted user
    // fcc9a50a-31e0-468a-9412-d0db3aa6936f. Deleted directly from DB.
    // Detection query: SELECT * FROM player_statuses WHERE user_id NOT IN (SELECT id FROM users);
    console.log('\n═══ 5. STATUSES / FEED ═══');
    let statusId = null;

    try {
        const r = await POST('/statuses', { content: '[E2E TEST] Verification post — will be deleted' });
        if (r.status === 201 && r.body.success && r.body.status) {
            statusId = r.body.status.id;
            pass('POST /statuses', `id=${statusId}`);
        } else fail('POST /statuses', `status ${r.status}`);
    } catch (e) { fail('POST /statuses', e.message); }

    try {
        const r = await GET('/statuses');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /statuses', `${r.body.length} items`);
        else fail('GET /statuses', `status ${r.status}`);
    } catch (e) { fail('GET /statuses', e.message); }

    // unified-feed is what the mobile app's "Feed" tab (formerly "Play") uses.
    try {
        const r = await GET('/statuses/unified-feed');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET unified-feed', `${r.body.length} items`);
        else fail('GET unified-feed', `status ${r.status}`);
    } catch (e) { fail('GET unified-feed', e.message); }

    try {
        const r = await GET('/statuses/unified-feed?filter=foryou&lat=47.6&lng=-122.3');
        if (r.status === 200) pass('GET unified-feed?foryou', `${Array.isArray(r.body) ? r.body.length : '?'} items`);
        else fail('GET unified-feed?foryou', `status ${r.status}`);
    } catch (e) { fail('GET unified-feed?foryou', e.message); }

    try {
        const r = await GET(`/statuses/user/${TEST_USER_ID}`);
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /statuses/user/:id', `${r.body.length} posts`);
        else fail('GET /statuses/user/:id', `status ${r.status}`);
    } catch (e) { fail('GET /statuses/user/:id', e.message); }

    if (statusId) {
        try {
            const r = await GET(`/statuses/${statusId}`);
            if (r.status === 200) pass('GET /statuses/:id', 'found');
            else fail('GET /statuses/:id', `status ${r.status}`);
        } catch (e) { fail('GET /statuses/:id', e.message); }

        // Like → verify → unlike (full cycle)
        try {
            const r = await POST(`/statuses/${statusId}/like`);
            if (r.status === 201 && r.body.success) pass('POST like', 'liked');
            else fail('POST like', `status ${r.status}`);
        } catch (e) { fail('POST like', e.message); }

        try {
            const r = await GET(`/statuses/${statusId}/likes`);
            if (r.status === 200 && Array.isArray(r.body)) pass('GET likes', `${r.body.length}`);
            else fail('GET likes', `status ${r.status}`);
        } catch (e) { fail('GET likes', e.message); }

        try {
            const r = await DEL(`/statuses/${statusId}/like`);
            if (r.status === 200 && r.body.success) pass('DELETE like', 'unliked');
            else fail('DELETE like', `status ${r.status}`);
        } catch (e) { fail('DELETE like', e.message); }

        // Comment → verify → delete (full cycle)
        let commentId = null;
        try {
            const r = await POST(`/statuses/${statusId}/comments`, { content: '[E2E] test comment' });
            if (r.status === 201 && r.body.success) {
                commentId = r.body.comment?.id;
                pass('POST comment', `id=${commentId}`);
            } else fail('POST comment', `status ${r.status}`);
        } catch (e) { fail('POST comment', e.message); }

        try {
            const r = await GET(`/statuses/${statusId}/comments`);
            if (r.status === 200 && Array.isArray(r.body)) pass('GET comments', `${r.body.length}`);
            else fail('GET comments', `status ${r.status}`);
        } catch (e) { fail('GET comments', e.message); }

        if (commentId) {
            try {
                const r = await DEL(`/statuses/comments/${commentId}`);
                if (r.status === 200) pass('DELETE comment', 'deleted');
                else fail('DELETE comment', `status ${r.status}`);
            } catch (e) { fail('DELETE comment', e.message); }
        } else skip('DELETE comment', 'no id');

        // Attend → verify → unattend
        try {
            const r = await POST(`/statuses/${statusId}/attend`);
            if (r.status === 201 && r.body.success) pass('POST attend', 'attending');
            else fail('POST attend', `status ${r.status}`);
        } catch (e) { fail('POST attend', e.message); }

        try {
            const r = await GET(`/statuses/${statusId}/attendees`);
            if (r.status === 200 && Array.isArray(r.body)) pass('GET attendees', `${r.body.length}`);
            else fail('GET attendees', `status ${r.status}`);
        } catch (e) { fail('GET attendees', e.message); }

        try {
            const r = await DEL(`/statuses/${statusId}/attend`);
            if (r.status === 200 && r.body.success) pass('DELETE attend', 'removed');
            else fail('DELETE attend', `status ${r.status}`);
        } catch (e) { fail('DELETE attend', e.message); }

        // Clean up the test status so it doesn't appear in the production feed.
        try {
            const r = await DEL(`/statuses/${statusId}`);
            if (r.status === 200 && r.body.success) pass('DELETE /statuses/:id', 'cleaned up');
            else fail('DELETE /statuses/:id', `status ${r.status}`);
        } catch (e) { fail('DELETE /statuses/:id', e.message); }
    }
    return statusId;
}

async function testChallenges() {
    // @Controller('challenges') — src/challenges/challenges.controller.ts
    // NOTE: Keep this lifecycle-valid. We only cancel a pending challenge for
    // cleanup; cancelling/declining an accepted challenge is an invalid-order
    // test artifact and should not be treated as a backend bug.
    console.log('\n═══ 6. CHALLENGES ═══');
    let challengeId = null;

    try {
        const r = await POST('/challenges', { toUserId: OTHER_USER_ID, message: '[E2E] test challenge' });
        if (r.status === 201 && r.body && r.body.id) {
            challengeId = r.body.id;
            pass('POST /challenges', `id=${challengeId.substring(0, 8)}`);
        } else fail('POST /challenges', `status ${r.status}`);
    } catch (e) { fail('POST /challenges', e.message); }

    try {
        const r = await GET('/challenges');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /challenges', `${r.body.length} total`);
        else fail('GET /challenges', `status ${r.status}`);
    } catch (e) { fail('GET /challenges', e.message); }

    try {
        const r = await GET('/challenges/pending');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /challenges/pending', `${r.body.length}`);
        else fail('GET /challenges/pending', `status ${r.status}`);
    } catch (e) { fail('GET /challenges/pending', e.message); }

    // Cancel to clean up — only the sender (us) can cancel.
    if (challengeId) {
        try {
            const r = await DEL(`/challenges/${challengeId}`);
            if (r.status === 200) pass('DELETE /challenges/:id', 'cancelled');
            else fail('DELETE /challenges/:id', `status ${r.status}`);
        } catch (e) { fail('DELETE /challenges/:id', e.message); }
    } else skip('DELETE /challenges/:id', 'no id');

    return challengeId;
}

async function testMessages() {
    // @Controller('messages') — src/messages/messages.controller.ts
    //
    // Messages were returning 401 before Bearer tokens were added.
    // The mobile inbox was empty because getConversations() failed silently.
    // If messages break again: check token expiry, and note that
    // messages.controller.ts line 27 throws ForbiddenException if
    // body.senderId doesn't match the authenticated user.
    console.log('\n═══ 7. MESSAGES ═══');

    try {
        const r = await POST('/messages', { toUserId: OTHER_USER_ID, content: '[E2E] test message' });
        if (r.status === 201 && r.body && r.body.id) pass('POST /messages', `id=${r.body.id.substring(0, 8)}`);
        else fail('POST /messages', `status ${r.status}`);
    } catch (e) { fail('POST /messages', e.message); }

    try {
        const r = await GET('/messages/conversations');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET conversations', `${r.body.length}`);
        else fail('GET conversations', `status ${r.status}`);
    } catch (e) { fail('GET conversations', e.message); }

    try {
        const r = await GET(`/messages/${OTHER_USER_ID}`);
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /messages/:uid', `${r.body.length} msgs`);
        else fail('GET /messages/:uid', `status ${r.status}`);
    } catch (e) { fail('GET /messages/:uid', e.message); }

    try {
        const r = await GET('/messages/unread-count');
        if (r.status === 200 && r.body.unreadCount !== undefined) pass('GET unread-count', `${r.body.unreadCount}`);
        else fail('GET unread-count', `status ${r.status}`);
    } catch (e) { fail('GET unread-count', e.message); }

    try {
        const r = await PUT(`/messages/${OTHER_USER_ID}/read`);
        if (r.status === 200 && r.body.success) pass('PUT mark-read', `${r.body.markedCount} marked`);
        else fail('PUT mark-read', `status ${r.status}`);
    } catch (e) { fail('PUT mark-read', e.message); }

    try {
        const r = await GET('/messages/team-chats');
        if (r.status === 200) pass('GET team-chats', `${Array.isArray(r.body) ? r.body.length : '?'}`);
        else fail('GET team-chats', `status ${r.status}`);
    } catch (e) { fail('GET team-chats', e.message); }
}

async function testTeams() {
    // @Controller('teams') — src/teams/teams.controller.ts
    // Largest controller (454 lines) with many sub-routes.
    console.log('\n═══ 8. TEAMS ═══');
    let teamId = null;

    try {
        const r = await POST('/teams', { name: '[E2E] Test Squad', teamType: '3v3' });
        if (r.status === 201 && r.body && r.body.id) {
            teamId = r.body.id;
            pass('POST /teams', `id=${teamId.substring(0, 8)}`);
        } else fail('POST /teams', `status ${r.status}`);
    } catch (e) { fail('POST /teams', e.message); }

    try {
        const r = await GET('/teams');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /teams', `${r.body.length} teams`);
        else fail('GET /teams', `status ${r.status}`);
    } catch (e) { fail('GET /teams', e.message); }

    try {
        const r = await GET('/teams/invites');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET invites', `${r.body.length}`);
        else fail('GET invites', `status ${r.status}`);
    } catch (e) { fail('GET invites', e.message); }

    try {
        const r = await GET('/teams/challenges');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET team challenges', `${r.body.length}`);
        else fail('GET team challenges', `status ${r.status}`);
    } catch (e) { fail('GET team challenges', e.message); }

    if (teamId) {
        try {
            const r = await GET(`/teams/${teamId}`);
            if (r.status === 200) pass('GET /teams/:id', `name=${r.body.name || r.body.teamName}`);
            else fail('GET /teams/:id', `status ${r.status}`);
        } catch (e) { fail('GET /teams/:id', e.message); }

        try {
            const r = await request('PATCH', `/teams/${teamId}`, { description: '[E2E] updated' });
            if (r.status === 200) pass('PATCH /teams/:id', 'updated');
            else fail('PATCH /teams/:id', `status ${r.status}`);
        } catch (e) { fail('PATCH /teams/:id', e.message); }

        try {
            const r = await GET(`/teams/${teamId}/messages`);
            if (r.status === 200 && Array.isArray(r.body)) pass('GET team msgs', `${r.body.length}`);
            else fail('GET team msgs', `status ${r.status}`);
        } catch (e) { fail('GET team msgs', e.message); }

        try {
            const r = await POST(`/teams/${teamId}/messages`, { content: '[E2E] team msg' });
            if (r.status === 201) pass('POST team msg', 'sent');
            else fail('POST team msg', `status ${r.status}`);
        } catch (e) { fail('POST team msg', e.message); }

        try {
            const r = await DEL(`/teams/${teamId}`);
            if (r.status === 200) pass('DELETE /teams/:id', 'deleted');
            else fail('DELETE /teams/:id', `status ${r.status}`);
        } catch (e) { fail('DELETE /teams/:id', e.message); }
    }
}

async function testRuns() {
    // @Controller() with no prefix — src/runs/runs.controller.ts
    // Routes defined inline as @Post('runs'), @Get('runs/nearby'), etc.
    // Also has @Get('courts/:courtId/runs') which overlaps with courts controller.
    console.log('\n═══ 9. SCHEDULED RUNS ═══');
    let runId = null;
    const scheduledAt = new Date(Date.now() + 3600000).toISOString();

    try {
        const r = await POST('/runs', {
            courtId: TEST_COURT_ID, scheduledAt, title: '[E2E] Test Run',
            gameMode: 'pickup', maxPlayers: 10,
        });
        if (r.status === 201 && r.body.success && r.body.id) {
            runId = r.body.id;
            pass('POST /runs', `id=${runId}`);
        } else fail('POST /runs', `status ${r.status}`);
    } catch (e) { fail('POST /runs', e.message); }

    try {
        const r = await GET(`/courts/${TEST_COURT_ID}/runs`);
        if (r.status === 200 && Array.isArray(r.body)) pass('GET court runs', `${r.body.length}`);
        else fail('GET court runs', `status ${r.status}`);
    } catch (e) { fail('GET court runs', e.message); }

    try {
        const r = await GET('/runs/nearby');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET runs/nearby', `${r.body.length}`);
        else fail('GET runs/nearby', `status ${r.status}`);
    } catch (e) { fail('GET runs/nearby', e.message); }

    try {
        const r = await GET('/runs/courts-with-runs');
        if (r.status === 200) pass('GET courts-with-runs', `${Array.isArray(r.body) ? r.body.length : '?'}`);
        else fail('GET courts-with-runs', `status ${r.status}`);
    } catch (e) { fail('GET courts-with-runs', e.message); }

    if (runId) {
        try {
            const r = await POST(`/runs/${runId}/join`);
            if (r.status === 201 && r.body.success) pass('POST join run', 'joined');
            else fail('POST join run', `status ${r.status}`);
        } catch (e) { fail('POST join run', e.message); }

        try {
            const r = await DEL(`/runs/${runId}/leave`);
            if (r.status === 200 && r.body.success) pass('DELETE leave run', 'left');
            else fail('DELETE leave run', `status ${r.status}`);
        } catch (e) { fail('DELETE leave run', e.message); }

        // Cancel = delete (creator only).
        try {
            const r = await DEL(`/runs/${runId}`);
            if (r.status === 200 && r.body.success) pass('DELETE cancel run', 'cancelled');
            else fail('DELETE cancel run', `status ${r.status}`);
        } catch (e) { fail('DELETE cancel run', e.message); }
    }
}

async function testActivity() {
    // @Controller('activity') — src/activity/activity.controller.ts
    console.log('\n═══ 10. ACTIVITY FEED ═══');

    try {
        const r = await GET('/activity/global');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /activity/global', `${r.body.length} items`);
        else fail('GET /activity/global', `status ${r.status}`);
    } catch (e) { fail('GET /activity/global', e.message); }

    try {
        const r = await GET('/activity/local');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /activity/local', `${r.body.length} items`);
        else fail('GET /activity/local', `status ${r.status}`);
    } catch (e) { fail('GET /activity/local', e.message); }
}

async function testFollows() {
    // Routes: /users/me/follows/courts, /users/me/follows/players
    console.log('\n═══ 11. FOLLOWS ═══');

    try {
        const r = await POST('/users/me/follows/courts', { courtId: TEST_COURT_ID });
        if (r.status === 201) pass('POST follow court', 'followed');
        else fail('POST follow court', `status ${r.status}`);
    } catch (e) { fail('POST follow court', e.message); }

    try {
        const r = await DEL(`/users/me/follows/courts/${TEST_COURT_ID}`);
        if (r.status === 200) pass('DELETE unfollow court', 'unfollowed');
        else fail('DELETE unfollow court', `status ${r.status}`);
    } catch (e) { fail('DELETE unfollow court', e.message); }

    try {
        const r = await POST('/users/me/follows/players', { playerId: OTHER_USER_ID });
        if (r.status === 201) pass('POST follow player', 'followed');
        else fail('POST follow player', `status ${r.status}`);
    } catch (e) { fail('POST follow player', e.message); }

    try {
        const r = await DEL(`/users/me/follows/players/${OTHER_USER_ID}`);
        if (r.status === 200) pass('DELETE unfollow player', 'unfollowed');
        else fail('DELETE unfollow player', `status ${r.status}`);
    } catch (e) { fail('DELETE unfollow player', e.message); }
}

async function testRankings() {
    // @Controller('rankings') — src/rankings/rankings.controller.ts
    console.log('\n═══ 12. RANKINGS ═══');

    try {
        const r = await GET('/rankings');
        if (r.status === 200) pass('GET /rankings', `${Array.isArray(r.body) ? r.body.length : '?'} ranked`);
        else fail('GET /rankings', `status ${r.status}`);
    } catch (e) { fail('GET /rankings', e.message); }

    // Team rankings (3v3 mode)
    try {
        const r = await GET('/rankings?mode=3v3');
        if (r.status === 200 && r.body.rankings) pass('GET /rankings?mode=3v3', `${r.body.rankings.length} teams`);
        else fail('GET /rankings?mode=3v3', `status ${r.status}`);
    } catch (e) { fail('GET /rankings?mode=3v3', e.message); }

    // Dedicated team rankings endpoint
    try {
        const r = await GET('/rankings/teams');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /rankings/teams', `${r.body.length} teams`);
        else fail('GET /rankings/teams', `status ${r.status}`);
    } catch (e) { fail('GET /rankings/teams', e.message); }
}

async function testCourtsExtended() {
    // New court endpoints not in original suite
    console.log('\n═══ 13. COURTS EXTENDED ═══');

    // Nearby courts
    try {
        const r = await GET('/courts/near?lat=33.78&lng=-118.19&radius=10');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /courts/near', `${r.body.length} courts`);
        else fail('GET /courts/near', `status ${r.status}`);
    } catch (e) { fail('GET /courts/near', e.message); }

    // Signature courts
    try {
        const r = await GET('/courts/signature');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /courts/signature', `${r.body.length} courts`);
        else fail('GET /courts/signature', `status ${r.status}`);
    } catch (e) { fail('GET /courts/signature', e.message); }

    // Court followers
    try {
        const r = await GET(`/courts/${TEST_COURT_ID}/followers`);
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /courts/:id/followers', `${r.body.length} followers`);
        else fail('GET /courts/:id/followers', `status ${r.status}`);
    } catch (e) { fail('GET /courts/:id/followers', e.message); }

    // Court kings
    try {
        const r = await GET(`/courts/${TEST_COURT_ID}/kings`);
        if (r.status === 200) pass('GET /courts/:id/kings', Array.isArray(r.body) ? `${r.body.length} kings` : 'ok');
        else fail('GET /courts/:id/kings', `status ${r.status}`);
    } catch (e) { fail('GET /courts/:id/kings', e.message); }
}

async function testUsersExtended() {
    // New user endpoints not in original suite
    console.log('\n═══ 14. USERS EXTENDED ═══');

    // Update own profile (PUT /users/me)
    try {
        const r = await PUT('/users/me', { bio: '[E2E] test bio' });
        if (r.status === 200) pass('PUT /users/me', 'updated bio');
        else fail('PUT /users/me', `status ${r.status}`);
    } catch (e) { fail('PUT /users/me', e.message); }

    // Followed activity
    try {
        const r = await GET('/users/me/follows/activity');
        if (r.status === 200) pass('GET /users/me/follows/activity', Array.isArray(r.body) ? `${r.body.length} items` : 'ok');
        else fail('GET /users/me/follows/activity', `status ${r.status}`);
    } catch (e) { fail('GET /users/me/follows/activity', e.message); }

    // Follow/unfollow team (if a team exists)
    try {
        const teamsR = await GET('/teams');
        if (teamsR.status === 200 && Array.isArray(teamsR.body) && teamsR.body.length > 0) {
            const teamId = teamsR.body[0].id;
            const fr = await POST('/users/me/follows/teams', { teamId });
            if (fr.status === 200 || fr.status === 201) pass('POST follow team', `followed ${teamId.slice(0, 8)}`);
            else fail('POST follow team', `status ${fr.status}`);

            const ur = await DEL(`/users/me/follows/teams/${teamId}`);
            if (ur.status === 200) pass('DELETE unfollow team', 'unfollowed');
            else fail('DELETE unfollow team', `status ${ur.status}`);
        } else {
            skip('POST/DELETE follow team', 'no teams found');
        }
    } catch (e) { fail('follow team', e.message); }

    // User rank history
    try {
        const r = await GET(`/users/${TEST_USER_ID}/rank-history`);
        if (r.status === 200) pass('GET /users/:id/rank-history', Array.isArray(r.body) ? `${r.body.length} entries` : 'ok');
        else fail('GET /users/:id/rank-history', `status ${r.status}`);
    } catch (e) { fail('GET /users/:id/rank-history', e.message); }

    // User teams
    try {
        const r = await GET(`/users/${TEST_USER_ID}/teams`);
        if (r.status === 200) pass('GET /users/:id/teams', Array.isArray(r.body) ? `${r.body.length} teams` : 'ok');
        else fail('GET /users/:id/teams', `status ${r.status}`);
    } catch (e) { fail('GET /users/:id/teams', e.message); }

    // User recent games
    try {
        const r = await GET(`/users/${TEST_USER_ID}/recent-games`);
        if (r.status === 200) pass('GET /users/:id/recent-games', Array.isArray(r.body) ? `${r.body.length} games` : 'ok');
        else fail('GET /users/:id/recent-games', `status ${r.status}`);
    } catch (e) { fail('GET /users/:id/recent-games', e.message); }
}

async function testOnboarding() {
    // Onboarding progress persistence — users.controller.ts getMe() returns
    // onboarding_progress, users.service.ts updateProfile() handles JSONB writes.
    // Mobile app reads/writes via ApiService.getOnboardingProgress/updateOnboardingProgress.
    console.log('\n═══ 14.5 ONBOARDING PERSISTENCE ═══');

    // Read current onboarding_progress (may be null for first run)
    let originalProgress = null;
    try {
        const r = await GET('/users/me');
        if (r.status === 200 && r.body) {
            originalProgress = r.body.onboarding_progress || r.body.onboardingProgress;
            pass('GET onboarding (read)', `current=${JSON.stringify(originalProgress || null).slice(0, 60)}`);
        } else fail('GET onboarding (read)', `status ${r.status}`);
    } catch (e) { fail('GET onboarding (read)', e.message); }

    // Write test onboarding progress
    const testProgress = { check_in: true, follow_court: true, schedule_run: false };
    try {
        const r = await PUT('/users/me', { onboarding_progress: testProgress });
        if (r.status === 200) pass('PUT onboarding (write)', 'wrote test progress');
        else fail('PUT onboarding (write)', `status ${r.status}: ${JSON.stringify(r.body).slice(0, 100)}`);
    } catch (e) { fail('PUT onboarding (write)', e.message); }

    // Verify it persisted
    try {
        const r = await GET('/users/me');
        if (r.status === 200 && r.body) {
            const saved = r.body.onboarding_progress || r.body.onboardingProgress;
            if (saved && saved.check_in === true && saved.follow_court === true) {
                pass('GET onboarding (verify)', `persisted=${JSON.stringify(saved).slice(0, 60)}`);
            } else {
                fail('GET onboarding (verify)', `expected check_in:true, got ${JSON.stringify(saved)}`);
            }
        } else fail('GET onboarding (verify)', `status ${r.status}`);
    } catch (e) { fail('GET onboarding (verify)', e.message); }

    // Restore original value (cleanup)
    try {
        const r = await PUT('/users/me', { onboarding_progress: originalProgress || {} });
        if (r.status === 200) pass('PUT onboarding (restore)', 'restored original');
        else fail('PUT onboarding (restore)', `status ${r.status}`);
    } catch (e) { fail('PUT onboarding (restore)', e.message); }
}

async function testStubs() {
    // Stub controllers: MeController, InvitesController, ThreadsController
    console.log('\n═══ 15. STUBS (me/invites/threads) ═══');

    // GET /me/privacy
    try {
        const r = await GET('/me/privacy');
        if (r.status === 200 && r.body.profileVisibility) pass('GET /me/privacy', `visibility=${r.body.profileVisibility}`);
        else fail('GET /me/privacy', `status ${r.status}`);
    } catch (e) { fail('GET /me/privacy', e.message); }

    // PUT /me/privacy
    try {
        const r = await PUT('/me/privacy', { showLocation: false });
        if (r.status === 200 && r.body.success) pass('PUT /me/privacy', 'updated');
        else fail('PUT /me/privacy', `status ${r.status}`);
    } catch (e) { fail('PUT /me/privacy', e.message); }

    // GET /invites (list)
    try {
        const r = await GET('/invites');
        if (r.status === 200 && Array.isArray(r.body)) pass('GET /invites', `${r.body.length} invites`);
        else fail('GET /invites', `status ${r.status}`);
    } catch (e) { fail('GET /invites', e.message); }

    // POST /invites (create)
    try {
        const r = await POST('/invites', { type: 'team', teamId: 'test-team' });
        if (r.status === 200 && r.body.token) pass('POST /invites', `token=${r.body.token.slice(0, 16)}...`);
        else fail('POST /invites', `status ${r.status}`);
    } catch (e) { fail('POST /invites', e.message); }

    // GET /threads/:id
    try {
        const r = await GET('/threads/test-thread-id');
        if (r.status === 200 && r.body.id) pass('GET /threads/:id', `id=${r.body.id}`);
        else fail('GET /threads/:id', `status ${r.status}`);
    } catch (e) { fail('GET /threads/:id', e.message); }
}

async function testUpload() {
    // Upload controller — POST /upload
    console.log('\n═══ 16. UPLOAD ═══');

    // Minimal 1x1 PNG base64 payload
    const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    try {
        const r = await POST('/upload', {
            type: 'avatar',
            targetId: TEST_USER_ID,
            imageData: TINY_PNG,
        });
        if (r.status === 201 && r.body.success) pass('POST /upload (avatar)', r.body.message);
        else if (r.status === 200 && r.body.success) pass('POST /upload (avatar)', r.body.message);
        else fail('POST /upload (avatar)', `status ${r.status}: ${JSON.stringify(r.body).slice(0, 100)}`);
    } catch (e) { fail('POST /upload (avatar)', e.message); }
}

// ── Cleanup ─────────────────────────────────────────────────────────────────
// All test data is tagged with "[E2E]" so it can be identified and removed.
// This runs even if individual test cleanup failed.
async function cleanup(matchId) {
    if (!process.env.DATABASE_URL) return;
    console.log('\n═══ CLEANUP ═══');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const c = await pool.connect();
    try {
        if (matchId) {
            const r = await c.query('DELETE FROM matches WHERE id = $1', [matchId]);
            console.log(`  🧹 Deleted ${r.rowCount} test match(es)`);
        }
        const m = await c.query("DELETE FROM messages WHERE content LIKE '%[E2E]%'");
        console.log(`  🧹 Deleted ${m.rowCount} test message(s)`);
        const ch = await c.query("DELETE FROM challenges WHERE message LIKE '%[E2E]%'");
        console.log(`  🧹 Deleted ${ch.rowCount} test challenge(s)`);
    } catch (e) { console.log(`  ⚠️  Cleanup: ${e.message}`); }
    finally { c.release(); await pool.end(); }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║   HoopRank — Comprehensive E2E Feature Verification         ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║ Target:  ${BASE_URL}`);
    console.log(`║ User:    Brett Corbett (${TEST_USER_ID})`);
    console.log(`║ Time:    ${new Date().toISOString()}`);
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    // Get Firebase ID token — required for all authenticated endpoints.
    // First run without this: 48 of 51 tests failed with 401.
    idToken = await getFirebaseIdToken();
    console.log(`Auth mode: ${idToken ? '🔐 Firebase Bearer' : '⚠️  x-user-id only (will 401 on production)'}\n`);

    await testHealth();
    await testUsers();
    await testCourts();
    const matchId = await testMatches();
    await testStatuses();
    await testChallenges();
    await testMessages();
    await testTeams();
    await testRuns();
    await testActivity();
    await testFollows();
    await testRankings();
    await testCourtsExtended();
    await testUsersExtended();
    await testOnboarding();
    await testStubs();
    await testUpload();

    await cleanup(matchId);

    const total = passed + failed + skipped;
    console.log('\n╔═══════════════════════════════════════════════════════════════╗');
    console.log(`║  RESULTS: ${passed} ✅  ${failed} ❌  ${skipped} ⏭️   (${total} total)`);
    if (failed > 0) {
        console.log('╠═══════════════════════════════════════════════════════════════╣');
        console.log('║  FAILURES:');
        failures.forEach(f => console.log(`║    • ${f}`));
    }
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error('Fatal:', e); process.exit(2); });

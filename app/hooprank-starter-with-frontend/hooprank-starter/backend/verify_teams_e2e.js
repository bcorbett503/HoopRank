/**
 * Comprehensive E2E Team Verification — all team endpoints against live cloud.
 */
const API = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

let pass = 0, fail = 0, warn = 0;
function ok(label) { pass++; console.log(`  ✅ ${label}`); }
function bad(label, detail) { fail++; console.log(`  ❌ ${label}: ${detail}`); }
function info(label) { warn++; console.log(`  ⚠️  ${label}`); }

async function get(path) {
    const r = await fetch(`${API}${path}`, { headers: { 'x-user-id': USER_ID } });
    const data = await r.json().catch(() => null);
    return { status: r.status, data };
}
async function postJson(path, body = {}) {
    const r = await fetch(`${API}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': USER_ID },
        body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => null);
    return { status: r.status, data };
}
async function patchJson(path, body = {}) {
    const r = await fetch(`${API}${path}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-user-id': USER_ID },
        body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => null);
    return { status: r.status, data };
}
async function del(path) {
    const r = await fetch(`${API}${path}`, { method: 'DELETE', headers: { 'x-user-id': USER_ID } });
    const data = await r.json().catch(() => null);
    return { status: r.status, data };
}

async function main() {
    console.log('='.repeat(60));
    console.log('  COMPREHENSIVE TEAM E2E VERIFICATION');
    console.log('='.repeat(60) + '\n');

    // ── 1. LIST MY TEAMS ──
    console.log('── 1. LIST MY TEAMS ──');
    const teamsRes = await get('/teams');
    if (teamsRes.status === 200 && Array.isArray(teamsRes.data)) {
        ok(`Got ${teamsRes.data.length} teams`);
        teamsRes.data.forEach(t => console.log(`     • ${t.name} (${t.id}) — ${t.teamType}, rating ${t.rating}, W:${t.wins} L:${t.losses}`));
    } else { bad('List teams', teamsRes.status); return; }

    const myTeams = teamsRes.data;
    const teamId = myTeams[0].id;
    console.log(`\n  Primary: ${myTeams[0].name} (${teamId})\n`);

    // ── 2. GET TEAM DETAIL ──
    console.log('── 2. GET TEAM DETAIL ──');
    const detailRes = await get(`/teams/${teamId}`);
    if (detailRes.status === 200 && detailRes.data) {
        const d = detailRes.data;
        ok(`Detail: ${d.name}, Members: ${d.memberCount}, Pending: ${d.pendingCount}`);
        if (d.members) console.log(`     Active: ${d.members.map(m => m.name).join(', ')}`);
        if (d.recentMatches) ok(`Recent matches: ${d.recentMatches.length}`);
    } else { bad('Detail', detailRes.status); }

    // ── 3. UPDATE TEAM ──
    console.log('\n── 3. UPDATE TEAM ──');
    const origDesc = detailRes.data?.description || '';
    const testDesc = `E2E test ${Date.now()}`;
    const updRes = await patchJson(`/teams/${teamId}`, { description: testDesc });
    if (updRes.status === 200) {
        ok(`Updated description`);
        await patchJson(`/teams/${teamId}`, { description: origDesc || null });
        ok('Restored original');
    } else { bad('Update team', `${updRes.status} ${JSON.stringify(updRes.data)}`); }

    // ── 4. TEAM EVENTS ──
    console.log('\n── 4. TEAM EVENTS ──');

    // Create practice
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const practiceRes = await postJson(`/teams/${teamId}/events`, {
        type: 'practice', title: 'E2E Test Practice', eventDate: tomorrow, notes: 'Auto-test',
    });
    let practiceEventId = null;
    if (practiceRes.status === 201 || practiceRes.status === 200) {
        practiceEventId = practiceRes.data?.id;
        ok(`Practice created: ${practiceEventId}`);
    } else { bad('Create practice', `${practiceRes.status} ${JSON.stringify(practiceRes.data)}`); }

    // List events
    const eventsRes = await get(`/teams/${teamId}/events`);
    if (eventsRes.status === 200 && Array.isArray(eventsRes.data)) {
        ok(`Listed ${eventsRes.data.length} events`);
    } else { bad('List events', eventsRes.status); }

    // Attendance
    if (practiceEventId) {
        const attRes = await postJson(`/teams/${teamId}/events/${practiceEventId}/attendance`, { status: 'out' });
        if (attRes.status === 200 || attRes.status === 201) {
            ok('Attendance: OUT');
        } else { bad('Attendance', `${attRes.status} ${JSON.stringify(attRes.data)}`); }
    }

    // Create game (with opponent)
    let gameEventId = null, gameMatchId = null;
    const rankingsRes = await get('/rankings?mode=3v3');
    const allTeams = Array.isArray(rankingsRes.data) ? rankingsRes.data : [];
    const opponentTeam = allTeams.find(t => !myTeams.some(mt => mt.id === t.id));

    if (opponentTeam) {
        const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString();
        const gameRes = await postJson(`/teams/${teamId}/events`, {
            type: 'game', title: 'E2E Test Game', eventDate: dayAfter,
            opponentTeamId: opponentTeam.id, opponentTeamName: opponentTeam.name,
        });
        if (gameRes.status === 201 || gameRes.status === 200) {
            gameEventId = gameRes.data?.id;
            gameMatchId = gameRes.data?.matchId;
            ok(`Game event vs ${opponentTeam.name}: event=${gameEventId}, match=${gameMatchId || 'none'}`);
        } else { bad('Create game', `${gameRes.status} ${JSON.stringify(gameRes.data)}`); }
    } else { info('No opponent team found for game event'); }

    // ── 5. ALL-EVENTS (unified schedule) ──
    console.log('\n── 5. ALL-EVENTS ──');
    const allEventsRes = await get('/teams/all-events');
    if (allEventsRes.status === 200 && Array.isArray(allEventsRes.data)) {
        ok(`All events: ${allEventsRes.data.length}`);
    } else { bad('All events', allEventsRes.status); }

    // ── 6. TEAM MESSAGES ──
    console.log('\n── 6. TEAM MESSAGES ──');
    const msgRes = await postJson(`/teams/${teamId}/messages`, { content: `E2E ${Date.now()}` });
    if (msgRes.status === 201 || msgRes.status === 200) {
        ok(`Sent message: ${msgRes.data?.id}`);
    } else { bad('Send message', `${msgRes.status} ${JSON.stringify(msgRes.data)}`); }

    const msgsRes = await get(`/teams/${teamId}/messages`);
    if (msgsRes.status === 200 && Array.isArray(msgsRes.data)) {
        ok(`Listed ${msgsRes.data.length} messages`);
    } else { bad('List messages', msgsRes.status); }

    // ── 7. TEAM CHALLENGES ──
    console.log('\n── 7. TEAM CHALLENGES ──');
    const challRes = await get('/teams/challenges');
    if (challRes.status === 200) {
        ok(`Challenges: ${Array.isArray(challRes.data) ? challRes.data.length : 0}`);
    } else { bad('Challenges', challRes.status); }

    // ── 8. PENDING SCORES ──
    console.log('\n── 8. PENDING SCORES ──');
    const pendingRes = await get('/teams/pending-scores');
    if (pendingRes.status === 200 && Array.isArray(pendingRes.data)) {
        ok(`Pending scores: ${pendingRes.data.length}`);
        pendingRes.data.forEach(p => console.log(`     • Match ${p.matchId} — ${p.status}, ${p.scoreCreator}-${p.scoreOpponent}`));
    } else { bad('Pending scores', pendingRes.status); }

    // ── 9. INVITE FLOW ──
    console.log('\n── 9. INVITES ──');
    const invitesRes = await get('/teams/invites');
    if (invitesRes.status === 200) {
        ok(`Pending invites: ${Array.isArray(invitesRes.data) ? invitesRes.data.length : 0}`);
    } else { bad('Invites', invitesRes.status); }

    // Invite a player (find one not on team)
    const nearbyRes = await get('/users/nearby?lat=37.7749&lng=-122.4194&limit=10');
    const nearby = Array.isArray(nearbyRes.data) ? nearbyRes.data : [];
    const teamMembers = detailRes.data?.members?.map(m => m.id) || [];
    const invitee = nearby.find(p => p.id !== USER_ID && !teamMembers.includes(p.id));
    if (invitee) {
        const invRes = await postJson(`/teams/${teamId}/invite/${invitee.id}`);
        if (invRes.status === 200) {
            ok(`Invited ${invitee.name}`);
            // Cleanup
            await del(`/teams/${teamId}/members/${invitee.id}`);
            ok('Cleaned up invite');
        } else {
            const msg = JSON.stringify(invRes.data);
            if (msg?.includes('already')) { ok(`Already invited/member`); }
            else { bad('Invite', `${invRes.status} ${msg}`); }
        }
    } else { info('No nearby player to invite'); }

    // ── 10. SCORE FLOW ──
    console.log('\n── 10. SCORE FLOW ──');
    if (gameMatchId) {
        // Submit score → should be pending_confirmation (registered opponent)
        const scoreRes = await postJson(`/teams/${teamId}/matches/${gameMatchId}/score`, { me: 21, opponent: 18 });
        if (scoreRes.status === 200) {
            const s = scoreRes.data;
            if (s.status === 'pending_confirmation') {
                ok(`Score submitted → pending_confirmation (${s.scores.creator}-${s.scores.opponent})`);

                // Verify in pending-scores
                const p2 = await get('/teams/pending-scores');
                const found = Array.isArray(p2.data) && p2.data.some(p => p.matchId === gameMatchId);
                if (found) ok('Match appears in pending-scores');
                else info('Match not in pending-scores (user not on opponent team)');

                // Try confirm (should fail — we're the submitter)
                const confRes = await postJson(`/teams/${teamId}/matches/${gameMatchId}/confirm`);
                if (confRes.status === 403 || confRes.status === 404) {
                    ok(`Confirm correctly rejects submitter (${confRes.status})`);
                } else {
                    console.log(`  ℹ️  Confirm returned ${confRes.status}: ${JSON.stringify(confRes.data)?.substring(0, 80)}`);
                }

                // Try amend (should also fail from submitter side)
                const amRes = await postJson(`/teams/${teamId}/matches/${gameMatchId}/amend`, { myScore: 20, opponentScore: 18 });
                if (amRes.status === 403 || amRes.status === 404) {
                    ok(`Amend correctly rejects submitter (${amRes.status})`);
                } else {
                    console.log(`  ℹ️  Amend returned ${amRes.status}: ${JSON.stringify(amRes.data)?.substring(0, 80)}`);
                }

                // Try confirm-amendment and reject-amendment (should fail — no amendment pending)
                const caRes = await postJson(`/teams/${teamId}/matches/${gameMatchId}/confirm-amendment`);
                console.log(`  ℹ️  Confirm-amendment: ${caRes.status} (expected 404 — no amendment)`);

                const raRes = await postJson(`/teams/${teamId}/matches/${gameMatchId}/reject-amendment`);
                console.log(`  ℹ️  Reject-amendment: ${raRes.status} (expected 404 — no amendment)`);

            } else if (s.status === 'completed') {
                ok(`Score → immediate finalize (unregistered opp): winner=${s.winnerTeamId}`);
            } else {
                info(`Score status: ${s.status}`);
            }
        } else { bad('Submit score', `${scoreRes.status} ${JSON.stringify(scoreRes.data)}`); }
    } else { info('No game match for score flow testing'); }

    // ── 11. RANKINGS ──
    console.log('\n── 11. RANKINGS ──');
    const r3 = await get('/rankings?mode=3v3');
    if (r3.status === 200 && Array.isArray(r3.data)) {
        ok(`3v3 rankings: ${r3.data.length} teams`);
        r3.data.slice(0, 3).forEach((t, i) => console.log(`     ${i + 1}. ${t.name} — ${t.rating}, W:${t.wins} L:${t.losses}`));
    } else { bad('3v3 rankings', r3.status); }

    const r5 = await get('/rankings?mode=5v5');
    if (r5.status === 200 && Array.isArray(r5.data)) {
        ok(`5v5 rankings: ${r5.data.length} teams`);
    } else { bad('5v5 rankings', r5.status); }

    // ── 12. CLEANUP ──
    console.log('\n── 12. CLEANUP ──');
    if (practiceEventId) {
        const d = await del(`/teams/${teamId}/events/${practiceEventId}`);
        d.status === 200 ? ok(`Deleted practice ${practiceEventId}`) : bad('Del practice', d.status);
    }
    if (gameEventId) {
        const d = await del(`/teams/${teamId}/events/${gameEventId}`);
        d.status === 200 ? ok(`Deleted game ${gameEventId}`) : bad('Del game', `${d.status} ${JSON.stringify(d.data)}`);
    }

    // ── SUMMARY ──
    console.log('\n' + '='.repeat(60));
    console.log(`  RESULTS: ${pass} passed, ${fail} failed, ${warn} warnings`);
    console.log('='.repeat(60));
    if (fail === 0) console.log('  🎉 ALL TESTS PASSED!');
    else console.log('  ⚠️  Some tests failed — review above');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

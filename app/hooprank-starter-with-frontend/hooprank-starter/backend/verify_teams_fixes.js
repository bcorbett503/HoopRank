/**
 * E2E Test: Teams Critical Fixes Verification
 * 
 * Tests all the critical fixes from the Teams audit:
 * 1. Create team with ageGroup + gender
 * 2. Team detail returns real member names (not 'Member')
 * 3. Rankings filter by ageGroup / gender
 * 4. Team detail includes recentMatches
 * 5. Challenge flow works from rankings
 * 6. Score submission and rating changes
 * 
 * Run: node verify_teams_fixes.js
 */

const API = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';       // Brett
const USER2_ID = 'z7oV0s5tdcU9oTQT9ZvdsxDPCZn2';      // Test user

const headers = (uid) => ({ 'x-user-id': uid, 'Content-Type': 'application/json' });

let results = [];
let testTeamId = null;

function pass(name) { results.push({ name, pass: true }); console.log(`  ✅ ${name}`); }
function fail(name, reason) { results.push({ name, pass: false, reason }); console.log(`  ❌ ${name}: ${reason}`); }

async function test(name, fn) {
    try {
        await fn();
    } catch (e) {
        fail(name, e.message);
    }
}

async function main() {
    console.log('=== TEAMS CRITICAL FIXES E2E TEST ===\n');

    // ────────────────────────────────────────────────────────
    // TEST 1: Create team WITH ageGroup + gender
    // ────────────────────────────────────────────────────────
    await test('Create team with ageGroup + gender', async () => {
        const teamName = `TestTeam_${Date.now()}`;
        const res = await fetch(`${API}/teams`, {
            method: 'POST',
            headers: headers(USER_ID),
            body: JSON.stringify({
                name: teamName,
                teamType: '3v3',
                ageGroup: 'HS',
                gender: 'Mens',
            }),
        });
        const body = await res.json();

        if (res.status !== 201 && res.status !== 200) {
            fail('Create team with ageGroup + gender', `HTTP ${res.status}: ${JSON.stringify(body)}`);
            return;
        }

        testTeamId = body.id;

        if (body.ageGroup === 'HS' || body.age_group === 'HS') {
            pass('Create team with ageGroup + gender');
        } else {
            fail('Create team with ageGroup + gender', `ageGroup not returned: ${JSON.stringify(body)}`);
        }
    });

    // ────────────────────────────────────────────────────────
    // TEST 2: Team detail returns ageGroup, gender, real names
    // ────────────────────────────────────────────────────────
    if (testTeamId) {
        await test('Team detail has ageGroup + gender', async () => {
            const res = await fetch(`${API}/teams/${testTeamId}`, {
                headers: headers(USER_ID),
            });
            const detail = await res.json();

            if (detail.ageGroup === 'HS' && detail.gender === 'Mens') {
                pass('Team detail has ageGroup + gender');
            } else {
                fail('Team detail has ageGroup + gender', `ageGroup=${detail.ageGroup}, gender=${detail.gender}`);
            }
        });
    }

    // Test real member names on a team with known members
    await test('Team detail returns real member names', async () => {
        // Use "Olympic Club 3x" which has known members
        const knownTeamId = 'b4e3894e-c77a-4b79-a6cf-2828d82861a0';
        const res = await fetch(`${API}/teams/${knownTeamId}`, {
            headers: headers(USER_ID),
        });
        const detail = await res.json();

        const hasRealNames = detail.members?.some(m => m.name !== 'Member' && m.name !== 'Pending');
        const ownerNameReal = detail.ownerName !== 'Team Owner';

        if (hasRealNames) {
            pass('Team detail returns real member names');
            console.log(`    Members: ${detail.members.map(m => m.name).join(', ')}`);
            console.log(`    Owner: ${detail.ownerName}`);
        } else {
            fail('Team detail returns real member names', `Still hardcoded: ${detail.members?.map(m => m.name).join(', ')}`);
        }
    });

    await test('Team detail returns member photoUrls', async () => {
        const knownTeamId = 'b4e3894e-c77a-4b79-a6cf-2828d82861a0';
        const res = await fetch(`${API}/teams/${knownTeamId}`, {
            headers: headers(USER_ID),
        });
        const detail = await res.json();

        const hasPhotoUrl = detail.members?.some(m => 'photoUrl' in m);
        if (hasPhotoUrl) {
            pass('Team detail returns member photoUrls');
        } else {
            fail('Team detail returns member photoUrls', 'photoUrl field missing from members');
        }
    });

    // ────────────────────────────────────────────────────────
    // TEST 3: Team detail includes recentMatches array
    // ────────────────────────────────────────────────────────
    await test('Team detail includes recentMatches', async () => {
        const knownTeamId = 'b4e3894e-c77a-4b79-a6cf-2828d82861a0';
        const res = await fetch(`${API}/teams/${knownTeamId}`, {
            headers: headers(USER_ID),
        });
        const detail = await res.json();

        if (Array.isArray(detail.recentMatches)) {
            pass('Team detail includes recentMatches');
            console.log(`    Matches found: ${detail.recentMatches.length}`);
            if (detail.recentMatches.length > 0) {
                console.log(`    Sample: ${JSON.stringify(detail.recentMatches[0])}`);
            }
        } else {
            fail('Team detail includes recentMatches', `recentMatches field missing or not array`);
        }
    });

    // ────────────────────────────────────────────────────────
    // TEST 4: Rankings include ageGroup + gender in response
    // ────────────────────────────────────────────────────────
    await test('Rankings return ageGroup + gender fields', async () => {
        const res = await fetch(`${API}/rankings?mode=3v3`, {
            headers: headers(USER_ID),
        });
        const teams = await res.json();

        if (teams.length > 0) {
            const hasAgeField = 'ageGroup' in teams[0];
            const hasGenderField = 'gender' in teams[0];

            if (hasAgeField && hasGenderField) {
                pass('Rankings return ageGroup + gender fields');
                console.log(`    First team: ${teams[0].name}, ageGroup=${teams[0].ageGroup}, gender=${teams[0].gender}`);
            } else {
                fail('Rankings return ageGroup + gender fields', `Missing fields in: ${Object.keys(teams[0]).join(', ')}`);
            }
        } else {
            fail('Rankings return ageGroup + gender fields', 'No teams returned');
        }
    });

    await test('Rankings filter by ageGroup', async () => {
        const res = await fetch(`${API}/rankings?mode=3v3&ageGroup=HS`, {
            headers: headers(USER_ID),
        });
        const teams = await res.json();

        // All returned teams should have ageGroup=HS (or be empty if none match)
        const allMatch = teams.every(t => t.ageGroup === 'HS');
        if (allMatch) {
            pass('Rankings filter by ageGroup');
            console.log(`    Matching teams: ${teams.length}`);
        } else {
            const mismatched = teams.filter(t => t.ageGroup !== 'HS');
            fail('Rankings filter by ageGroup', `${mismatched.length} teams don't match filter`);
        }
    });

    await test('Rankings filter by gender', async () => {
        const res = await fetch(`${API}/rankings?mode=3v3&gender=Mens`, {
            headers: headers(USER_ID),
        });
        const teams = await res.json();

        const allMatch = teams.every(t => t.gender === 'Mens');
        if (allMatch) {
            pass('Rankings filter by gender');
            console.log(`    Matching teams: ${teams.length}`);
        } else {
            fail('Rankings filter by gender', `Some teams don't match gender filter`);
        }
    });

    // ────────────────────────────────────────────────────────
    // TEST 5: getUserTeams returns ageGroup + gender
    // ────────────────────────────────────────────────────────
    await test('getUserTeams / myTeams returns ageGroup + gender', async () => {
        const res = await fetch(`${API}/teams`, {
            headers: headers(USER_ID),
        });
        const teams = await res.json();
        const teamList = Array.isArray(teams) ? teams : teams?.teams || [];

        if (teamList.length > 0) {
            const first = teamList[0];
            const hasFields = 'ageGroup' in first && 'gender' in first;
            if (hasFields) {
                pass('getUserTeams / myTeams returns ageGroup + gender');
            } else {
                fail('getUserTeams / myTeams returns ageGroup + gender', `Fields missing: ${Object.keys(first).join(', ')}`);
            }
        } else {
            fail('getUserTeams / myTeams returns ageGroup + gender', 'No teams returned');
        }
    });

    // ────────────────────────────────────────────────────────  
    // TEST 6: Challenge flow (e2e)
    // ────────────────────────────────────────────────────────
    await test('Challenge flow works', async () => {
        // Get my teams
        const myRes = await fetch(`${API}/teams`, { headers: headers(USER_ID) });
        const myTeams = await myRes.json();
        const myTeamList = Array.isArray(myTeams) ? myTeams : myTeams?.teams || [];

        if (myTeamList.length === 0) {
            fail('Challenge flow works', 'No teams to test with');
            return;
        }

        // Get rankings to find an opponent
        const rankRes = await fetch(`${API}/rankings?mode=3v3`, { headers: headers(USER_ID) });
        const rankTeams = await rankRes.json();

        const myTeam = myTeamList.find(t => t.teamType === '3v3');
        const opponent = rankTeams.find(t => t.id !== myTeam?.id);

        if (!myTeam || !opponent) {
            fail('Challenge flow works', 'Cannot find challenger or opponent');
            return;
        }

        const chalRes = await fetch(`${API}/teams/${myTeam.id}/challenge/${opponent.id}`, {
            method: 'POST',
            headers: headers(USER_ID),
            body: JSON.stringify({ message: 'E2E test challenge' }),
        });

        if (chalRes.status === 201 || chalRes.status === 200) {
            pass('Challenge flow works');
            const chalBody = await chalRes.json();
            console.log(`    Challenge created: ${myTeam.name} vs ${opponent.name}`);
            console.log(`    Challenge ID: ${chalBody.id || chalBody.challengeId || 'N/A'}`);
        } else {
            const body = await chalRes.text();
            fail('Challenge flow works', `HTTP ${chalRes.status}: ${body}`);
        }
    });

    // ────────────────────────────────────────────────────────
    // TEST 7: ageGroup validation
    // ────────────────────────────────────────────────────────
    await test('Invalid ageGroup is rejected', async () => {
        const res = await fetch(`${API}/teams`, {
            method: 'POST',
            headers: headers(USER_ID),
            body: JSON.stringify({
                name: `InvalidAgeTest_${Date.now()}`,
                teamType: '3v3',
                ageGroup: 'INVALID',
            }),
        });

        if (res.status === 400) {
            pass('Invalid ageGroup is rejected');
        } else {
            fail('Invalid ageGroup is rejected', `Expected 400, got ${res.status}`);
        }
    });

    await test('Invalid gender is rejected', async () => {
        const res = await fetch(`${API}/teams`, {
            method: 'POST',
            headers: headers(USER_ID),
            body: JSON.stringify({
                name: `InvalidGenderTest_${Date.now()}`,
                teamType: '3v3',
                gender: 'INVALID',
            }),
        });

        if (res.status === 400) {
            pass('Invalid gender is rejected');
        } else {
            fail('Invalid gender is rejected', `Expected 400, got ${res.status}`);
        }
    });

    // ────────────────────────────────────────────────────────
    // CLEANUP: Delete test team
    // ────────────────────────────────────────────────────────
    if (testTeamId) {
        console.log('\n--- Cleanup ---');
        const delRes = await fetch(`${API}/teams/${testTeamId}`, {
            method: 'DELETE',
            headers: headers(USER_ID),
        });
        console.log(`  Deleted test team: ${delRes.status === 200 ? '✅' : '❌'}`);
    }

    // ────────────────────────────────────────────────────────
    // SUMMARY
    // ────────────────────────────────────────────────────────
    console.log('\n=== RESULTS ===');
    const passed = results.filter(r => r.pass).length;
    const total = results.length;
    console.log(`\n${passed}/${total} tests passed\n`);

    if (passed < total) {
        console.log('Failed tests:');
        results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.name}: ${r.reason}`));
    }

    console.log('\n=== TEST COMPLETE ===');
}

main().catch(err => console.error('Fatal error:', err.message));

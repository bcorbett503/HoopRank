/**
 * Query the live DB schema for all team-related tables
 */
const API = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';

async function main() {
    console.log('=== TEAM DATABASE SCHEMA AUDIT ===\n');

    const tables = ['teams', 'team_members', 'team_messages', 'team_events', 'team_event_attendance', 'team_challenges', 'team_follows', 'matches'];

    for (const table of tables) {
        try {
            // Get columns
            const res = await fetch(`${API}/rankings`, {
                method: 'GET',
                headers: { 'x-user-id': USER_ID }
            });
            // We can't query schema directly via API... 
        } catch (e) { }
    }

    // Instead, let's query via the endpoints we have
    console.log('1. TEAMS table (via GET /rankings?mode=3v3):');
    const r1 = await fetch(`${API}/rankings?mode=3v3`, { headers: { 'x-user-id': USER_ID } });
    const teams = await r1.json();
    if (teams[0]) {
        console.log('   Fields returned:', Object.keys(teams[0]).join(', '));
        console.log('   Sample:', JSON.stringify(teams[0], null, 2));
    }

    console.log('\n2. TEAM DETAIL (via GET /teams/{id}):');
    if (teams[0]) {
        const r2 = await fetch(`${API}/teams/${teams[0].id}`, { headers: { 'x-user-id': USER_ID } });
        const detail = await r2.json();
        console.log('   Fields returned:', Object.keys(detail).join(', '));
        console.log('   Sample:', JSON.stringify(detail, null, 2));
    }

    console.log('\n3. MY TEAMS (via GET /teams):');
    const r3 = await fetch(`${API}/teams`, { headers: { 'x-user-id': USER_ID } });
    const myTeams = await r3.json();
    console.log('   Response type:', typeof myTeams, Array.isArray(myTeams));
    if (Array.isArray(myTeams) && myTeams[0]) {
        console.log('   Fields returned:', Object.keys(myTeams[0]).join(', '));
    } else if (!Array.isArray(myTeams)) {
        console.log('   Fields returned:', Object.keys(myTeams).join(', '));
    }
    console.log('   Sample:', JSON.stringify(myTeams, null, 2).substring(0, 500));

    console.log('\n4. TEAM INVITES (via GET /teams/invites):');
    const r4 = await fetch(`${API}/teams/invites`, { headers: { 'x-user-id': USER_ID } });
    const invites = await r4.json();
    console.log('   Count:', Array.isArray(invites) ? invites.length : 'not array');

    console.log('\n5. TEAM CHALLENGES (via GET /teams/challenges):');
    const r5 = await fetch(`${API}/teams/challenges`, { headers: { 'x-user-id': USER_ID } });
    const challenges = await r5.json();
    console.log('   Count:', Array.isArray(challenges) ? challenges.length : 'not array');
    if (Array.isArray(challenges) && challenges[0]) {
        console.log('   Fields:', Object.keys(challenges[0]).join(', '));
    }

    console.log('\n6. TEAM EVENTS (via GET /teams/events):');
    const r6 = await fetch(`${API}/teams/events`, { headers: { 'x-user-id': USER_ID } });
    const events = await r6.json();
    console.log('   Count:', Array.isArray(events) ? events.length : 'not array');
    if (Array.isArray(events) && events[0]) {
        console.log('   Fields:', Object.keys(events[0]).join(', '));
        console.log('   Sample:', JSON.stringify(events[0], null, 2));
    }

    console.log('\n7. FEED team_match entries:');
    const r7 = await fetch(`${API}/statuses/unified-feed?filter=all&limit=50`, { headers: { 'x-user-id': USER_ID } });
    const feed = await r7.json();
    const tmItems = feed.filter(i => i.type === 'team_match');
    console.log('   Team matches in feed:', tmItems.length);
    if (tmItems[0]) {
        console.log('   Fields:', Object.keys(tmItems[0]).join(', '));
    }

    console.log('\n8. FOLLOWED TEAMS:');
    const r8 = await fetch(`${API}/teams/user/${USER_ID}`, { headers: { 'x-user-id': USER_ID } });
    const userTeams = await r8.json();
    console.log('   Response:', JSON.stringify(userTeams, null, 2).substring(0, 500));

    console.log('\n=== AUDIT COMPLETE ===');
}

main().catch(err => console.error('Error:', err.message));

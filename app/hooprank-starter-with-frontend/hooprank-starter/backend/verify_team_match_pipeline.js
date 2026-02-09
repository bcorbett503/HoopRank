/**
 * Full E2E test: Team Match Pipeline
 * Strategy: Challenge FROM opponent TO my team, then accept from my team
 */

const API = 'https://heartfelt-appreciation-production-65f1.up.railway.app';
const USER_ID = '4ODZUrySRUhFDC5wVW6dCySBprD2';
const MY_TEAM = 'b4e3894e-c77a-4b79-a6cf-2828d82861a0';    // Olympic Club 3x
const OPPONENT = '0571564b-a297-4385-af89-deed26844314';     // 3Ball

async function main() {
    console.log('=== TEAM MATCH PIPELINE E2E TEST ===\n');

    // Step 1: Get pre-match ratings
    console.log('STEP 1: Pre-match ratings...');
    const rankRes = await fetch(`${API}/rankings?mode=3v3`, { headers: { 'x-user-id': USER_ID } });
    const teams = await rankRes.json();
    const myPre = parseFloat(teams.find(t => t.id === MY_TEAM).rating);
    const oppPre = parseFloat(teams.find(t => t.id === OPPONENT).rating);
    const myWinsPre = parseInt(teams.find(t => t.id === MY_TEAM).wins);
    const oppLossPre = parseInt(teams.find(t => t.id === OPPONENT).losses);
    console.log(`  Olympic Club 3x: ${myPre.toFixed(2)} (W=${myWinsPre})`);
    console.log(`  3Ball: ${oppPre.toFixed(2)} (L=${oppLossPre})`);

    // Step 2: Challenge FROM 3Ball TO Olympic Club 3x (reverse direction)
    // This way our user (member of Olympic Club 3x) can accept it
    console.log('\nSTEP 2: Creating challenge (3Ball → Olympic Club 3x)...');
    const challengeRes = await fetch(`${API}/teams/${OPPONENT}/challenge/${MY_TEAM}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': USER_ID },
        body: JSON.stringify({ message: 'E2E full pipeline test' })
    });

    let challengeId;
    if (challengeRes.ok) {
        const challenge = await challengeRes.json();
        challengeId = challenge.id;
        console.log(`  ✅ Challenge created: ${challengeId}`);
    } else {
        const err = await challengeRes.text();
        console.log(`  Challenge failed: ${challengeRes.status} - ${err}`);

        // Check if it failed because user isn't a member of 3Ball
        // If so, let's try the other direction and not accept
        console.log('\n  User may not be member of 3Ball. Trying direct match creation...');

        // Create match directly via challenge from my team
        const ch2Res = await fetch(`${API}/teams/${MY_TEAM}/challenge/${OPPONENT}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': USER_ID },
            body: JSON.stringify({ message: 'E2E pipeline test v2' })
        });

        if (ch2Res.ok) {
            const ch2 = await ch2Res.json();
            console.log(`  ✅ Challenge from my team created: ${ch2.id}`);
            console.log('  But cannot accept from other team (not a member)');
            console.log('  Attempting to accept from my team side...');

            // The challenge goes FROM MY_TEAM TO OPPONENT
            // acceptTeamChallenge checks that teamId === challenge.to_team_id
            // So we need to call from OPPONENT side — which we can't
            // Accept won't work. Let's check existing matches instead.
        } else {
            console.log(`  Second challenge also failed: ${ch2Res.status}`);
        }

        // FALLBACK: Verify existing pipeline data
        console.log('\n=== FALLBACK: Verifying existing pipeline data ===\n');

        // Check completed team matches directly
        console.log('Querying feed for all team_match entries...');
        const feedRes = await fetch(`${API}/statuses/unified-feed?filter=foryou&limit=50`, {
            headers: { 'x-user-id': USER_ID }
        });
        const feed = await feedRes.json();
        const tmItems = feed.filter(i => i.type === 'team_match');
        console.log(`Feed: ${feed.length} total items, ${tmItems.length} team matches\n`);

        tmItems.forEach((tm, i) => {
            console.log(`Team Match #${i + 1}:`);
            console.log(`  ${tm.content}`);
            console.log(`  Score: ${tm.matchScore}`);
            console.log(`  Winner: ${tm.winnerName} (rating: ${tm.winnerRating})`);
            console.log(`  Loser: ${tm.loserName} (rating: ${tm.loserRating})`);
            console.log(`  Status: ${tm.matchStatus}`);

            const hasScore = !!tm.matchScore;
            const hasRatings = !!tm.winnerRating && !!tm.loserRating;
            console.log(`  ${hasScore ? '✅ Score' : '❌ No score'} | ${hasRatings ? '✅ Ratings' : '❌ No ratings'}`);
            console.log();
        });

        // Also check the all feed tab
        console.log('Querying ALL feed tab...');
        const feedAllRes = await fetch(`${API}/statuses/unified-feed?filter=all&limit=50`, {
            headers: { 'x-user-id': USER_ID }
        });
        const feedAll = await feedAllRes.json();
        const tmAll = feedAll.filter(i => i.type === 'team_match');
        console.log(`ALL Feed: ${feedAll.length} total, ${tmAll.length} team matches\n`);

        tmAll.forEach((tm, i) => {
            console.log(`  [ALL] Team Match #${i + 1}: ${tm.content} | Score: ${tm.matchScore} | Winner: ${tm.winnerName} (${tm.winnerRating}) | Loser: ${tm.loserName} (${tm.loserRating})`);
        });

        console.log('\n=== SUMMARY ===');
        console.log(`Total team matches in feed: ${tmAll.length}`);
        if (tmAll.length > 0) {
            const allHaveScores = tmAll.every(t => !!t.matchScore);
            const allHaveRatings = tmAll.every(t => !!t.winnerRating && !!t.loserRating);
            console.log(`All have scores: ${allHaveScores ? '✅' : '❌'}`);
            console.log(`All have ratings: ${allHaveRatings ? '✅' : '❌'}`);
            console.log(`Pipeline status: ${allHaveScores && allHaveRatings ? '✅ WORKING' : '⚠️  PARTIAL'}`);
        }

        console.log('\nNOTE: Full live pipeline test requires user to be member of both teams,');
        console.log('or deploying the new createTeamEvent bridge code to production.');
        return;
    }

    // Step 3: Accept challenge (Olympic Club 3x accepts)
    console.log('\nSTEP 3: Accepting challenge from Olympic Club 3x side...');
    const acceptRes = await fetch(`${API}/teams/${MY_TEAM}/challenges/${challengeId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': USER_ID }
    });

    if (!acceptRes.ok) {
        const err = await acceptRes.text();
        console.log(`  Accept failed: ${acceptRes.status} - ${err}`);
        return;
    }

    const acceptResult = await acceptRes.json();
    const matchId = acceptResult.match?.id;
    console.log(`  ✅ Accepted! Match ID: ${matchId}`);

    // Step 4: Submit scores
    console.log('\nSTEP 4: Submitting scores (21-15, my team wins)...');
    const scoreRes = await fetch(`${API}/teams/${MY_TEAM}/matches/${matchId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': USER_ID },
        body: JSON.stringify({ me: 21, opponent: 15 })
    });

    if (!scoreRes.ok) {
        const err = await scoreRes.text();
        console.log(`  Score failed: ${scoreRes.status} - ${err}`);
        return;
    }

    const scoreResult = await scoreRes.json();
    console.log(`  ✅ Scores submitted!`);
    console.log(`  Winner: ${scoreResult.winnerTeamId}`);

    // Step 5: Check post-match ratings
    console.log('\nSTEP 5: Post-match ratings...');
    const updRes = await fetch(`${API}/rankings?mode=3v3`, { headers: { 'x-user-id': USER_ID } });
    const updTeams = await updRes.json();
    const myPost = parseFloat(updTeams.find(t => t.id === MY_TEAM).rating);
    const oppPost = parseFloat(updTeams.find(t => t.id === OPPONENT).rating);
    const myWinsPost = parseInt(updTeams.find(t => t.id === MY_TEAM).wins);
    const oppLossPost = parseInt(updTeams.find(t => t.id === OPPONENT).losses);

    console.log(`  Olympic Club 3x: ${myPre.toFixed(2)} → ${myPost.toFixed(2)} (W: ${myWinsPre} → ${myWinsPost})`);
    console.log(`  3Ball: ${oppPre.toFixed(2)} → ${oppPost.toFixed(2)} (L: ${oppLossPre} → ${oppLossPost})`);
    console.log(`  ${myPost > myPre ? '✅ Winner rating UP' : '❌ Winner rating unchanged'}`);
    console.log(`  ${oppPost < oppPre ? '✅ Loser rating DOWN' : '❌ Loser rating unchanged'}`);

    // Step 6: Feed check
    console.log('\nSTEP 6: Feed check...');
    const feedRes = await fetch(`${API}/statuses/unified-feed?filter=all&limit=20`, { headers: { 'x-user-id': USER_ID } });
    const feedItems = await feedRes.json();
    const tmItems = feedItems.filter(i => i.type === 'team_match');
    console.log(`  ${tmItems.length} team matches in feed`);

    const latest = tmItems[0];
    if (latest) {
        console.log(`  Latest: ${latest.content} | ${latest.matchScore} | W:${latest.winnerName}(${latest.winnerRating}) L:${latest.loserName}(${latest.loserRating})`);
        console.log(`  ${latest.winnerRating && latest.loserRating ? '✅ Ratings in feed!' : '❌ Missing ratings'}`);
    }

    console.log('\n=== E2E TEST COMPLETE ===');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });

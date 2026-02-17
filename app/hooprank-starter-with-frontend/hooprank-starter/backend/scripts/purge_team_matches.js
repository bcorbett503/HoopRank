/**
 * Purge all team game matches/outcomes from the database.
 * Cleans up: shadow statuses, likes/comments on those statuses,
 * team challenges, and the matches themselves.
 * Leaves all other data (1v1 matches, status posts, courts, users, teams) intact.
 */
const { Client } = require('pg');

async function purgeTeamMatches() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== PURGE TEAM MATCHES ===\n');

        // 1. Count what we're about to delete
        const countResult = await client.query(
            `SELECT COUNT(*) as total FROM matches WHERE team_match = true`
        );
        console.log(`Found ${countResult.rows[0].total} team matches to purge.\n`);

        // 2. Get shadow status_ids linked to team matches (for cleanup)
        const statusIds = await client.query(
            `SELECT status_id FROM matches WHERE team_match = true AND status_id IS NOT NULL`
        );
        const ids = statusIds.rows.map(r => r.status_id).filter(Boolean);
        console.log(`Found ${ids.length} shadow statuses to clean up.`);

        // 3. Delete likes/comments on shadow statuses
        if (ids.length > 0) {
            const likeDel = await client.query(
                `DELETE FROM status_likes WHERE status_id = ANY($1::int[])`, [ids]
            );
            console.log(`  Deleted ${likeDel.rowCount} likes on shadow statuses.`);

            const commentDel = await client.query(
                `DELETE FROM status_comments WHERE status_id = ANY($1::int[])`, [ids]
            );
            console.log(`  Deleted ${commentDel.rowCount} comments on shadow statuses.`);
        }

        // 4. Delete shadow player_statuses
        if (ids.length > 0) {
            const shadowDel = await client.query(
                `DELETE FROM player_statuses WHERE id = ANY($1::int[])`, [ids]
            );
            console.log(`  Deleted ${shadowDel.rowCount} shadow player_statuses.`);
        }

        // 5. Delete team challenges (matches with team_match = true in challenges table)
        const challengeDel = await client.query(
            `DELETE FROM challenges WHERE match_id IN (SELECT id FROM matches WHERE team_match = true)`
        ).catch(e => { console.log('  (no challenges table or no team challenges)'); return { rowCount: 0 }; });
        console.log(`  Deleted ${challengeDel.rowCount} team challenges.`);

        // 6. Delete the team matches themselves
        const matchDel = await client.query(
            `DELETE FROM matches WHERE team_match = true`
        );
        console.log(`\n✓ Deleted ${matchDel.rowCount} team matches.`);

        // 7. Reset team ratings to default (3.50)
        const ratingReset = await client.query(
            `UPDATE teams SET rating = 3.50, wins = 0, losses = 0`
        ).catch(e => { console.log('  (could not reset team ratings)'); return { rowCount: 0 }; });
        console.log(`✓ Reset ${ratingReset.rowCount} team ratings to 3.50 (0W-0L).`);

        // 8. Verify
        const verify = await client.query(
            `SELECT COUNT(*) as remaining FROM matches WHERE team_match = true`
        );
        console.log(`\nVerification: ${verify.rows[0].remaining} team matches remaining.`);

        const otherMatches = await client.query(
            `SELECT COUNT(*) as total FROM matches WHERE team_match IS NULL OR team_match = false`
        );
        console.log(`1v1 matches untouched: ${otherMatches.rows[0].total}`);

        console.log('\n=== PURGE COMPLETE ===');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

purgeTeamMatches();

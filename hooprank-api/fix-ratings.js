import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway';
const pool = new Pool({ connectionString: DATABASE_URL });

// Simple rating update for the match
async function fixRatings() {
    try {
        console.log('Fetching match...');
        const matchResult = await pool.query(
            "SELECT * FROM matches WHERE status = 'ended' ORDER BY updated_at DESC LIMIT 1"
        );

        if (matchResult.rows.length === 0) {
            console.log('No ended matches found');
            return;
        }

        const match = matchResult.rows[0];
        console.log('Match:', match.id);
        console.log('Score:', match.score);

        const a = match.creator_id;
        const b = match.opponent_id;
        const sa = match.score[a] || 0;
        const sb = match.score[b] || 0;

        const winner = sa > sb ? a : b;
        const loser = winner === a ? b : a;

        console.log(`Winner: ${winner.substring(0, 8)} (score: ${winner === a ? sa : sb})`);
        console.log(`Loser: ${loser.substring(0, 8)} (score: ${loser === a ? sa : sb})`);

        // Get current ratings
        const ratings = await pool.query(
            'SELECT id, name, hoop_rank FROM users WHERE id = $1 OR id = $2',
            [a, b]
        );

        console.log('Current ratings:');
        ratings.rows.forEach(r => console.log(`  ${r.name}: ${r.hoop_rank}`));

        // Apply rating changes (simple: winner +0.10, loser -0.05)
        const winnerRating = parseFloat(ratings.rows.find(r => r.id === winner).hoop_rank);
        const loserRating = parseFloat(ratings.rows.find(r => r.id === loser).hoop_rank);

        const newWinnerRating = Math.min(5.0, winnerRating + 0.10);
        const newLoserRating = Math.max(1.0, loserRating - 0.05);

        console.log(`\nUpdating ratings:`);
        console.log(`  Winner: ${winnerRating} -> ${newWinnerRating.toFixed(2)}`);
        console.log(`  Loser: ${loserRating} -> ${newLoserRating.toFixed(2)}`);

        await pool.query('UPDATE users SET hoop_rank = $2 WHERE id = $1', [winner, newWinnerRating]);
        await pool.query('UPDATE users SET hoop_rank = $2 WHERE id = $1', [loser, newLoserRating]);

        // Verify
        const updated = await pool.query(
            'SELECT name, hoop_rank FROM users WHERE id = $1 OR id = $2',
            [a, b]
        );

        console.log('\nNew ratings:');
        updated.rows.forEach(r => console.log(`  ${r.name}: ${r.hoop_rank}`));

        console.log('\nRatings updated successfully!');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

fixRatings();

import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway';
const pool = new Pool({ connectionString: DATABASE_URL });

async function updateAndRescore() {
    try {
        console.log('=== Step 1: Alter hoop_rank column to numeric(3,2) ===');
        await pool.query('ALTER TABLE users ALTER COLUMN hoop_rank TYPE numeric(3,2)');
        console.log('Column updated to 2 decimal precision');

        console.log('\n=== Step 2: Reset ratings to 3.00 ===');
        await pool.query("UPDATE users SET hoop_rank = 3.00");
        console.log('Ratings reset');

        console.log('\n=== Step 3: Rescore the match with new algorithm ===');
        // Brett won 10-5, so:
        // - Brett (winner): 3.00 + 0.25 (baseWin) + 0.10 (new opponent bonus * 1.5 = 0.375 total gain) 
        // With first game bonus etc, let's calculate properly:
        // Base win = 0.25, new opponent multiplier = 1.5 → 0.375
        // Activity bonus = 0.02 (first game today)
        // Total: 0.375 + 0.02 = 0.395 ≈ 0.40
        const winnerNewRating = 3.40;  // Brett
        const loserNewRating = 2.62;   // John (3.00 - 0.375 = 2.625)

        await pool.query("UPDATE users SET hoop_rank = $1 WHERE name = 'Brett'", [winnerNewRating]);
        await pool.query("UPDATE users SET hoop_rank = $1 WHERE name = 'John Apple'", [loserNewRating]);

        console.log('\n=== Final Ratings ===');
        const result = await pool.query('SELECT name, hoop_rank FROM users ORDER BY hoop_rank DESC');
        result.rows.forEach(row => {
            console.log(`  ${row.name}: ${parseFloat(row.hoop_rank).toFixed(2)}`);
        });

        console.log('\n✅ Done! New rating algorithm:');
        console.log('  - Base win: +0.25 (was 0.10)');
        console.log('  - Upset bonus: +0.10 (was 0.05)');
        console.log('  - New opponent multiplier: 1.5x');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

updateAndRescore();

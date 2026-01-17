import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway';
const pool = new Pool({ connectionString: DATABASE_URL });

async function fixJohnRating() {
    await pool.query("UPDATE users SET hoop_rank = 2.95 WHERE name = 'John Apple'");
    console.log('Updated John Apple to 2.95');

    const r = await pool.query('SELECT name, hoop_rank FROM users ORDER BY hoop_rank DESC');
    console.log('\nCurrent Ratings:');
    r.rows.forEach(row => console.log(`  ${row.name}: ${row.hoop_rank}`));

    await pool.end();
}

fixJohnRating();

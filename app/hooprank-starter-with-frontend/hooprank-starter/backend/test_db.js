const { Client } = require('pg');

const MAX_RETRIES = 12;

async function check(retryCount = 0) {
  const client = new Client({
    connectionString: 'postgresql://postgres:wXz9rB5vQ8p2L6nK4m7J1gH3sD0fA2e9@roundhouse.proxy.rlwy.net:45952/railway',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    // Only check the newly spawned instances (is_recurring = false)
    const res = await client.query(`SELECT id, title, scheduled_at, is_recurring FROM scheduled_runs WHERE title LIKE '%Warner Pacific%' AND is_recurring = false ORDER BY scheduled_at ASC LIMIT 5`);
    console.log("Newly Spawned Instances:\n", JSON.stringify(res.rows, null, 2));

    const countRes = await client.query(`SELECT COUNT(*) FROM scheduled_runs WHERE is_recurring = false`);
    console.log(`Total freshly instantiated runs globally: ${countRes.rows[0].count}`);
  } catch (e) {
    if (e.code === 'ECONNRESET' && retryCount < MAX_RETRIES) {
      console.log(`Connection reset. Retrying (${retryCount + 1}/${MAX_RETRIES}) in 4s...`);
      setTimeout(() => check(retryCount + 1), 4000);
    } else {
      console.error("DB Error:", e);
    }
  } finally {
    try { await client.end(); } catch (e) { }
  }
}
check();

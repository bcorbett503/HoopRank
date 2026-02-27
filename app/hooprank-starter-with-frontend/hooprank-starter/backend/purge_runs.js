const { Client } = require('pg');

async function purge() {
  const client = new Client({
    connectionString: 'postgresql://postgres:wXz9rB5vQ8p2L6nK4m7J1gH3sD0fA2e9@roundhouse.proxy.rlwy.net:45952/railway',
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log("Connected to PostgreSQL! Purging active spawned runs (but keeping templates)...");
    
    // We only want to delete the INSTANCES that were spawned incorrectly.
    // We DO NOT want to delete templates (is_recurring = true).
    const res = await client.query(`DELETE FROM scheduled_runs WHERE is_recurring = false`);
    console.log(`Deleted ${res.rowCount} incorrectly spawned runs.`);
  } catch(e) {
    console.error("DB Error:", e);
  } finally {
    await client.end();
  }
}
purge();

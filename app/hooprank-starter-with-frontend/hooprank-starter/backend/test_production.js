const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const res = await client.query("SELECT count(*) FROM scheduled_runs WHERE created_by = '4ODZUrySRUhFDC5wVW6dCySBprD2';");
  console.log(`Matching Seeded Runs: ${res.rows[0].count}`);
  process.exit(0);
}
run().catch(console.error);

import { DataSource } from 'typeorm';

async function verify() {
  const ds = new DataSource({
    type: 'postgres',
    url: 'postgresql://postgres:wXz9rB5vQ8p2L6nK4m7J1gH3sD0fA2e9@roundhouse.proxy.rlwy.net:45952/railway?sslmode=disable',
    ssl: false
  });

  try {
    await ds.initialize();
    console.log("Connected to PostgreSQL DB via TypeORM pooling.");
    const res = await ds.query(`SELECT id, title, scheduled_at, is_recurring FROM scheduled_runs WHERE title LIKE '%Warner Pacific%' AND is_recurring = false ORDER BY scheduled_at ASC LIMIT 5`);
    console.log("Newly Spawned Instances:\n", JSON.stringify(res, null, 2));

    const countRes = await ds.query(`SELECT COUNT(*) as cnt FROM scheduled_runs WHERE is_recurring = false`);
    console.log(`Total freshly instantiated runs globally: ${countRes[0].cnt}`);
  } catch (e) {
    console.error("DB Error:", e);
  } finally {
    try { await ds.destroy(); } catch (e) { }
  }
}
verify();

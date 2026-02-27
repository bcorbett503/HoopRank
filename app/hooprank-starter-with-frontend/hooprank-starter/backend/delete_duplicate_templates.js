const { Client } = require('pg');

async function run() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || "postgresql://postgres:GZtEchdZfCqIigpLnjUoRjEwKkQeRymZ@monorail.proxy.rlwy.net:18659/railway",
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to Railway PostgreSQL.");

        const res = await client.query(`
            SELECT court_id, title, duration_minutes, COUNT(*) as cnt, array_agg(id) as ids
            FROM scheduled_runs
            WHERE is_recurring = true
            GROUP BY court_id, title, duration_minutes
            HAVING COUNT(*) > 1
        `);

        if (res.rows.length === 0) {
            console.log("No duplicate master templates found. Database is perfectly clean.");
        } else {
            console.log(`Found ${res.rows.length} courts with duplicated templates.`);
            for (const row of res.rows) {
                const duplicatesToDelete = row.ids.slice(1);
                for (const id of duplicatesToDelete) {
                    console.log(`Deleting duplicate template ID: ${id} for '${row.title}'`);
                    await client.query('DELETE FROM scheduled_runs WHERE id = $1', [id]);
                }
            }
            console.log("Duplicate templates swept from database.");
        }
    } catch (e) {
        console.error("Database connection failed:", e.message);
    } finally {
        await client.end();
    }
}

run();

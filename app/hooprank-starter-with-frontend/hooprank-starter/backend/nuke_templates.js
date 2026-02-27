const { Client } = require('pg');

async function nuke() {
    const client = new Client({
        connectionString: 'postgresql://postgres:wXz9rB5vQ8p2L6nK4m7J1gH3sD0fA2e9@roundhouse.proxy.rlwy.net:45952/railway',
        ssl: { rejectUnauthorized: false }
    });

    await client.connect();

    console.log("Connected directly to Railway database.");

    const countQuery = await client.query("SELECT COUNT(*) FROM scheduled_runs WHERE is_recurring = true");
    console.log(`Found ${countQuery.rows[0].count} master recurring templates.`);

    // Completely wipe all templates
    const res = await client.query("DELETE FROM scheduled_runs WHERE is_recurring = true");
    console.log(`✅ Nuked ${res.rowCount} master templates.`);

    // Wait, the cron worker also spawned concrete runs from these templates.
    // Let's wipe all system-generated concrete runs too, just to be 100% clean before the re-seed.
    // System runs are created by BRETT_ID
    const resConcrete = await client.query("DELETE FROM scheduled_runs WHERE created_by = '4ODZUrySRUhFDC5wVW6dCySBprD2' AND is_recurring = false");
    console.log(`✅ Nuked ${resConcrete.rowCount} spawned concrete events tied to the seeded markets.`);

    await client.end();
}

nuke().catch(console.error);

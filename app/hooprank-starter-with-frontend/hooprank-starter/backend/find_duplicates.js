require('dotenv').config();
const { Client } = require('pg');

async function findDuplicates() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    await client.connect();

    console.log('=== DUPLICATE COURTS (By Name & Location) ===');
    const courtsRes = await client.query(`
        SELECT name, lat, lng, COUNT(*) as cnt, array_agg(id) as ids
        FROM courts
        GROUP BY name, lat, lng
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC;
    `);

    if (courtsRes.rows.length === 0) {
        console.log("No exact duplicate courts found by Name+Lat+Lng.");
    } else {
        console.table(courtsRes.rows);
    }

    console.log('\n=== DUPLICATE RECURRING RUN TEMPLATES ===');
    const runsRes = await client.query(`
        SELECT "courtId", title, "gameMode", "durationMinutes", COUNT(*) as cnt, array_agg(id) as ids
        FROM scheduled_runs
        WHERE "isRecurringTemplate" = true
        GROUP BY "courtId", title, "gameMode", "durationMinutes"
        HAVING COUNT(*) > 1
        ORDER BY cnt DESC;
    `);

    if (runsRes.rows.length === 0) {
        console.log("No duplicate recurring templates found by Court+Title+GameMode.");
    } else {
        console.table(runsRes.rows);
    }

    await client.end();
}

findDuplicates().catch(console.error);

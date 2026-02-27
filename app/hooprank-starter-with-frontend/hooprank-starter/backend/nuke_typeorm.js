const { DataSource } = require('typeorm');

async function nuke() {
    const dataSource = new DataSource({
        type: 'postgres',
        url: 'postgresql://postgres:wXz9rB5vQ8p2L6nK4m7J1gH3sD0fA2e9@roundhouse.proxy.rlwy.net:45952/railway',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await dataSource.initialize();
        console.log("Connected directly to Railway database.");

        const deletedConcrete = await dataSource.query(`DELETE FROM scheduled_runs WHERE created_by = '4ODZUrySRUhFDC5wVW6dCySBprD2' AND is_recurring = false`);
        console.log(`✅ Nuked ${deletedConcrete[1] || 0} spawned concrete events tied to the seeded markets.`);

        const deletedTemplates = await dataSource.query(`DELETE FROM scheduled_runs WHERE is_recurring = true`);
        console.log(`✅ Nuked ${deletedTemplates[1] || 0} master templates.`);

    } catch (e) {
        console.error("Connection/Query Error:", e);
    } finally {
        await dataSource.destroy();
    }
}

nuke();

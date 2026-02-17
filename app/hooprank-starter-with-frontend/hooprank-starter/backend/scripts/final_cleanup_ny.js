/**
 * Final NY cleanup - fix remaining YMCA access types
 */
const { Client } = require('pg');

async function finalCleanup() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== FINAL NY CLEANUP ===\n');

        // Fix all YMCAs that are marked as public - they should be members
        const ymcaFix = await client.query(`
      UPDATE courts 
      SET access = 'members' 
      WHERE city LIKE '%NY' 
        AND name ILIKE '%YMCA%' 
        AND access = 'public'
      RETURNING name, city
    `);

        console.log(`Fixed ${ymcaFix.rowCount} YMCAs to 'members' access:`);
        ymcaFix.rows.forEach(r => console.log(`  ✅ ${r.name} (${r.city})`));

        // Delete duplicate Bedford-Stuyvesant YMCA - keep the curated one with 'members'
        const dupCheck = await client.query(`
      SELECT id, name, source, access FROM courts 
      WHERE name = 'Bedford-Stuyvesant YMCA' AND city = 'Brooklyn, NY'
    `);

        console.log('\nChecking Bedford-Stuyvesant YMCA duplicates:');
        dupCheck.rows.forEach(r => {
            console.log(`  ${r.id} - source: ${r.source}, access: ${r.access}`);
        });

        // Delete the manual/public one if it exists
        const deleted = await client.query(`
      DELETE FROM courts 
      WHERE name = 'Bedford-Stuyvesant YMCA' 
        AND city = 'Brooklyn, NY'
        AND source = 'manual'
      RETURNING id
    `);

        if (deleted.rowCount > 0) {
            console.log(`  ❌ Deleted duplicate entry`);
        }

        // Show final count
        const nyCount = await client.query(`
      SELECT COUNT(*) as count FROM courts WHERE city LIKE '%NY'
    `);
        console.log(`\n📊 Final NY court count: ${nyCount.rows[0].count}`);

        const totalCount = await client.query('SELECT COUNT(*) as count FROM courts');
        console.log(`📊 Total courts in database: ${totalCount.rows[0].count}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

finalCleanup();

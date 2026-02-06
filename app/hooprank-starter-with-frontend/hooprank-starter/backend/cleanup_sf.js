/**
 * SF Court Data Cleanup
 */
const { Client } = require('pg');

async function cleanupSF() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== SF COURT DATA CLEANUP ===\n');

        // 1. Delete duplicate Bay Clubs (keep curated, delete user entries)
        console.log('Removing duplicate Bay Club entries...');
        const bayClubDups = await client.query(`
      DELETE FROM courts 
      WHERE city = 'San Francisco, CA' 
        AND name LIKE 'Bay Club%' 
        AND source = 'user'
      RETURNING name
    `);
        bayClubDups.rows.forEach(r => console.log(`  ❌ Deleted: ${r.name} (user source)`));

        // 2. Delete duplicate YMCA Embarcadero entries (keep one curated)
        console.log('\nRemoving duplicate YMCA Embarcadero entries...');
        const ymcaDups = await client.query(`
      DELETE FROM courts 
      WHERE city = 'San Francisco, CA' 
        AND name LIKE '%Embarcadero%' 
        AND (source = 'user' OR source = 'manual' OR id IN (
          SELECT id FROM courts 
          WHERE name LIKE '%Embarcadero%' 
          ORDER BY id 
          OFFSET 1
        ))
      RETURNING name, source
    `);
        ymcaDups.rows.forEach(r => console.log(`  ❌ Deleted: ${r.name} (${r.source})`));

        // 3. Delete duplicate Koret (keep curated)
        console.log('\nRemoving duplicate Koret entries...');
        const koretDups = await client.query(`
      DELETE FROM courts 
      WHERE city = 'San Francisco, CA' 
        AND name LIKE 'Koret%' 
        AND source = 'user'
      RETURNING name
    `);
        koretDups.rows.forEach(r => console.log(`  ❌ Deleted: ${r.name}`));

        // 4. Fix Bay Clubs access type (should be members, not public)
        console.log('\nFixing Bay Club access types...');
        const bayClubFix = await client.query(`
      UPDATE courts 
      SET access = 'members' 
      WHERE city = 'San Francisco, CA' 
        AND name LIKE 'Bay Club%' 
        AND access = 'public'
      RETURNING name
    `);
        bayClubFix.rows.forEach(r => console.log(`  ✅ ${r.name} → members`));

        // 5. Fix Olympic Club (should be members - it's very exclusive)
        console.log('\nFixing Olympic Club access type...');
        const olympicFix = await client.query(`
      UPDATE courts 
      SET access = 'members', source = 'curated'
      WHERE name = 'The Olympic Club' 
        AND city = 'San Francisco, CA'
      RETURNING name
    `);
        olympicFix.rows.forEach(r => console.log(`  ✅ ${r.name} → members`));

        // 6. Fix Koret access (USF students/members only)
        console.log('\nFixing Koret access type...');
        const koretFix = await client.query(`
      UPDATE courts 
      SET access = 'members'
      WHERE city = 'San Francisco, CA' 
        AND name LIKE 'Koret%'
      RETURNING name
    `);
        koretFix.rows.forEach(r => console.log(`  ✅ ${r.name} → members`));

        // 7. Fix YMCAs (should be members)
        console.log('\nFixing YMCA access types...');
        const ymcaFix = await client.query(`
      UPDATE courts 
      SET access = 'members'
      WHERE city = 'San Francisco, CA' 
        AND name LIKE '%YMCA%' 
        AND access = 'public'
      RETURNING name
    `);
        ymcaFix.rows.forEach(r => console.log(`  ✅ ${r.name} → members`));

        // Show final count
        const sfCount = await client.query(`
      SELECT COUNT(*) as count FROM courts WHERE city = 'San Francisco, CA'
    `);
        console.log(`\n📊 SF courts after cleanup: ${sfCount.rows[0].count}`);

        const totalCount = await client.query('SELECT COUNT(*) as count FROM courts');
        console.log(`📊 Total courts in database: ${totalCount.rows[0].count}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

cleanupSF();

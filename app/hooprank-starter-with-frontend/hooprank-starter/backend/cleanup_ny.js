/**
 * NY Court Data Cleanup - Remove duplicates and fix issues
 */
const { Client } = require('pg');

// Courts to DELETE (duplicates with wrong data)
const COURTS_TO_DELETE = [
    // Duplicate YMCAs - keep curated, delete manual with wrong access
    'c03a3758-ffad-4acb-a6d7-4ea8263eb25d', // Chinatown YMCA - manual with public, should be members
    'affe9684-043a-4fe0-993b-3712b6bf7d52', // Harlem YMCA - manual with public, duplicate
    'ea891efd-3da8-4d45-99fd-c89675962aa1', // McBurney YMCA - manual with public, duplicate
    '939846c4-9a4b-42e1-b91a-9ae6699b098c', // Vanderbilt YMCA - manual with public, duplicate
    '573b1671-b25c-46cc-bc52-7f258b631962', // West Side YMCA - manual with public, duplicate  
    '62da18a8-9a34-417d-9a74-e3532a97616e', // 24 Hour Fitness Kew Gardens - manual with public (should be members)
    '113dc9be-6a6d-4cc8-91b5-6b4db6688a33', // Cross Island YMCA - manual with public
    '952fa4e9-530d-4984-aba2-a74abc365769', // Flushing YMCA - manual duplicate
    '2d6167d3-987f-48ca-ac22-219e2fcbe819', // Jamaica YMCA - manual with public
    '7b536152-3cc3-4f94-9b06-684baaf38862', // LIC YMCA - manual duplicate
    '58a3072e-bf12-4019-aa5a-a6f2b8b850b5', // Ridgewood YMCA - manual with public
    '5057f6fe-4ac4-460b-9fe8-7dd6c2ef52be', // Rockaway YMCA - manual with public
    'd885e5b3-1a10-4f02-8049-c1825cae0b6a', // Broadway YMCA Staten Island - manual with public
    '92c8c891-7470-4c08-9bbd-ef5b20cb6f50', // LA Fitness Staten Island - manual with public (should be members)
    '22d15478-6157-4ba3-9f42-a2724659339a', // South Shore YMCA - manual duplicate
];

// Courts to UPDATE (fix access or indoor status)
const COURTS_TO_UPDATE = [
    // Fix YMCAs that were marked public - should be members
    { id: '8b609d99-d9f9-3c91-5966-3e901ea9a746', access: 'members' }, // Flushing YMCA
    { id: 'b4f152a7-5a17-5f96-fefd-dde201f799ba', access: 'members' }, // LIC YMCA
    { id: '848cceab-d3ef-1f89-ce7e-596dc28f3231', access: 'members' }, // Broadway YMCA SI
    { id: '9d73aae2-be2a-279c-2e26-e3dbdc1c61fe', access: 'members' }, // South Shore YMCA
    { id: '9fdcfd30-1112-a426-868a-860ae18cb47e', access: 'members' }, // Harlem YMCA
    { id: 'e645d2dc-3a34-2d37-1e57-95eb952b17b0', access: 'members' }, // McBurney YMCA
    { id: '5e8d52c0-a2f9-c65b-4cc3-8cd69d679ec8', access: 'members' }, // Vanderbilt YMCA
    { id: '15684ae4-8e36-8742-cb02-9f57dfd60a19', access: 'members' }, // West Side YMCA
];

async function cleanupNY() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== NY COURT DATA CLEANUP ===\n');

        // Delete duplicates
        console.log('Removing duplicate entries...');
        for (const id of COURTS_TO_DELETE) {
            const result = await client.query('DELETE FROM courts WHERE id = $1 RETURNING name', [id]);
            if (result.rowCount > 0) {
                console.log(`  ❌ Deleted: ${result.rows[0].name}`);
            }
        }

        // Update access types
        console.log('\nFixing access types...');
        for (const update of COURTS_TO_UPDATE) {
            const result = await client.query(
                'UPDATE courts SET access = $2 WHERE id = $1 RETURNING name',
                [update.id, update.access]
            );
            if (result.rowCount > 0) {
                console.log(`  ✅ Updated ${result.rows[0].name} → ${update.access}`);
            }
        }

        // Get updated NY count
        const nyCount = await client.query(`
      SELECT COUNT(*) as count FROM courts WHERE city LIKE '%NY'
    `);
        console.log(`\n📊 NY courts after cleanup: ${nyCount.rows[0].count}`);

        // Total count
        const totalCount = await client.query('SELECT COUNT(*) as count FROM courts');
        console.log(`📊 Total courts in database: ${totalCount.rows[0].count}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

cleanupNY();

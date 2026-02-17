/**
 * San Diego Court Data Cleanup
 * - Fix 5 YMCA/Club access types (public -> members)
 * - Remove 3 duplicates (Bay Club, Copley-Price YMCA, Mission Valley YMCA)
 */
const { Client } = require('pg');

async function cleanupSanDiego() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== SAN DIEGO COURT DATA CLEANUP ===\n');

        // 1. Fix YMCA/Club access types (public -> members)
        const accessFixIds = [
            '4b6a2008-f51f-6c3b-b628-dfe21453d79c', // Bay Club Carmel Valley (user-added, public)
            '732cc44b-c0d9-4831-a637-bceb694e1307', // Border View Family YMCA
            '72e222c8-7988-4495-8fec-35cef872cfe5', // Copley-Price Family YMCA (manual, public)
            'aa900d18-9c59-40d3-80b3-ae3e9545a125', // Jackie Robinson Family YMCA
            '126949b7-eb1e-4121-8669-de8a3a61ece8', // Mission Valley YMCA (manual, public)
            '89291f0a-3ccf-479f-8c48-6e5a48ab4672', // Rancho Family YMCA
        ];

        console.log('1. Fixing YMCA/Club access types (public -> members)...');
        for (const id of accessFixIds) {
            const result = await client.query(
                `UPDATE courts SET access = 'members' WHERE id = $1 RETURNING name`,
                [id]
            );
            if (result.rows.length > 0) {
                console.log(`   ✓ Updated: ${result.rows[0].name}`);
            }
        }

        // 2. Remove duplicates (keep curated versions with members access)
        const duplicateIds = [
            '4b6a2008-f51f-6c3b-b628-dfe21453d79c', // Bay Club Carmel Valley (user-added duplicate)
            '72e222c8-7988-4495-8fec-35cef872cfe5', // Copley-Price Family YMCA (manual duplicate)
            '126949b7-eb1e-4121-8669-de8a3a61ece8', // Mission Valley YMCA (manual duplicate)
        ];

        console.log('\n2. Removing duplicate entries...');
        for (const id of duplicateIds) {
            const result = await client.query(
                `DELETE FROM courts WHERE id = $1 RETURNING name`,
                [id]
            );
            if (result.rows.length > 0) {
                console.log(`   ✓ Removed duplicate: ${result.rows[0].name}`);
            }
        }

        // 3. Verify final count
        console.log('\n3. Verifying San Diego courts...');
        const finalResult = await client.query(
            `SELECT COUNT(*) as total,
                    COUNT(CASE WHEN indoor = true THEN 1 END) as indoor,
                    COUNT(CASE WHEN indoor = false THEN 1 END) as outdoor,
                    COUNT(CASE WHEN access = 'public' THEN 1 END) as public,
                    COUNT(CASE WHEN access = 'members' THEN 1 END) as members,
                    COUNT(CASE WHEN access = 'paid' THEN 1 END) as paid
             FROM courts WHERE city = 'San Diego, CA'`
        );
        const stats = finalResult.rows[0];
        console.log(`   Total: ${stats.total} courts`);
        console.log(`   Indoor: ${stats.indoor}, Outdoor: ${stats.outdoor}`);
        console.log(`   Public: ${stats.public}, Members: ${stats.members}, Paid: ${stats.paid}`);

        console.log('\n=== CLEANUP COMPLETE ===');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

cleanupSanDiego();

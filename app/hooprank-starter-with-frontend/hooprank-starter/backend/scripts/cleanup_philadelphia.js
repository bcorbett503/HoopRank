/**
 * Philadelphia Court Data Cleanup
 * - Fix 4 YMCA access types (public -> members)
 * - Remove 1 duplicate Roxborough YMCA
 * - Rename Philadelphia Sports Club to The Sporting Club at The Bellevue
 */
const { Client } = require('pg');

async function cleanupPhiladelphia() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== PHILADELPHIA COURT DATA CLEANUP ===\n');

        // 1. Fix YMCA access types (public -> members)
        const ymcaIds = [
            'f6289f4e-be5a-41e3-adc6-c251271c9187', // Center City YMCA
            'a46d8680-432e-46a6-b9b0-99cbe7c8d2db', // Columbia North YMCA
            '2bd888e2-0b07-49d6-b63a-50e9430239b9', // Northeast Family YMCA
            'bb91c2cf-fccd-46a2-9d36-e54ea9df43a9', // Roxborough YMCA (duplicate to keep)
        ];

        console.log('1. Fixing YMCA access types (public -> members)...');
        for (const id of ymcaIds) {
            const result = await client.query(
                `UPDATE courts SET access = 'members' WHERE id = $1 RETURNING name`,
                [id]
            );
            if (result.rows.length > 0) {
                console.log(`   ✓ Updated: ${result.rows[0].name}`);
            }
        }

        // 2. Remove duplicate Roxborough YMCA (keep the one with members access)
        console.log('\n2. Removing duplicate Roxborough YMCA...');
        const deleteResult = await client.query(
            `DELETE FROM courts WHERE id = '79d2565d-5d71-5044-b40c-a90738fcc581' RETURNING name`
        );
        if (deleteResult.rows.length > 0) {
            console.log(`   ✓ Removed duplicate: ${deleteResult.rows[0].name}`);
        }

        // 3. Rename Philadelphia Sports Club to The Sporting Club at The Bellevue
        console.log('\n3. Renaming Philadelphia Sports Club...');
        const renameResult = await client.query(
            `UPDATE courts SET name = 'The Sporting Club at The Bellevue' WHERE id = '3b4c2102-5627-0394-6572-ca057ff410fe' RETURNING name`
        );
        if (renameResult.rows.length > 0) {
            console.log(`   ✓ Renamed to: ${renameResult.rows[0].name}`);
        }

        // 4. Verify final count
        console.log('\n4. Verifying Philadelphia courts...');
        const finalResult = await client.query(
            `SELECT COUNT(*) as total,
                    COUNT(CASE WHEN indoor = true THEN 1 END) as indoor,
                    COUNT(CASE WHEN indoor = false THEN 1 END) as outdoor,
                    COUNT(CASE WHEN access = 'public' THEN 1 END) as public,
                    COUNT(CASE WHEN access = 'members' THEN 1 END) as members,
                    COUNT(CASE WHEN access = 'paid' THEN 1 END) as paid
             FROM courts WHERE city = 'Philadelphia, PA'`
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

cleanupPhiladelphia();

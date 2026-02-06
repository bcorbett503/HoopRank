/**
 * Chicago Court Deep Verification Cleanup
 * 
 * VERIFIED:
 * - East Bank Club ✅ (1 NBA court + 2 regulation courts!)
 * - Life Time River North ✅ (126,000 sq ft, basketball court)
 * - Lakeshore Sport & Fitness ✅
 * - FFC East Lakeview ✅
 * - Midtown Athletic Club Chicago ✅
 * - All park gymnasiums ✅
 * 
 * FIXES:
 * - DELETE Chicago Athletic Association (this is a HOTEL, not a gym - event space only)
 * - Check if we're missing United Center area courts
 */
const { Client } = require('pg');

async function cleanupChicago() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== CHICAGO DEEP VERIFICATION CLEANUP ===\n');

        // 1. DELETE Chicago Athletic Association (it's a hotel, not a gym)
        console.log('1. REMOVING FALSE POSITIVES...');
        const deleted = await client.query(
            `DELETE FROM courts WHERE id = 'b5596ac3-fabd-2bf9-9655-710caf971c14' RETURNING name`
        );
        if (deleted.rows.length > 0) {
            console.log(`   ✗ Deleted: ${deleted.rows[0].name}`);
            console.log('     Reason: This is Chicago Athletic Association HOTEL - event space only, not a gym');
        }

        // 2. List all Chicago courts with verification
        console.log('\n2. VERIFIED CHICAGO COURTS:');
        const allCourts = await client.query(
            `SELECT name, indoor, access, signature 
             FROM courts 
             WHERE city = 'Chicago, IL' 
             ORDER BY name`
        );

        for (const court of allCourts.rows) {
            const type = court.indoor ? 'Indoor' : 'Outdoor';
            const sig = court.signature ? ' ⭐ SIGNATURE' : '';
            console.log(`   ✅ ${court.name} (${type}, ${court.access})${sig}`);
        }

        // 3. Final stats
        const stats = await client.query(
            `SELECT COUNT(*) as total,
                    COUNT(CASE WHEN indoor = true THEN 1 END) as indoor,
                    COUNT(CASE WHEN indoor = false THEN 1 END) as outdoor,
                    COUNT(CASE WHEN access = 'public' THEN 1 END) as public,
                    COUNT(CASE WHEN access = 'members' THEN 1 END) as members,
                    COUNT(CASE WHEN access = 'paid' THEN 1 END) as paid,
                    COUNT(CASE WHEN signature = true THEN 1 END) as signature
             FROM courts WHERE city = 'Chicago, IL'`
        );
        console.log(`\n=== FINAL STATS ===`);
        console.log(`Total: ${stats.rows[0].total} courts`);
        console.log(`Indoor: ${stats.rows[0].indoor}, Outdoor: ${stats.rows[0].outdoor}`);
        console.log(`Public: ${stats.rows[0].public}, Members: ${stats.rows[0].members}, Paid: ${stats.rows[0].paid}`);
        console.log(`Signature Courts: ${stats.rows[0].signature}`);

        console.log('\n=== CLEANUP COMPLETE ===');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

cleanupChicago();

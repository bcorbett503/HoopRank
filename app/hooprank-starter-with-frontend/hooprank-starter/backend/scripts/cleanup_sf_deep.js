/**
 * San Francisco Court Deep Verification Cleanup
 * - DELETE Bay Club Financial District (no basketball - confirmed)
 * - DELETE Bay Club Gateway (no basketball - court is at 150 Greenwich)
 * - VERIFIED: Bay Club SF @ 150 Greenwich ✅
 * - VERIFIED: Hamilton Recreation Center ✅
 * - VERIFIED: Kezar Pavilion ✅ (undergoing renovation 2026)
 * - VERIFIED: Koret Health & Recreation (USF) ✅
 * - VERIFIED: Mission Recreation Center ✅
 * - VERIFIED: Moscone Park Courts ✅ (has outdoor AND indoor gym)
 * - VERIFIED: Potrero Hill Recreation Center ✅
 * - VERIFIED: Rossi Playground ✅
 */
const { Client } = require('pg');

async function cleanupSanFrancisco() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== SAN FRANCISCO DEEP VERIFICATION CLEANUP ===\n');

        // 1. DELETE venues without basketball
        const venuesToDelete = [
            { id: '9d378226-6c64-e15c-9c32-847e9c7f93c3', reason: 'Bay Club Financial District - no basketball court confirmed (only at 150 Greenwich)' },
            { id: '75d4a0ff-de86-37c3-501c-3883742ec20e', reason: 'Bay Club Gateway - no basketball (tennis, pickleball, pools only)' },
        ];

        console.log('1. REMOVING FALSE POSITIVES (no basketball)...');
        for (const venue of venuesToDelete) {
            const result = await client.query(
                `DELETE FROM courts WHERE id = $1 RETURNING name`,
                [venue.id]
            );
            if (result.rows.length > 0) {
                console.log(`   ✓ Deleted: ${result.rows[0].name}`);
                console.log(`     Reason: ${venue.reason}`);
            }
        }

        // 2. Verify remaining SF courts
        console.log('\n2. VERIFYING REMAINING SAN FRANCISCO COURTS...');
        const remaining = await client.query(
            `SELECT name, indoor, access, signature 
             FROM courts 
             WHERE city = 'San Francisco, CA' 
             ORDER BY name`
        );

        console.log(`\n   ${remaining.rows.length} courts after cleanup:`);
        for (const court of remaining.rows) {
            const type = court.indoor ? 'Indoor' : 'Outdoor';
            const sig = court.signature ? '⭐ SIGNATURE' : '';
            console.log(`   • ${court.name} (${type}, ${court.access}) ${sig}`);
        }

        // 3. Final stats
        const stats = await client.query(
            `SELECT COUNT(*) as total,
                    COUNT(CASE WHEN indoor = true THEN 1 END) as indoor,
                    COUNT(CASE WHEN indoor = false THEN 1 END) as outdoor,
                    COUNT(CASE WHEN access = 'public' THEN 1 END) as public,
                    COUNT(CASE WHEN access = 'members' THEN 1 END) as members,
                    COUNT(CASE WHEN signature = true THEN 1 END) as signature
             FROM courts WHERE city = 'San Francisco, CA'`
        );
        console.log(`\n=== FINAL STATS ===`);
        console.log(`Total: ${stats.rows[0].total} courts`);
        console.log(`Indoor: ${stats.rows[0].indoor}, Outdoor: ${stats.rows[0].outdoor}`);
        console.log(`Public: ${stats.rows[0].public}, Members: ${stats.rows[0].members}`);
        console.log(`Signature Courts: ${stats.rows[0].signature}`);

        console.log('\n=== CLEANUP COMPLETE ===');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

cleanupSanFrancisco();

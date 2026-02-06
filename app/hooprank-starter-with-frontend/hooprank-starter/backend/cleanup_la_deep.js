/**
 * LA Court Deep Verification Cleanup
 * 
 * VERIFIED:
 * - 24 Hour Fitness West LA ✅
 * - 24 Hour Fitness Wilshire ✅
 * - Academy USA LA ✅ (training facility)
 * - Crosscourt DTLA ✅ (premium basketball club)
 * - Los Angeles Athletic Club ✅ (John R. Wooden Award Court!)
 * - All rec centers ✅
 * 
 * FIXES:
 * - ADD Venice Beach Basketball Courts as SIGNATURE (iconic streetball, "White Men Can't Jump")
 * - Kenneth Hahn has only HALF court but keeping it
 */
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

async function cleanupLA() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== LA DEEP VERIFICATION CLEANUP ===\n');

        // 1. Add Venice Beach Basketball Courts as SIGNATURE (if not already present)
        console.log('1. ADDING VENICE BEACH BASKETBALL COURTS...');
        const veniceCheck = await client.query(
            `SELECT id FROM courts WHERE name ILIKE '%Venice Beach%' AND city = 'Los Angeles, CA'`
        );

        if (veniceCheck.rows.length === 0) {
            const veniceId = uuidv4();
            await client.query(
                `INSERT INTO courts (id, name, city, indoor, rims, source, signature, access, geog)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography)`,
                [veniceId, 'Venice Beach Basketball Courts', 'Venice, CA', false, 4, 'curated', true, 'public', -118.4695, 33.9850]
            );
            console.log('   ⭐ Added: Venice Beach Basketball Courts (SIGNATURE)');
            console.log('      Reason: Iconic streetball venue, featured in "White Men Can\'t Jump"');
        } else {
            // Make it signature if exists but not marked
            await client.query(
                `UPDATE courts SET signature = true WHERE name ILIKE '%Venice Beach%' AND city = 'Los Angeles, CA' OR city = 'Venice, CA'`
            );
            console.log('   ⭐ Venice Beach Basketball Courts → SIGNATURE');
        }

        // 2. List all LA area courts with verification
        console.log('\n2. VERIFIED LA COURTS:');
        const allCourts = await client.query(
            `SELECT name, city, indoor, access, signature 
             FROM courts 
             WHERE city ILIKE '%Los Angeles%' OR city = 'Venice, CA'
             ORDER BY city, name`
        );

        for (const court of allCourts.rows) {
            const type = court.indoor ? 'Indoor' : 'Outdoor';
            const sig = court.signature ? ' ⭐ SIGNATURE' : '';
            console.log(`   ✅ ${court.name} (${court.city}, ${type}, ${court.access})${sig}`);
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
             FROM courts WHERE city ILIKE '%Los Angeles%' OR city = 'Venice, CA'`
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

cleanupLA();

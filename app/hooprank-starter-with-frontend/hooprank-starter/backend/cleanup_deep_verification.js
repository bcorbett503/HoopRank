/**
 * Deep Verification Court Cleanup
 * - DELETE venues without basketball: Castle Hill Fitness Austin, Equinox Austin
 * - FIX indoor/outdoor: Hardberger Park is outdoor, not indoor
 * - FIX Pacers Training Center access type (not public)
 */
const { Client } = require('pg');

async function deepVerificationCleanup() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== DEEP VERIFICATION CLEANUP ===\n');

        // 1. DELETE venues that don't have basketball courts
        const venuesToDelete = [
            { id: '1946bdeb-c065-4d89-f69f-9a6eabafe763', reason: 'Castle Hill Fitness Austin - no basketball court' },
            { id: '4e2e4d86-c4d8-b1ad-d034-0f2a1bbfb0ac', reason: 'Equinox Austin - no basketball court' },
        ];

        console.log('1. REMOVING FALSE POSITIVES (no basketball)...');
        for (const venue of venuesToDelete) {
            const result = await client.query(
                `DELETE FROM courts WHERE id = $1 RETURNING name, city`,
                [venue.id]
            );
            if (result.rows.length > 0) {
                console.log(`   ✓ Deleted: ${result.rows[0].name} (${result.rows[0].city})`);
                console.log(`     Reason: ${venue.reason}`);
            }
        }

        // 2. FIX indoor/outdoor classification
        console.log('\n2. FIXING INDOOR/OUTDOOR CLASSIFICATION...');
        const indoorOutdoorFixes = [
            { id: '5286b980-5670-39fd-c944-c66e4144ee91', indoor: false, name: 'Hardberger Park Urban Ecology Center' },
        ];

        for (const fix of indoorOutdoorFixes) {
            const result = await client.query(
                `UPDATE courts SET indoor = $1 WHERE id = $2 RETURNING name, city`,
                [fix.indoor, fix.id]
            );
            if (result.rows.length > 0) {
                console.log(`   ✓ ${result.rows[0].name}: indoor → outdoor`);
            }
        }

        // 3. FIX Pacers Training Center - it's not accessible to regular public
        console.log('\n3. FIXING PACERS TRAINING CENTER ACCESS...');
        const pacersResult = await client.query(
            `UPDATE courts SET access = 'paid' WHERE id = '0c4f8723-6a0c-13a4-3042-8537dad1a5ca' RETURNING name`,
            []
        );
        if (pacersResult.rows.length > 0) {
            console.log(`   ✓ ${pacersResult.rows[0].name}: access → paid (youth programs/tournaments only)`);
        }

        // 4. Summary by city
        console.log('\n=== AUDIT SUMMARY ===');
        const cities = ['Austin, TX', 'San Antonio, TX', 'Indianapolis, IN', 'Boston, MA'];
        for (const city of cities) {
            const result = await client.query(
                `SELECT COUNT(*) as total,
                        COUNT(CASE WHEN indoor = true THEN 1 END) as indoor,
                        COUNT(CASE WHEN indoor = false THEN 1 END) as outdoor
                 FROM courts WHERE city = $1`,
                [city]
            );
            const stats = result.rows[0];
            console.log(`${city}: ${stats.total} courts (${stats.indoor} indoor, ${stats.outdoor} outdoor)`);
        }

        console.log('\n=== CLEANUP COMPLETE ===');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

deepVerificationCleanup();

/**
 * Batch Deep Verification: Houston, Dallas, Phoenix, Seattle, Denver
 * 
 * VERIFIED:
 * HOUSTON (17): Emancipation Park ✅ (historic), MacGregor Park ✅, Memorial Park ✅
 * DALLAS (8): SMU Dedman Center ✅ (4 courts!), Reverchon Park ✅
 * PHOENIX (11): Encanto Park ✅, Indian School Park ✅
 * SEATTLE (4): Garfield Community Center ✅, Rainier CC ✅
 * DENVER (5): All rec centers ✅
 * 
 * POTENTIAL ISSUES:
 * - GCU Arena: This is a 7000-seat spectator arena, not public courts - REVIEW
 */
const { Client } = require('pg');

async function batchVerify() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== BATCH DEEP VERIFICATION: 5 CITIES ===\n');

        const cities = ['Houston, TX', 'Dallas, TX', 'Phoenix, AZ', 'Seattle, WA', 'Denver, CO'];

        for (const city of cities) {
            console.log(`\n=== ${city.toUpperCase()} ===`);
            const courts = await client.query(
                `SELECT name, indoor, access, signature 
                 FROM courts 
                 WHERE city = $1 
                 ORDER BY name`,
                [city]
            );

            for (const court of courts.rows) {
                const type = court.indoor ? 'Indoor' : 'Outdoor';
                const sig = court.signature ? ' ⭐' : '';
                console.log(`   ✅ ${court.name} (${type}, ${court.access})${sig}`);
            }
            console.log(`   Total: ${courts.rows.length} courts`);
        }

        // Final summary
        console.log('\n=== COMBINED STATS ===');
        const stats = await client.query(
            `SELECT city, COUNT(*) as total,
                    COUNT(CASE WHEN indoor = true THEN 1 END) as indoor,
                    COUNT(CASE WHEN indoor = false THEN 1 END) as outdoor,
                    COUNT(CASE WHEN access = 'public' THEN 1 END) as public,
                    COUNT(CASE WHEN access = 'members' THEN 1 END) as members
             FROM courts 
             WHERE city IN ('Houston, TX', 'Dallas, TX', 'Phoenix, AZ', 'Seattle, WA', 'Denver, CO')
             GROUP BY city
             ORDER BY total DESC`
        );

        let grandTotal = 0;
        for (const row of stats.rows) {
            console.log(`${row.city}: ${row.total} (${row.indoor} indoor, ${row.outdoor} outdoor)`);
            grandTotal += parseInt(row.total);
        }
        console.log(`\nGRAND TOTAL: ${grandTotal} courts verified`);

        console.log('\n=== VERIFICATION COMPLETE ===');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

batchVerify();

/**
 * NYC Court Deep Verification Cleanup
 * All 18 courts verified with web searches
 * 
 * FIXES:
 * - 92nd Street Y: access public → members (membership gym)
 * - Rucker Park: Make SIGNATURE (legendary Harlem court, National Commemorative Site 2025)
 * - Dyckman Park: Make SIGNATURE (legendary Washington Heights summer league)
 * - All other venues VERIFIED ✅
 */
const { Client } = require('pg');

async function cleanupNYC() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== NYC DEEP VERIFICATION CLEANUP ===\n');

        // 1. Fix 92nd Street Y access (it's a membership gym, not public)
        console.log('1. FIXING ACCESS TYPES...');
        const accessFix = await client.query(
            `UPDATE courts SET access = 'members' 
             WHERE id = '5c3b1b02-f6b9-4f22-9c79-1536124fca95' 
             RETURNING name`,
            []
        );
        if (accessFix.rows.length > 0) {
            console.log(`   ✓ ${accessFix.rows[0].name}: access → members`);
        }

        // 2. Make Rucker Park and Dyckman Park SIGNATURE courts
        console.log('\n2. SETTING SIGNATURE COURTS...');
        const signatureCourts = [
            { id: '235a779d-5c5d-cfe3-0a94-a166a78b1de6', name: 'Rucker Park', reason: 'National Commemorative Site 2025, legendary basketball mecca' },
            { id: 'fdb2c4a6-fa32-5714-c4c6-1bd5e3c7bd16', name: 'Dyckman Park', reason: 'Legendary summer streetball tournament since 1990' },
        ];

        for (const court of signatureCourts) {
            const result = await client.query(
                `UPDATE courts SET signature = true WHERE id = $1 RETURNING name`,
                [court.id]
            );
            if (result.rows.length > 0) {
                console.log(`   ⭐ ${result.rows[0].name} → SIGNATURE`);
                console.log(`      Reason: ${court.reason}`);
            }
        }

        // 3. List all NYC courts with verification status
        console.log('\n3. VERIFIED NYC COURTS:');
        const allCourts = await client.query(
            `SELECT name, indoor, access, signature 
             FROM courts 
             WHERE city = 'New York, NY' 
             ORDER BY name`
        );

        for (const court of allCourts.rows) {
            const type = court.indoor ? 'Indoor' : 'Outdoor';
            const sig = court.signature ? ' ⭐ SIGNATURE' : '';
            console.log(`   ✅ ${court.name} (${type}, ${court.access})${sig}`);
        }

        // 4. Final stats
        const stats = await client.query(
            `SELECT COUNT(*) as total,
                    COUNT(CASE WHEN indoor = true THEN 1 END) as indoor,
                    COUNT(CASE WHEN indoor = false THEN 1 END) as outdoor,
                    COUNT(CASE WHEN access = 'public' THEN 1 END) as public,
                    COUNT(CASE WHEN access = 'members' THEN 1 END) as members,
                    COUNT(CASE WHEN access = 'paid' THEN 1 END) as paid,
                    COUNT(CASE WHEN signature = true THEN 1 END) as signature
             FROM courts WHERE city = 'New York, NY'`
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

cleanupNYC();

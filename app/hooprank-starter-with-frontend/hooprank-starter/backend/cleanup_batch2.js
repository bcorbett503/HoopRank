/**
 * Batch Court Data Cleanup - Charlotte, Boston, Nashville, San Jose
 * - Charlotte: 8 YMCA fixes
 * - Boston: 5 YMCA fixes, 1 duplicate removal
 * - Nashville: 6 YMCA fixes, 1 duplicate removal
 * - San Jose: 1 YMCA fix
 */
const { Client } = require('pg');

async function batchCleanup() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== BATCH COURT DATA CLEANUP ===\n');

        // Charlotte YMCA fixes
        const charlotteIds = [
            '91ee8347-8a01-4dd1-b7f4-3afeb9a9cd38', // Childress Klein YMCA
            '503a8872-3e83-4656-8987-3aa2d6ff8cdf', // Dowd YMCA
            '52974062-96ac-4ecb-b166-76332bf17a51', // Harris YMCA
            '83125721-37de-469d-9a29-872d385d61fb', // Johnston YMCA
            'afeef7eb-3017-4e26-95f1-d0dc9ff7741e', // Keith Family YMCA
            'f1b558a2-a7b2-464e-86a0-be6436698c50', // McCrorey YMCA
            '777a6839-c954-47db-af63-dcf6d658b2e7', // Morrison Family YMCA
            'e8463820-ee0b-4f30-894d-355a20ed4101', // Simmons YMCA
        ];

        // Boston YMCA fixes
        const bostonIds = [
            '47f3b010-1ee5-4dfd-98f5-a909fa0e174c', // Charlestown YMCA
            '4879e8f2-e370-4f50-8af4-fe1c56f1ede1', // Dorchester YMCA
            '1b1506fa-fb77-464a-8111-b38b53da66d9', // East Boston YMCA
            'e6c79bd8-5e64-4f6a-86ff-084b5f81f130', // Huntington Avenue YMCA
            '8f9c1d63-96d1-474f-8818-cdab2db1a8ab', // Roxbury YMCA (manual, will be deleted as duplicate)
        ];

        // Nashville YMCA fixes
        const nashvilleIds = [
            '5a47ad5b-ab84-4310-9616-b2309aafb596', // Bellevue YMCA
            '7e8f0083-0b7d-411c-b66d-a936171c5c22', // Donelson-Hermitage YMCA
            'f7a6f9b9-555c-484a-b623-efd0ec2963da', // Downtown Nashville YMCA
            'fe8d69c2-0095-475e-bb07-f70891bd51cd', // Green Hills YMCA (manual, will be deleted as duplicate)
            'd3711d09-43ee-4f61-8a4f-198a498be170', // Margaret Maddox YMCA
            '0df802e8-fba8-4dab-a0f2-92a9af7a3ae1', // Northwest Nashville YMCA
        ];

        // San Jose YMCA fix
        const sanJoseIds = [
            'c5f3878a-9185-4aa9-9c48-ec8ae3a92d52', // Central YMCA San Jose
        ];

        // Process Charlotte
        console.log('1. CHARLOTTE - Fixing 8 YMCA access types...');
        for (const id of charlotteIds) {
            const result = await client.query(
                `UPDATE courts SET access = 'members' WHERE id = $1 RETURNING name`,
                [id]
            );
            if (result.rows.length > 0) {
                console.log(`   ✓ ${result.rows[0].name}`);
            }
        }

        // Process Boston
        console.log('\n2. BOSTON - Fixing 5 YMCA access types...');
        for (const id of bostonIds) {
            const result = await client.query(
                `UPDATE courts SET access = 'members' WHERE id = $1 RETURNING name`,
                [id]
            );
            if (result.rows.length > 0) {
                console.log(`   ✓ ${result.rows[0].name}`);
            }
        }

        // Remove Boston duplicate
        console.log('\n   Removing Boston duplicate...');
        let delResult = await client.query(
            `DELETE FROM courts WHERE id = '8f9c1d63-96d1-474f-8818-cdab2db1a8ab' RETURNING name`
        );
        if (delResult.rows.length > 0) {
            console.log(`   ✓ Removed duplicate: ${delResult.rows[0].name}`);
        }

        // Process Nashville
        console.log('\n3. NASHVILLE - Fixing 6 YMCA access types...');
        for (const id of nashvilleIds) {
            const result = await client.query(
                `UPDATE courts SET access = 'members' WHERE id = $1 RETURNING name`,
                [id]
            );
            if (result.rows.length > 0) {
                console.log(`   ✓ ${result.rows[0].name}`);
            }
        }

        // Remove Nashville duplicate
        console.log('\n   Removing Nashville duplicate...');
        delResult = await client.query(
            `DELETE FROM courts WHERE id = 'fe8d69c2-0095-475e-bb07-f70891bd51cd' RETURNING name`
        );
        if (delResult.rows.length > 0) {
            console.log(`   ✓ Removed duplicate: ${delResult.rows[0].name}`);
        }

        // Process San Jose
        console.log('\n4. SAN JOSE - Fixing 1 YMCA access type...');
        for (const id of sanJoseIds) {
            const result = await client.query(
                `UPDATE courts SET access = 'members' WHERE id = $1 RETURNING name`,
                [id]
            );
            if (result.rows.length > 0) {
                console.log(`   ✓ ${result.rows[0].name}`);
            }
        }

        // Verify all cities
        console.log('\n=== VERIFICATION ===');
        const cities = ['Charlotte, NC', 'Boston, MA', 'Nashville, TN', 'San Jose, CA'];
        for (const city of cities) {
            const result = await client.query(
                `SELECT COUNT(*) as total,
                        COUNT(CASE WHEN access = 'public' THEN 1 END) as public,
                        COUNT(CASE WHEN access = 'members' THEN 1 END) as members,
                        COUNT(CASE WHEN access = 'paid' THEN 1 END) as paid
                 FROM courts WHERE city = $1`,
                [city]
            );
            const stats = result.rows[0];
            console.log(`${city}: ${stats.total} courts (${stats.public} public, ${stats.members} members, ${stats.paid} paid)`);
        }

        console.log('\n=== CLEANUP COMPLETE ===');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

batchCleanup();

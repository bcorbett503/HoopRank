/**
 * Batch Court Data Cleanup - San Antonio, Indianapolis, Austin
 * - Fix YMCA access types (public -> members)
 * - San Antonio: 5 fixes
 * - Indianapolis: 7 fixes  
 * - Austin: 3 fixes
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

        // San Antonio YMCA fixes
        const sanAntonioIds = [
            'cad4be2d-fd03-43d0-8bee-4e37d4553d61', // D.R. Semmes Family YMCA
            'd7c5316c-2d56-4a23-9f6a-806632a9cd5e', // Davis-Scott Family YMCA
            '6c11ff03-aa03-4362-a8e1-99f883df3e9c', // Harvey E. Najim Family YMCA
            'e0341689-35f2-4298-9989-44317ca0be84', // Mays Family YMCA at Stone Oak
            '3f7ad1ec-186d-4729-a2c8-ed11113f8121', // Mays YMCA at Potranco
        ];

        // Indianapolis YMCA fixes
        const indianapolisIds = [
            'd4aa37af-c158-4042-9fcb-af2b1e852329', // Avondale Meadows YMCA
            '1ae059a0-2234-47dc-8656-9be3c3fd27b8', // Baxter YMCA
            '9ceda53b-4cd6-4740-ae40-083e8640e8a4', // Benjamin Harrison YMCA
            '3a4cb60d-dc01-4d37-b11c-4d4a7e2bc4c2', // Irsay Family YMCA at CityWay
            '017567b8-093f-44a5-9fa2-8a9117313073', // Jordan YMCA
            '82201ffa-2fd4-4cae-9cfb-65802f751c3f', // OrthoIndy Foundation YMCA
            '0e2c3880-2260-4175-b7b8-df32a8e755c3', // Ransburg YMCA
        ];

        // Austin YMCA fixes
        const austinIds = [
            'c060ade0-0f76-4c86-bf80-7f8b9a0b08d5', // East Communities YMCA
            '66d741da-47e3-4e7b-92f9-645578e039fa', // North Austin YMCA
            'acb89b06-deea-46fa-be7b-e1bfae3745c4', // Northwest Family YMCA
        ];

        // Process San Antonio
        console.log('1. SAN ANTONIO - Fixing 5 YMCA access types...');
        for (const id of sanAntonioIds) {
            const result = await client.query(
                `UPDATE courts SET access = 'members' WHERE id = $1 RETURNING name`,
                [id]
            );
            if (result.rows.length > 0) {
                console.log(`   ✓ ${result.rows[0].name}`);
            }
        }

        // Process Indianapolis
        console.log('\n2. INDIANAPOLIS - Fixing 7 YMCA access types...');
        for (const id of indianapolisIds) {
            const result = await client.query(
                `UPDATE courts SET access = 'members' WHERE id = $1 RETURNING name`,
                [id]
            );
            if (result.rows.length > 0) {
                console.log(`   ✓ ${result.rows[0].name}`);
            }
        }

        // Process Austin
        console.log('\n3. AUSTIN - Fixing 3 YMCA access types...');
        for (const id of austinIds) {
            const result = await client.query(
                `UPDATE courts SET access = 'members' WHERE id = $1 RETURNING name`,
                [id]
            );
            if (result.rows.length > 0) {
                console.log(`   ✓ ${result.rows[0].name}`);
            }
        }

        // Verify all three cities
        console.log('\n=== VERIFICATION ===');

        const cities = ['San Antonio, TX', 'Indianapolis, IN', 'Austin, TX'];
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

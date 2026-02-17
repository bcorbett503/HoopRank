/**
 * Bay Area Complete Verification
 * 
 * MAJOR ADDITIONS:
 * - Oakland: Oakland Fieldhouse, Soldiertown, Mosswood Park, Rainbow Rec, etc.
 * - Berkeley: UC Berkeley RSF (7 courts!)
 * 
 * EXISTING: San Jose 9, Santa Clara 2, San Francisco 13, Campbell 1, Cupertino 1
 */
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

async function bayAreaComplete() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== BAY AREA COMPLETE VERIFICATION ===\n');

        // 1. Add Oakland courts
        console.log('1. ADDING OAKLAND COURTS...');
        const oaklandCourts = [
            { name: 'Oakland Fieldhouse', indoor: true, access: 'paid', lat: 37.8010, lng: -122.2710 },
            { name: 'Soldiertown (Nike)', indoor: true, access: 'paid', lat: 37.7980, lng: -122.2750 },
            { name: 'Mosswood Park Courts', indoor: false, access: 'public', lat: 37.8251, lng: -122.2608 },
            { name: 'Rainbow Recreation Center', indoor: true, access: 'public', lat: 37.7530, lng: -122.1680 },
            { name: 'Lincoln Recreation Center', indoor: true, access: 'public', lat: 37.7991, lng: -122.2723 },
            { name: 'De Fremery Park Courts', indoor: false, access: 'public', lat: 37.8088, lng: -122.2867 },
            { name: 'San Antonio Park Courts', indoor: false, access: 'public', lat: 37.7760, lng: -122.2240 },
        ];

        for (const court of oaklandCourts) {
            const existing = await client.query(
                `SELECT id FROM courts WHERE name = $1 AND city = 'Oakland, CA'`,
                [court.name]
            );

            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO courts (id, name, city, indoor, rims, source, signature, access, geog)
                     VALUES ($1, $2, 'Oakland, CA', $3, 2, 'curated', false, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography)`,
                    [uuidv4(), court.name, court.indoor, court.access, court.lng, court.lat]
                );
                console.log(`   ✅ Added: ${court.name}`);
            }
        }

        // 2. Add Berkeley courts
        console.log('\n2. ADDING BERKELEY COURTS...');
        const berkeleyCourts = [
            { name: 'UC Berkeley RSF', indoor: true, access: 'members', lat: 37.8687, lng: -122.2626 },
            { name: 'James Kenney Park Courts', indoor: false, access: 'public', lat: 37.8510, lng: -122.2890 },
            { name: 'San Pablo Park Courts', indoor: false, access: 'public', lat: 37.8560, lng: -122.2900 },
        ];

        for (const court of berkeleyCourts) {
            const existing = await client.query(
                `SELECT id FROM courts WHERE name = $1 AND city = 'Berkeley, CA'`,
                [court.name]
            );

            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO courts (id, name, city, indoor, rims, source, signature, access, geog)
                     VALUES ($1, $2, 'Berkeley, CA', $3, 2, 'curated', false, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography)`,
                    [uuidv4(), court.name, court.indoor, court.access, court.lng, court.lat]
                );
                console.log(`   ✅ Added: ${court.name}`);
            }
        }

        // 3. Verify all Bay Area cities
        const bayAreaCities = [
            'San Francisco, CA', 'Oakland, CA', 'Berkeley, CA', 'San Jose, CA',
            'Santa Clara, CA', 'Campbell, CA', 'Cupertino, CA', 'San Rafael, CA',
            'Sausalito, CA', 'Venice, CA'
        ];

        console.log('\n3. BAY AREA COURT SUMMARY:');
        let grandTotal = 0;

        for (const city of bayAreaCities) {
            const result = await client.query(
                `SELECT COUNT(*) as count FROM courts WHERE city = $1`,
                [city]
            );
            if (parseInt(result.rows[0].count) > 0) {
                console.log(`   ${city}: ${result.rows[0].count} courts`);
                grandTotal += parseInt(result.rows[0].count);
            }
        }

        console.log(`\n=== BAY AREA TOTAL: ${grandTotal} courts ===`);
        console.log('\n=== VERIFICATION COMPLETE ===');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

bayAreaComplete();

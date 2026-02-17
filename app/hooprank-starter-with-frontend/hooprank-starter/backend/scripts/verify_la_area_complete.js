/**
 * Greater LA Area Complete Verification
 * 
 * MAJOR ADDITIONS:
 * - Long Beach: Lincoln Park, Walter Pyramid (Long Beach State)
 * - Manhattan Beach: Marine Ave Park, Live Oak Park
 * - Irvine: Momentous Sports Center (21 courts!), Great Park
 * - Hermosa Beach: South Park Courts
 * 
 * EXISTING: LA 26, Pasadena 2, Beverly Hills 1, Burbank 1, etc.
 */
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

async function laAreaComplete() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
        ssl: false
    });

    try {
        await client.connect();
        console.log('=== GREATER LA AREA COMPLETE VERIFICATION ===\n');

        // 1. Add Long Beach courts
        console.log('1. ADDING LONG BEACH COURTS...');
        const longBeachCourts = [
            { name: 'Lincoln Park Courts', indoor: false, access: 'public', lat: 33.7701, lng: -118.1937 },
            { name: 'Walter Pyramid (CSULB)', indoor: true, access: 'members', lat: 33.7866, lng: -118.1153 },
            { name: 'DeForest Park Courts', indoor: false, access: 'public', lat: 33.8235, lng: -118.1680 },
            { name: 'Houghton Park Courts', indoor: false, access: 'public', lat: 33.8451, lng: -118.1876 },
            { name: '24 Hour Fitness Long Beach', indoor: true, access: 'members', lat: 33.7700, lng: -118.1550 },
        ];

        for (const court of longBeachCourts) {
            const existing = await client.query(
                `SELECT id FROM courts WHERE name = $1 AND city = 'Long Beach, CA'`,
                [court.name]
            );

            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO courts (id, name, city, indoor, rims, source, signature, access, geog)
                     VALUES ($1, $2, 'Long Beach, CA', $3, 2, 'curated', false, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography)`,
                    [uuidv4(), court.name, court.indoor, court.access, court.lng, court.lat]
                );
                console.log(`   ✅ Added: ${court.name}`);
            }
        }

        // 2. Add Manhattan Beach courts
        console.log('\n2. ADDING MANHATTAN BEACH COURTS...');
        const manhattanCourts = [
            { name: 'Marine Avenue Park Courts', indoor: false, access: 'public', lat: 33.8847, lng: -118.4109 },
            { name: 'Live Oak Park Courts', indoor: false, access: 'public', lat: 33.8920, lng: -118.3980 },
        ];

        for (const court of manhattanCourts) {
            const existing = await client.query(
                `SELECT id FROM courts WHERE name = $1 AND city = 'Manhattan Beach, CA'`,
                [court.name]
            );

            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO courts (id, name, city, indoor, rims, source, signature, access, geog)
                     VALUES ($1, $2, 'Manhattan Beach, CA', $3, 2, 'curated', false, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography)`,
                    [uuidv4(), court.name, court.indoor, court.access, court.lng, court.lat]
                );
                console.log(`   ✅ Added: ${court.name}`);
            }
        }

        // 3. Add Irvine courts
        console.log('\n3. ADDING IRVINE COURTS...');
        const irvineCourts = [
            { name: 'Momentous Sports Center', indoor: true, access: 'paid', lat: 33.7175, lng: -117.7756 },
            { name: 'Great Park Sports Complex', indoor: false, access: 'public', lat: 33.6694, lng: -117.7624 },
            { name: 'Life Time Lakeshore Irvine', indoor: true, access: 'members', lat: 33.6589, lng: -117.7406 },
        ];

        for (const court of irvineCourts) {
            const existing = await client.query(
                `SELECT id FROM courts WHERE name = $1 AND city = 'Irvine, CA'`,
                [court.name]
            );

            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO courts (id, name, city, indoor, rims, source, signature, access, geog)
                     VALUES ($1, $2, 'Irvine, CA', $3, 2, 'curated', false, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography)`,
                    [uuidv4(), court.name, court.indoor, court.access, court.lng, court.lat]
                );
                console.log(`   ✅ Added: ${court.name}`);
            }
        }

        // 4. Add Hermosa Beach courts
        console.log('\n4. ADDING HERMOSA BEACH COURTS...');
        const hermosaCourts = [
            { name: 'South Park Basketball Courts', indoor: false, access: 'public', lat: 33.8622, lng: -118.3988 },
        ];

        for (const court of hermosaCourts) {
            const existing = await client.query(
                `SELECT id FROM courts WHERE name = $1 AND city = 'Hermosa Beach, CA'`,
                [court.name]
            );

            if (existing.rows.length === 0) {
                await client.query(
                    `INSERT INTO courts (id, name, city, indoor, rims, source, signature, access, geog)
                     VALUES ($1, $2, 'Hermosa Beach, CA', $3, 2, 'curated', false, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography)`,
                    [uuidv4(), court.name, court.indoor, court.access, court.lng, court.lat]
                );
                console.log(`   ✅ Added: ${court.name}`);
            }
        }

        // 5. Summary of all LA area courts
        const laAreaCities = [
            'Los Angeles, CA', 'Venice, CA', 'Long Beach, CA', 'Pasadena, CA',
            'Beverly Hills, CA', 'Santa Monica, CA', 'Burbank, CA', 'Glendale, CA',
            'Culver City, CA', 'Torrance, CA', 'Manhattan Beach, CA', 'Hermosa Beach, CA',
            'Irvine, CA', 'Anaheim, CA', 'Orange, CA'
        ];

        console.log('\n5. GREATER LA AREA SUMMARY:');
        let grandTotal = 0;

        for (const city of laAreaCities) {
            const result = await client.query(
                `SELECT COUNT(*) as count FROM courts WHERE city = $1`,
                [city]
            );
            if (parseInt(result.rows[0].count) > 0) {
                console.log(`   ${city}: ${result.rows[0].count} courts`);
                grandTotal += parseInt(result.rows[0].count);
            }
        }

        console.log(`\n=== GREATER LA AREA TOTAL: ${grandTotal} courts ===`);
        console.log('\n=== VERIFICATION COMPLETE ===');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

laAreaComplete();

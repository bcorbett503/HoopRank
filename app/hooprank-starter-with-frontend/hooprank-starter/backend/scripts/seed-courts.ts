/**
 * Seed Courts Script
 * 
 * This script populates the courts table in the database.
 * 
 * Usage:
 *   Local SQLite:  npx ts-node scripts/seed-courts.ts
 *   Production:    DATABASE_URL="postgresql://..." npx ts-node scripts/seed-courts.ts
 */

import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface CourtData {
    id?: string;
    name: string;
    lat: number;
    lng: number;
    city?: string;
    address?: string;
    numCourts?: number;
    lit?: boolean;
    indoor?: boolean;
    score?: number;
    source?: string;
}

async function seedCourts() {
    const databaseUrl = process.env.DATABASE_URL;

    // Configure data source based on environment
    const dataSource = new DataSource(databaseUrl ? {
        type: 'postgres',
        url: databaseUrl,
        synchronize: true, // Will create tables if needed
        ssl: false,
    } : {
        type: 'better-sqlite3',
        database: 'hooprank.db',
        synchronize: true,
    } as any);

    try {
        await dataSource.initialize();
        console.log('Database connected');

        // Load courts data
        const dataPath = path.join(__dirname, '..', 'src', 'courts-us-popular.json');
        const rawData = fs.readFileSync(dataPath, 'utf8');
        const courtsData: CourtData[] = JSON.parse(rawData);

        console.log(`Loaded ${courtsData.length} courts from JSON`);

        // Check if courts already exist
        const existingCount = await dataSource.query('SELECT COUNT(*) as count FROM courts');
        const count = parseInt(existingCount[0]?.count || '0', 10);

        if (count > 0) {
            console.log(`Database already has ${count} courts. Skipping seed.`);
            console.log('To force re-seed, run: DELETE FROM courts;');
            await dataSource.destroy();
            return;
        }

        // Insert courts in batches
        const batchSize = 50;
        let inserted = 0;

        for (let i = 0; i < courtsData.length; i += batchSize) {
            const batch = courtsData.slice(i, i + batchSize);

            for (const court of batch) {
                const id = court.id || uuidv4();
                const isPostgres = !!databaseUrl;

                if (isPostgres) {
                    await dataSource.query(`
                        INSERT INTO courts (id, name, lat, lng, address, city, num_courts, lit, indoor, score, source, created_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
                        ON CONFLICT (id) DO NOTHING
                    `, [
                        id,
                        court.name || 'Unknown Court',
                        court.lat,
                        court.lng,
                        court.city || null, // Use city as address fallback
                        court.city || null,
                        court.numCourts || 1,
                        court.lit || false,
                        court.indoor || false,
                        court.score || null,
                        court.source || null,
                    ]);
                } else {
                    await dataSource.query(`
                        INSERT OR IGNORE INTO courts (id, name, lat, lng, address, city, num_courts, lit, indoor, score, source, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    `, [
                        id,
                        court.name || 'Unknown Court',
                        court.lat,
                        court.lng,
                        court.city || null,
                        court.city || null,
                        court.numCourts || 1,
                        court.lit ? 1 : 0,
                        court.indoor ? 1 : 0,
                        court.score || null,
                        court.source || null,
                    ]);
                }
                inserted++;
            }

            console.log(`Inserted ${inserted}/${courtsData.length} courts...`);
        }

        console.log(`\n✅ Successfully seeded ${inserted} courts!`);

        // Verify
        const verifyCount = await dataSource.query('SELECT COUNT(*) as count FROM courts');
        console.log(`Verification: ${verifyCount[0]?.count} courts in database`);

    } catch (error) {
        console.error('Error seeding courts:', error);
        process.exit(1);
    } finally {
        await dataSource.destroy();
    }
}

seedCourts();

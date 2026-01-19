// src/db/pool.ts
// Centralized database connection pool configuration
import "dotenv/config";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL ?? "";

export const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 30,                       // Increased from 20 for better concurrency
    idleTimeoutMillis: 60000,      // Increased from 30000 for connection reuse
    connectionTimeoutMillis: 5000, // Increased from 2000 for reliability
});

// Auto-migration: Add missing columns on startup (runs once)
let migrationRan = false;
export async function runAutoMigrations() {
    if (migrationRan) return;
    migrationRan = true;
    try {
        // Add columns for team matches if they don't exist
        await pool.query(`
            ALTER TABLE matches 
            ADD COLUMN IF NOT EXISTS score_creator INTEGER,
            ADD COLUMN IF NOT EXISTS score_opponent INTEGER,
            ADD COLUMN IF NOT EXISTS winner_id TEXT,
            ADD COLUMN IF NOT EXISTS creator_team_id UUID,
            ADD COLUMN IF NOT EXISTS opponent_team_id UUID
        `);
        console.log("Auto-migration: team match columns checked/added");

        // Add lat/lng and birthdate columns to users table if they don't exist
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
            ADD COLUMN IF NOT EXISTS birthdate DATE
        `);
        console.log("Auto-migration: lat/lng/birthdate columns checked/added");

        // Backfill lat/lng for users with ZIP but no coordinates (runs once per restart)
        const usersToUpdate = await pool.query(`
            SELECT id, zip FROM users 
            WHERE zip IS NOT NULL AND zip != '' 
            AND (lat IS NULL OR lng IS NULL)
            LIMIT 20
        `);

        if (usersToUpdate.rowCount && usersToUpdate.rowCount > 0) {
            console.log(`Backfilling ${usersToUpdate.rowCount} users with locations from ZIP...`);
            for (const user of usersToUpdate.rows) {
                try {
                    const zip = user.zip.substring(0, 5);
                    const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
                    if (response.ok) {
                        const data = await response.json() as { places?: Array<{ latitude: string; longitude: string; 'place name': string; 'state abbreviation': string }> };
                        const place = data.places?.[0];
                        if (place) {
                            const lat = parseFloat(place.latitude);
                            const lng = parseFloat(place.longitude);
                            const city = `${place['place name']}, ${place['state abbreviation']}`;

                            await pool.query(`
                                UPDATE users SET lat = $2, lng = $3, city = $4 WHERE id = $1
                            `, [user.id, lat, lng, city]);
                            console.log(`Updated ${user.id}: ${zip} -> ${lat}, ${lng}`);
                        }
                    }
                    await new Promise(r => setTimeout(r, 100)); // Throttle API
                } catch (e) {
                    console.error(`Backfill error for ${user.id}:`, e);
                }
            }
        }
    } catch (e) {
        console.error("Auto-migration failed (non-fatal):", e);
    }
}

// Run migration on pool initialization
runAutoMigrations().catch(() => { });


// Transaction helper for atomic operations
export async function withTx<T>(fn: (c: import("pg").PoolClient) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try {
        await c.query("BEGIN");
        const out = await fn(c);
        await c.query("COMMIT");
        return out;
    } catch (e) {
        await c.query("ROLLBACK");
        throw e;
    } finally {
        c.release();
    }
}

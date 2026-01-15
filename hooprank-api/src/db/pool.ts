// src/db/pool.ts
// Centralized database connection pool configuration
import "dotenv/config";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL ?? "";

export const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

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

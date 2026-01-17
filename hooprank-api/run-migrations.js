import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Railway DATABASE_URL - CORRECT: Postgres service (used by app)
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:YCSWhJfsGHwgErOUfqMDyWDzoKOQbQpy@shuttle.proxy.rlwy.net:48496/railway';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'backend', 'sql', 'migrations');

// Remove BOM from string if present
function stripBOM(content) {
    if (content.charCodeAt(0) === 0xFEFF) {
        return content.slice(1);
    }
    return content;
}

async function runMigrations() {
    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected!');

        // Get all SQL files sorted by name
        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort();

        console.log(`Found ${files.length} migration files`);

        for (const file of files) {
            console.log(`\nRunning: ${file}...`);
            let sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
            sql = stripBOM(sql);  // Strip BOM if present

            try {
                await client.query(sql);
                console.log(`✓ ${file} completed`);
            } catch (err) {
                console.error(`✗ ${file} failed: ${err.message}`);
                // Continue with other migrations
            }
        }

        console.log('\n=== Migration complete! ===');

        // Show tables
        const tables = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
        console.log('\nTables created:');
        tables.rows.forEach(r => console.log(`  - ${r.tablename}`));
        console.log(`\nTotal: ${tables.rows.length} tables`);

    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigrations();

import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL = 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway';

const pool = new Pool({ connectionString: DATABASE_URL });

async function checkDatabase() {
    try {
        console.log('Connecting to Railway PostGIS database...');

        // Get all tables
        const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

        console.log('\n=== Tables in online database ===');
        tablesResult.rows.forEach(row => console.log('  -', row.table_name));
        console.log(`Total: ${tablesResult.rows.length} tables`);

        // Get indexes
        const indexesResult = await pool.query(`
      SELECT indexname, tablename
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

        console.log('\n=== Indexes ===');
        indexesResult.rows.forEach(row => console.log(`  - ${row.tablename}: ${row.indexname}`));
        console.log(`Total: ${indexesResult.rows.length} indexes`);

        // Check specific tables we need
        const requiredTables = ['users', 'matches', 'messages', 'threads', 'teams', 'team_members', 'team_challenges'];
        console.log('\n=== Required Tables Status ===');
        for (const table of requiredTables) {
            const exists = tablesResult.rows.some(r => r.table_name === table);
            console.log(`  ${exists ? '✓' : '✗'} ${table}`);
        }

        // Count rows in key tables
        console.log('\n=== Row Counts ===');
        for (const table of ['users', 'matches', 'teams', 'messages', 'threads']) {
            try {
                const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
                console.log(`  ${table}: ${countResult.rows[0].count} rows`);
            } catch (e) {
                console.log(`  ${table}: table not found`);
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkDatabase();

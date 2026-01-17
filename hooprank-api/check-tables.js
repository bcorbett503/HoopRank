import pg from 'pg';
const { Client } = pg;

// Railway DATABASE_URL
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway';

async function checkTables() {
    const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected!');

        // Check if threads table exists
        const result = await client.query(`
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);

        console.log('\\nTables in database:');
        result.rows.forEach(r => console.log(`  - ${r.tablename}`));
        console.log(`\\nTotal: ${result.rows.length} tables`);

        // Check specifically for threads
        const threadsCheck = result.rows.find(r => r.tablename === 'threads');
        if (threadsCheck) {
            console.log('\\n✓ threads table EXISTS');
        } else {
            console.log('\\n✗ threads table MISSING - creating now...');
            await client.query(`
                CREATE TABLE IF NOT EXISTS threads (
                    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_a text NOT NULL,
                    user_b text NOT NULL,
                    last_message_at timestamptz,
                    created_at timestamptz NOT NULL DEFAULT now(),
                    UNIQUE (user_a, user_b)
                );
            `);
            console.log('✓ threads table created');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

checkTables();

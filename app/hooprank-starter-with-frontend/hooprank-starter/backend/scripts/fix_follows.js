// fix_follows.js - Verify and fix user_followed_courts table constraint
const { Client } = require('pg');

// Use the DATABASE_URL from environment or fallback
const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL ||
    'postgresql://postgres:PgWRGfwrQprwVnLpYMNLSNxlNKNTIuxO@autorack.proxy.rlwy.net:52122/railway';

async function main() {
    console.log('Connecting to database...');
    console.log('URL (masked):', PROD_DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

    const client = new Client({
        connectionString: PROD_DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 30000,
    });

    try {
        await client.connect();
        console.log('Connected to production database');

        // Check if table exists and its structure
        console.log('\n--- Checking user_followed_courts table ---');
        const tableCheck = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user_followed_courts'
            ORDER BY ordinal_position
        `);

        if (tableCheck.rows.length === 0) {
            console.log('Table user_followed_courts does not exist! Creating it...');
            await client.query(`
                CREATE TABLE user_followed_courts (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    court_id VARCHAR(255) NOT NULL,
                    alerts_enabled BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, court_id)
                )
            `);
            console.log('Created user_followed_courts table');
        } else {
            console.log('Table exists with columns:', tableCheck.rows.map(r => r.column_name).join(', '));

            // Check for unique constraint
            const constraintCheck = await client.query(`
                SELECT con.conname, pg_get_constraintdef(con.oid)
                FROM pg_constraint con
                JOIN pg_class rel ON rel.oid = con.conrelid
                WHERE rel.relname = 'user_followed_courts' AND con.contype = 'u'
            `);

            if (constraintCheck.rows.length === 0) {
                console.log('No unique constraint found! Adding it...');
                try {
                    await client.query(`
                        ALTER TABLE user_followed_courts 
                        ADD CONSTRAINT user_followed_courts_user_court_unique UNIQUE (user_id, court_id)
                    `);
                    console.log('Added unique constraint');
                } catch (e) {
                    if (e.message.includes('already exists')) {
                        console.log('Constraint may already exist under different name');
                    } else {
                        console.log('Could not add constraint:', e.message);
                    }
                }
            } else {
                console.log('Unique constraints:', constraintCheck.rows);
            }
        }

        // Also check user_followed_players
        console.log('\n--- Checking user_followed_players table ---');
        const playersCheck = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user_followed_players'
            ORDER BY ordinal_position
        `);

        if (playersCheck.rows.length === 0) {
            console.log('Table user_followed_players does not exist! Creating it...');
            await client.query(`
                CREATE TABLE user_followed_players (
                    id SERIAL PRIMARY KEY,
                    follower_id VARCHAR(255) NOT NULL,
                    followed_id VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(follower_id, followed_id)
                )
            `);
            console.log('Created user_followed_players table');
        } else {
            console.log('Columns:', playersCheck.rows.map(r => r.column_name).join(', '));
        }

        // Test the insert
        console.log('\n--- Testing insert operation ---');
        try {
            await client.query(`
                INSERT INTO user_followed_courts (user_id, court_id)
                VALUES ($1, $2)
                ON CONFLICT (user_id, court_id) DO NOTHING
            `, ['test-user', 'test-court']);
            console.log('Test insert succeeded!');

            // Clean up test
            await client.query(`DELETE FROM user_followed_courts WHERE user_id = $1`, ['test-user']);
            console.log('Cleaned up test data');
        } catch (e) {
            console.log('Test insert failed:', e.message);
        }

        console.log('\n✅ Database check complete!');

    } catch (err) {
        console.error('Error:', err.message);
        console.error('Stack:', err.stack);
    } finally {
        await client.end();
    }
}

main();

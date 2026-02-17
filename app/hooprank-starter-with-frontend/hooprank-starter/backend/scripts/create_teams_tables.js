// create_teams_tables.js - Create teams and team_members tables
const { Client } = require('pg');

const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL ||
    'postgresql://postgres:PgWRGfwrQprwVnLpYMNLSNxlNKNTIuxO@autorack.proxy.rlwy.net:52122/railway';

async function connectWithRetry(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        console.log(`Connection attempt ${i + 1}/${maxRetries}...`);
        const client = new Client({
            connectionString: PROD_DATABASE_URL,
            ssl: false,
            connectionTimeoutMillis: 45000,
        });

        try {
            await client.connect();
            return client;
        } catch (err) {
            console.log(`Attempt ${i + 1} failed: ${err.message}`);
            if (i === maxRetries - 1) throw err;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

async function main() {
    console.log('Connecting to database...');
    console.log('URL (masked):', PROD_DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

    let client;
    try {
        client = await connectWithRetry();
        console.log('Connected to production database');

        // Create teams table
        console.log('\n--- Creating teams table ---');
        await client.query(`
            CREATE TABLE IF NOT EXISTS teams (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                team_type TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                rating NUMERIC(3,1) DEFAULT 3.0,
                wins INT DEFAULT 0,
                losses INT DEFAULT 0,
                logo_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created teams table');

        // Create team_members table
        console.log('\n--- Creating team_members table ---');
        await client.query(`
            CREATE TABLE IF NOT EXISTS team_members (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                team_id UUID NOT NULL,
                user_id TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                role TEXT DEFAULT 'member',
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(team_id, user_id)
            )
        `);
        console.log('✅ Created team_members table');

        // Create indexes
        console.log('\n--- Creating indexes ---');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_teams_type ON teams(team_type)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status)`);
        console.log('✅ Created indexes');

        // Verify tables exist
        console.log('\n--- Verifying tables ---');
        const teamsCheck = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'teams'
            ORDER BY ordinal_position
        `);
        console.log('teams columns:', teamsCheck.rows.map(r => r.column_name).join(', '));

        const membersCheck = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'team_members'
            ORDER BY ordinal_position
        `);
        console.log('team_members columns:', membersCheck.rows.map(r => r.column_name).join(', '));

        console.log('\n✅ Teams migration complete!');

    } catch (err) {
        console.error('Error:', err.message);
        console.error('Stack:', err.stack);
    } finally {
        if (client) {
            await client.end();
        }
    }
}

main();

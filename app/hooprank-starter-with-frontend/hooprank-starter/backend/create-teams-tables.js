const { Client } = require('pg');

async function createTeamsTables() {
    const client = new Client({
        connectionString: 'postgresql://postgres:YCSWhJfsGHwgErOUfqMDyWDzoKOQbQpy@shuttle.proxy.rlwy.net:48496/railway',
        ssl: false,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Create teams table
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
      );
    `);
        console.log('Created teams table');

        // Create team_members table
        await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        role TEXT DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(team_id, user_id)
      );
    `);
        console.log('Created team_members table');

        // Verify tables exist
        const result = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('teams', 'team_members')
      ORDER BY table_name;
    `);
        console.log('Tables created:', result.rows.map(r => r.table_name).join(', '));

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('Done');
    }
}

createTeamsTables();

const { Client } = require('pg');

async function createTeamMessagesTable() {
    const client = new Client({
        connectionString: 'postgresql://postgres:YCSWhJfsGHwgErOUfqMDyWDzoKOQbQpy@shuttle.proxy.rlwy.net:48496/railway',
        ssl: false,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Create team_messages table
        await client.query(`
      CREATE TABLE IF NOT EXISTS team_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
        console.log('Created team_messages table');

        // Create index for faster queries
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_team_messages_team_id ON team_messages(team_id);
    `);
        console.log('Created index on team_id');

        // Verify table exists
        const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'team_messages' 
      ORDER BY ordinal_position;
    `);
        console.log('\\nTable structure:');
        result.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('\\nDone');
    }
}

createTeamMessagesTable();

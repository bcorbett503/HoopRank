const { Client } = require('pg');

async function verifyTeamsTables() {
    const client = new Client({
        connectionString: 'postgresql://postgres:YCSWhJfsGHwgErOUfqMDyWDzoKOQbQpy@shuttle.proxy.rlwy.net:48496/railway',
        ssl: false,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Check table structure
        console.log('\n=== TEAMS TABLE ===');
        const teamsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'teams' 
      ORDER BY ordinal_position;
    `);
        teamsResult.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : ''} ${row.column_default ? 'DEFAULT ' + row.column_default : ''}`);
        });

        console.log('\n=== TEAM_MEMBERS TABLE ===');
        const membersResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'team_members' 
      ORDER BY ordinal_position;
    `);
        membersResult.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : ''} ${row.column_default ? 'DEFAULT ' + row.column_default : ''}`);
        });

        // Count rows
        console.log('\n=== ROW COUNTS ===');
        const teamsCount = await client.query('SELECT COUNT(*) FROM teams');
        const membersCount = await client.query('SELECT COUNT(*) FROM team_members');
        console.log(`  teams: ${teamsCount.rows[0].count} rows`);
        console.log(`  team_members: ${membersCount.rows[0].count} rows`);

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
        console.log('\nDone');
    }
}

verifyTeamsTables();

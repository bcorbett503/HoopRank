const { Client } = require('pg');

async function purgeAndInvestigate() {
    const client = new Client({
        connectionString: 'postgresql://postgres:YCSWhJfsGHwgErOUfqMDyWDzoKOQbQpy@shuttle.proxy.rlwy.net:48496/railway',
        ssl: false,
    });

    try {
        await client.connect();
        console.log('Connected to database\n');

        // 1. Show current team data counts
        console.log('=== CURRENT DATA ===');
        const teamCount = await client.query('SELECT COUNT(*) FROM teams');
        console.log('Teams:', teamCount.rows[0].count);

        const memberCount = await client.query('SELECT COUNT(*) FROM team_members');
        console.log('Team Members:', memberCount.rows[0].count);

        const msgCount = await client.query('SELECT COUNT(*) FROM team_messages');
        console.log('Team Messages:', msgCount.rows[0].count);

        // 2. Purge all team data
        console.log('\n=== PURGING ALL TEAM DATA ===');
        await client.query('DELETE FROM team_messages');
        console.log('Deleted all team_messages');

        await client.query('DELETE FROM team_members');
        console.log('Deleted all team_members');

        await client.query('DELETE FROM teams');
        console.log('Deleted all teams');

        // 3. Verify purge
        console.log('\n=== VERIFICATION ===');
        const teamCount2 = await client.query('SELECT COUNT(*) FROM teams');
        console.log('Teams:', teamCount2.rows[0].count);

        const memberCount2 = await client.query('SELECT COUNT(*) FROM team_members');
        console.log('Team Members:', memberCount2.rows[0].count);

        const msgCount2 = await client.query('SELECT COUNT(*) FROM team_messages');
        console.log('Team Messages:', msgCount2.rows[0].count);

        // 4. Check table schemas
        console.log('\n=== TABLE SCHEMAS ===');
        const teamsSchema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'teams' 
      ORDER BY ordinal_position
    `);
        console.log('\nteams table:');
        teamsSchema.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`));

        const membersSchema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'team_members' 
      ORDER BY ordinal_position
    `);
        console.log('\nteam_members table:');
        membersSchema.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`));

        console.log('\n=== DONE ===');

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    } finally {
        await client.end();
    }
}

purgeAndInvestigate();

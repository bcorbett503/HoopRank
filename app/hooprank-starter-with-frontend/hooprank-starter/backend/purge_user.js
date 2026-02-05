const { Client } = require('pg');

const USER_ID = '06z4LDEp0TflIbvWiWaSzwVFuvD2';
const DATABASE_URL = 'postgresql://postgres:PgWRGfwrQprwVnLpYMNLSNxlNKNTIuxO@autorack.proxy.rlwy.net:52122/railway';

async function purgeUser() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: false,
        connectionTimeoutMillis: 45000,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Delete in order respecting foreign keys
        const tables = [
            { table: 'status_likes', col: 'user_id' },
            { table: 'status_comments', col: 'user_id' },
            { table: 'event_attendees', col: 'user_id' },
            { table: 'player_statuses', col: 'user_id' },
            { table: 'check_ins', col: 'user_id' },
            { table: 'user_followed_courts', col: 'user_id' },
            { table: 'user_followed_players', col: 'follower_id' },
            { table: 'user_followed_players', col: 'followed_id' },
            { table: 'user_court_alerts', col: 'user_id' },
            { table: 'friendships', col: 'user_id' },
            { table: 'friendships', col: 'friend_id' },
            { table: 'team_members', col: 'user_id' },
            { table: 'messages', col: 'from_id' },
            { table: 'messages', col: 'to_id' },
            { table: 'matches', col: 'creator_id' },
            { table: 'matches', col: 'opponent_id' },
            { table: 'challenges', col: 'challenger_id' },
            { table: 'challenges', col: 'challenged_id' },
        ];

        for (const t of tables) {
            try {
                const result = await client.query(
                    `DELETE FROM ${t.table} WHERE ${t.col} = $1`,
                    [USER_ID]
                );
                if (result.rowCount > 0) {
                    console.log(`Deleted ${result.rowCount} rows from ${t.table} (${t.col})`);
                }
            } catch (e) {
                // Table might not exist, skip
            }
        }

        // Finally delete the user
        const userResult = await client.query(
            'DELETE FROM users WHERE id = $1 RETURNING name, email',
            [USER_ID]
        );
        if (userResult.rowCount > 0) {
            console.log(`Deleted user: ${userResult.rows[0].name} (${userResult.rows[0].email})`);
        } else {
            console.log('User not found');
        }

        console.log('Done!');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await client.end();
    }
}

purgeUser();

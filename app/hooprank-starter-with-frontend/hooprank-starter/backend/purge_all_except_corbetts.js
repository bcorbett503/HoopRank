/**
 * Purge ALL users and related data EXCEPT Brett, Kevin, and Richard Corbett.
 * Courts are preserved. Only user-generated data is removed.
 */
const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:PgWRGfwrQprwVnLpYMNLSNxlNKNTIuxO@autorack.proxy.rlwy.net:52122/railway';

const KEEP_IDS = [
    '4ODZUrySRUhFDC5wVW6dCySBprD2', // Brett Corbett
    '0OW2dC3NsqexmTFTXgu57ZQfaIo2', // Kevin Corbett
    'Zc3Ey4VTslZ3VxsPtcqulmMw9e53', // Richard Corbett
];

const KEEP_LIST = KEEP_IDS.map(id => `'${id}'`).join(',');

async function purge() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: false,
        connectionTimeoutMillis: 30000,
        keepAlive: true,
    });

    try {
        await client.connect();
        console.log('Connected.\n');

        // Preview who will be deleted
        const preview = await client.query(
            `SELECT id, name FROM users WHERE id NOT IN (${KEEP_LIST}) ORDER BY name`
        );
        console.log(`Will delete ${preview.rowCount} users (keeping ${KEEP_IDS.length}):`);
        preview.rows.forEach(u => console.log(`  - ${u.name} (${u.id.substring(0, 8)}…)`));
        console.log('');

        // Delete from child tables first (foreign key order)
        const deletions = [
            `DELETE FROM status_likes WHERE user_id NOT IN (${KEEP_LIST})`,
            `DELETE FROM status_comments WHERE user_id NOT IN (${KEEP_LIST})`,
            `DELETE FROM event_attendees WHERE user_id NOT IN (${KEEP_LIST})`,
            `DELETE FROM player_statuses WHERE user_id NOT IN (${KEEP_LIST})`,
            `DELETE FROM check_ins WHERE user_id NOT IN (${KEEP_LIST})`,
            `DELETE FROM user_followed_courts WHERE user_id NOT IN (${KEEP_LIST})`,
            `DELETE FROM user_followed_players WHERE follower_id NOT IN (${KEEP_LIST}) OR followed_id NOT IN (${KEEP_LIST})`,
            `DELETE FROM user_court_alerts WHERE user_id NOT IN (${KEEP_LIST})`,
            `DELETE FROM friendships WHERE user_id NOT IN (${KEEP_LIST}) OR friend_id NOT IN (${KEEP_LIST})`,
            `DELETE FROM team_members WHERE user_id NOT IN (${KEEP_LIST})`,
            `DELETE FROM run_attendees WHERE user_id NOT IN (${KEEP_LIST})`,
            `DELETE FROM scheduled_runs WHERE created_by NOT IN (${KEEP_LIST})`,
            `DELETE FROM messages WHERE from_id NOT IN (${KEEP_LIST}) OR to_id NOT IN (${KEEP_LIST})`,
            `DELETE FROM challenges WHERE challenger_id NOT IN (${KEEP_LIST}) OR challenged_id NOT IN (${KEEP_LIST})`,
            `DELETE FROM matches WHERE creator_id NOT IN (${KEEP_LIST}) OR opponent_id NOT IN (${KEEP_LIST})`,
            `DELETE FROM teams WHERE created_by NOT IN (${KEEP_LIST})`,
            // Finally: users
            `DELETE FROM users WHERE id NOT IN (${KEEP_LIST})`,
        ];

        for (const sql of deletions) {
            try {
                const result = await client.query(sql);
                const table = sql.match(/FROM (\w+)/)?.[1] || '?';
                if (result.rowCount > 0) {
                    console.log(`  ✓ ${table}: deleted ${result.rowCount} rows`);
                }
            } catch (e) {
                const table = sql.match(/FROM (\w+)/)?.[1] || '?';
                console.log(`  ⚠ ${table}: ${e.message}`);
            }
        }

        // Verify
        const remaining = await client.query('SELECT id, name FROM users ORDER BY name');
        console.log(`\nRemaining users (${remaining.rowCount}):`);
        remaining.rows.forEach(u => console.log(`  ✓ ${u.name}`));

        console.log('\nDone!');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await client.end();
    }
}

purge();

/**
 * Purge all users except Brett, Richard, and Kevin Corbett.
 * 
 * Phase 1: DRY RUN - lists users that would be deleted
 * Phase 2: DELETE  - run with --confirm flag to execute
 *
 * Usage:
 *   node purge_non_corbett_users.js           # dry run
 *   node purge_non_corbett_users.js --confirm # actually purge
 */
const { Client } = require('pg');

const CONFIRM = process.argv.includes('--confirm');

async function purge() {
    const client = new Client({
        connectionString: 'postgresql://postgres:Ceac3EEc14fEgd4DedCD123EBFCC551A@gondola.proxy.rlwy.net:25976/railway',
        ssl: false,
    });

    try {
        await client.connect();
        console.log(`\n=== PURGE NON-CORBETT USERS ${CONFIRM ? '(LIVE)' : '(DRY RUN)'} ===\n`);

        // Step 1: Find users to KEEP (name ILIKE any Corbett variant)
        const keepResult = await client.query(
            `SELECT id, name, email, created_at FROM users
             WHERE name ILIKE '%Brett%Corbett%'
                OR name ILIKE '%Richard%Corbett%'
                OR name ILIKE '%Kevin%Corbett%'
             ORDER BY name`
        );
        const keepIds = keepResult.rows.map(r => r.id);
        console.log(`Users to KEEP (${keepIds.length}):`);
        keepResult.rows.forEach(u => console.log(`  ✅ ${u.name}  (${u.id})  ${u.email || ''}`));

        if (keepIds.length === 0) {
            console.log('\n⚠️  No Corbett users found! Aborting to be safe.');
            return;
        }

        // Step 2: Find users to DELETE
        const deleteResult = await client.query(
            `SELECT id, name, email, created_at FROM users
             WHERE id NOT IN (${keepIds.map((_, i) => `$${i + 1}`).join(',')})
             ORDER BY name`,
            keepIds
        );
        console.log(`\nUsers to DELETE (${deleteResult.rows.length}):`);
        deleteResult.rows.forEach(u => console.log(`  ❌ ${u.name}  (${u.id})  ${u.email || ''}`));

        if (deleteResult.rows.length === 0) {
            console.log('\nNo users to delete. Done!');
            return;
        }

        if (!CONFIRM) {
            console.log(`\n--- DRY RUN --- Run with --confirm to actually delete these ${deleteResult.rows.length} users.`);
            return;
        }

        // Step 3: LIVE DELETE — cascading order to respect foreign keys
        const placeholder = keepIds.map((_, i) => `$${i + 1}`).join(',');

        const deletes = [
            // Status-related
            [`DELETE FROM status_likes WHERE user_id NOT IN (${placeholder})`, 'status_likes (by user_id)'],
            [`DELETE FROM status_comments WHERE user_id NOT IN (${placeholder})`, 'status_comments (by user_id)'],
            [`DELETE FROM event_attendees WHERE user_id NOT IN (${placeholder})`, 'event_attendees'],
            [`DELETE FROM player_statuses WHERE user_id NOT IN (${placeholder})`, 'player_statuses'],

            // Following / social
            [`DELETE FROM user_followed_courts WHERE user_id NOT IN (${placeholder})`, 'user_followed_courts'],
            [`DELETE FROM user_followed_players WHERE follower_id NOT IN (${placeholder}) OR followed_id NOT IN (${placeholder})`, 'user_followed_players'],
            [`DELETE FROM check_ins WHERE user_id NOT IN (${placeholder})`, 'check_ins'],

            // Messaging
            [`DELETE FROM messages WHERE from_id NOT IN (${placeholder}) OR to_id NOT IN (${placeholder})`, 'messages'],

            // Matches
            [`DELETE FROM matches WHERE creator_id NOT IN (${placeholder}) OR opponent_id NOT IN (${placeholder})`, 'matches'],

            // Teams
            [`DELETE FROM team_event_attendance WHERE user_id NOT IN (${placeholder})`, 'team_event_attendance'],
            [`DELETE FROM team_messages WHERE user_id NOT IN (${placeholder})`, 'team_messages'],
            [`DELETE FROM team_members WHERE user_id NOT IN (${placeholder})`, 'team_members'],

            // Runs
            [`DELETE FROM run_attendees WHERE user_id NOT IN (${placeholder})`, 'run_attendees'],

            // Friendships
            [`DELETE FROM friendships WHERE user_id NOT IN (${placeholder}) OR friend_id NOT IN (${placeholder})`, 'friendships'],

            // Challenges
            [`DELETE FROM challenges WHERE from_user_id NOT IN (${placeholder}) OR to_user_id NOT IN (${placeholder})`, 'challenges'],

            // Finally delete the users
            [`DELETE FROM users WHERE id NOT IN (${placeholder})`, 'users'],
        ];

        console.log('\nExecuting cascading deletes...');

        // For queries with dual NOT IN clauses, we need to double the keepIds params
        for (const [sql, label] of deletes) {
            // Count how many parameter references are in the SQL
            const paramRefCount = (sql.match(/NOT IN/g) || []).length;
            const params = paramRefCount > 1
                ? [...keepIds, ...keepIds]  // duplicate for OR'd NOT IN clauses
                : keepIds;

            // Rewrite $N placeholders for the duplicated params
            let fixedSql = sql;
            if (paramRefCount > 1) {
                // Replace the second (${placeholder}) with offset params
                const secondPlaceholder = keepIds.map((_, i) => `$${keepIds.length + i + 1}`).join(',');
                // Find the second NOT IN and replace its placeholder set
                let firstFound = false;
                fixedSql = sql.replace(new RegExp(`\\(${escapeRegex(placeholder)}\\)`, 'g'), (match) => {
                    if (!firstFound) {
                        firstFound = true;
                        return match; // keep first as-is
                    }
                    return `(${secondPlaceholder})`;
                });
            }

            try {
                const result = await client.query(fixedSql, params);
                console.log(`  ✓ ${label}: ${result.rowCount} rows deleted`);
            } catch (e) {
                // Table might not exist — not fatal
                console.log(`  ⚠ ${label}: ${e.message}`);
            }
        }

        // Verify
        const remaining = await client.query('SELECT id, name FROM users ORDER BY name');
        console.log(`\n=== REMAINING USERS (${remaining.rows.length}) ===`);
        remaining.rows.forEach(u => console.log(`  ✅ ${u.name}  (${u.id})`));

        console.log('\n=== PURGE COMPLETE ===');

    } catch (err) {
        console.error('Fatal error:', err.message);
    } finally {
        await client.end();
    }
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

purge();

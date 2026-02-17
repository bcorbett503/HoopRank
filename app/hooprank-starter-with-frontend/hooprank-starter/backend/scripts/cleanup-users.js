// Script to clean database - delete all users except Kevin, Richard, Nathan
const https = require('https');

const KEEP_USERS = [
    '0OW2dC3NsqexmTFTXgu57ZQfaIo2', // Kevin Corbett
    'Zc3Ey4VTslZ3VxsPtcqulmMw9e53', // Richard Corbett
    'vvxwohs5nXdstsgWlxuxfZdPbfI3', // Nathan North
];

const DELETE_USERS = [
    '4ODZUrySRUhFDC5wVW6dCySBprD2', // Bretty Corbett
    '3zIDc7PjlYYksXxZp6nH6EbILeh1', // Brett Corbett
    'APRimEwr7sZNsvZLYb9Erwt0KAj1', // demo
    'DKmjcFcw8eU3litE3YO9UTtcjOg2', // John Apple
];

// SQL to run for cleanup
const cleanupSQL = `
-- Delete related data first (foreign key constraints)
DELETE FROM player_statuses WHERE user_id NOT IN ('${KEEP_USERS.join("','")}');
DELETE FROM status_likes WHERE user_id NOT IN ('${KEEP_USERS.join("','")}');
DELETE FROM status_comments WHERE user_id NOT IN ('${KEEP_USERS.join("','")}');
DELETE FROM event_attendees WHERE user_id NOT IN ('${KEEP_USERS.join("','")}');
DELETE FROM user_followed_courts WHERE user_id NOT IN ('${KEEP_USERS.join("','")}');
DELETE FROM user_followed_players WHERE follower_id NOT IN ('${KEEP_USERS.join("','")}') OR followed_id NOT IN ('${KEEP_USERS.join("','")}');
DELETE FROM check_ins WHERE user_id NOT IN ('${KEEP_USERS.join("','")}');
DELETE FROM matches WHERE creator_id NOT IN ('${KEEP_USERS.join("','")}') OR opponent_id NOT IN ('${KEEP_USERS.join("','")}');
DELETE FROM messages WHERE from_id NOT IN ('${KEEP_USERS.join("','")}') OR to_id NOT IN ('${KEEP_USERS.join("','")}');
DELETE FROM team_members WHERE user_id NOT IN ('${KEEP_USERS.join("','")}');

-- Finally delete the users
DELETE FROM users WHERE id NOT IN ('${KEEP_USERS.join("','")}');
`;

console.log('Cleanup SQL to execute:');
console.log(cleanupSQL);
console.log('\n--- Execute this via database admin or add an endpoint ---');

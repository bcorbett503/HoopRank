const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkJohn() {
    const client = await pool.connect();
    try {
        // Check John's user record
        const john = await client.query(`
            SELECT * FROM users WHERE id = 'z7oV0s5tdcU9oTQT9ZvdsxDPCZn2'
        `);
        console.log('=== JOHN USER ===');
        console.log(john.rows[0]);

        // Check all messages involving John
        const msgs = await client.query(`
            SELECT id, from_id, to_id, body, created_at FROM messages 
            WHERE from_id = 'z7oV0s5tdcU9oTQT9ZvdsxDPCZn2' 
               OR to_id = 'z7oV0s5tdcU9oTQT9ZvdsxDPCZn2'
            ORDER BY created_at DESC
        `);
        console.log('\n=== MESSAGES FOR JOHN ===');
        console.log(msgs.rows);

        // Check all messages in general
        const allMsgs = await client.query(`
            SELECT id, from_id, to_id, body, created_at FROM messages 
            ORDER BY created_at DESC LIMIT 10
        `);
        console.log('\n=== ALL RECENT MESSAGES ===');
        console.log(allMsgs.rows);

    } finally {
        client.release();
        await pool.end();
    }
}

checkJohn().catch(console.error);

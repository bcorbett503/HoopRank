const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkData() {
    const client = await pool.connect();
    try {
        // Check users
        const users = await client.query(`
            SELECT id, display_name, position FROM users 
            WHERE id IN ('z7oV0s5tdcU9oTQT9ZvdsxDPCZn2', '4ODZUrySRUhFDC5wVW6dCySBprD2')
        `);
        console.log('=== USERS ===');
        console.log(users.rows);

        // Check messages
        const messages = await client.query(`
            SELECT id, from_id, to_id, body FROM messages 
            WHERE to_id = '4ODZUrySRUhFDC5wVW6dCySBprD2' 
               OR from_id = 'z7oV0s5tdcU9oTQT9ZvdsxDPCZn2'
        `);
        console.log('=== MESSAGES ===');
        console.log(messages.rows);

        // Fix John's display name
        console.log('\n=== FIXING JOHN USER ===');
        await client.query(`
            UPDATE users SET display_name = 'John Apple', position = 'G' 
            WHERE id = 'z7oV0s5tdcU9oTQT9ZvdsxDPCZn2'
        `);
        console.log('John updated!');

        // Verify Brett has a position set
        const brett = await client.query(`
            SELECT * FROM users WHERE id = '4ODZUrySRUhFDC5wVW6dCySBprD2'
        `);
        console.log('\n=== BRETT DETAILS ===');
        console.log(brett.rows[0]);

    } finally {
        client.release();
        await pool.end();
    }
}

checkData().catch(console.error);

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function createMessagesTable() {
    const client = await pool.connect();
    try {
        console.log('Creating messages table...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id UUID PRIMARY KEY,
                thread_id UUID NOT NULL,
                from_id TEXT NOT NULL REFERENCES users(id),
                to_id TEXT REFERENCES users(id),
                body TEXT NOT NULL,
                read BOOLEAN DEFAULT FALSE,
                is_challenge BOOLEAN DEFAULT FALSE,
                challenge_status TEXT,
                match_id UUID,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        console.log('Messages table created successfully!');

        // Create indexes for better performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_messages_from_id ON messages(from_id);
            CREATE INDEX IF NOT EXISTS idx_messages_to_id ON messages(to_id);
            CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
            CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
        `);

        console.log('Indexes created successfully!');

    } finally {
        client.release();
        await pool.end();
    }
}

createMessagesTable().catch(console.error);

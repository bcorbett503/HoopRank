/**
 * Migration: Create challenges table and migrate existing challenge messages
 * 
 * Run this on Railway:
 * node migrations/create_challenges_table.js
 */

const { Client } = require('pg');

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // 1. Create challenges table
        console.log('\n1. Creating challenges table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS challenges (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                from_user_id TEXT NOT NULL,
                to_user_id TEXT NOT NULL,
                court_id UUID,
                message TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                match_id UUID,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('✓ Challenges table created');

        // 2. Create indexes
        console.log('\n2. Creating indexes...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_challenges_to_user ON challenges(to_user_id);
            CREATE INDEX IF NOT EXISTS idx_challenges_from_user ON challenges(from_user_id);
            CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
            CREATE INDEX IF NOT EXISTS idx_challenges_match_id ON challenges(match_id);
        `);
        console.log('✓ Indexes created');

        // 3. Migrate existing challenge messages
        console.log('\n3. Migrating existing challenge messages...');
        const existingChallenges = await client.query(`
            SELECT id, from_id, to_id, court_id, body, challenge_status, match_id, created_at
            FROM messages
            WHERE is_challenge = true
        `);

        console.log(`Found ${existingChallenges.rows.length} challenge messages to migrate`);

        let migrated = 0;
        for (const msg of existingChallenges.rows) {
            // Check if already migrated
            const exists = await client.query(`
                SELECT id FROM challenges WHERE id = $1
            `, [msg.id]);

            if (exists.rows.length === 0) {
                await client.query(`
                    INSERT INTO challenges (id, from_user_id, to_user_id, court_id, message, status, match_id, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                    ON CONFLICT (id) DO NOTHING
                `, [
                    msg.id,
                    msg.from_id,
                    msg.to_id,
                    msg.court_id,
                    msg.body,
                    msg.challenge_status || 'pending',
                    msg.match_id,
                    msg.created_at
                ]);
                migrated++;
            }
        }
        console.log(`✓ Migrated ${migrated} challenges`);

        // 4. Verify
        console.log('\n4. Verification...');
        const count = await client.query(`SELECT COUNT(*) FROM challenges`);
        console.log(`Total challenges in new table: ${count.rows[0].count}`);

        const byStatus = await client.query(`
            SELECT status, COUNT(*) as count 
            FROM challenges 
            GROUP BY status 
            ORDER BY count DESC
        `);
        console.log('Challenges by status:');
        byStatus.rows.forEach(r => console.log(`  ${r.status}: ${r.count}`));

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error);
        throw error;
    } finally {
        await client.end();
    }
}

migrate();

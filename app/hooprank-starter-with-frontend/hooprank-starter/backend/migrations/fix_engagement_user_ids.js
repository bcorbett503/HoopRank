/**
 * Migration: Fix user_id columns to be VARCHAR for Firebase UIDs
 * The original migration created user_id as INTEGER, but we use Firebase string UIDs.
 * Run with: node migrations/fix_engagement_user_ids.js
 */

const { Client } = require('pg');

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    await client.connect();
    console.log('Connected to database');

    try {
        // status_likes: change user_id from INTEGER to VARCHAR
        console.log('\\n--- Fixing status_likes table ---');
        await client.query(`
            -- Drop the foreign key constraint if it exists
            ALTER TABLE status_likes DROP CONSTRAINT IF EXISTS status_likes_user_id_fkey;
        `);
        console.log('✓ Dropped FK constraint on status_likes');

        await client.query(`
            -- Change user_id column type to VARCHAR
            ALTER TABLE status_likes 
            ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::VARCHAR(255);
        `);
        console.log('✓ Changed status_likes.user_id to VARCHAR(255)');

        // status_comments: change user_id from INTEGER to VARCHAR
        console.log('\\n--- Fixing status_comments table ---');
        await client.query(`
            ALTER TABLE status_comments DROP CONSTRAINT IF EXISTS status_comments_user_id_fkey;
        `);
        console.log('✓ Dropped FK constraint on status_comments');

        await client.query(`
            ALTER TABLE status_comments 
            ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::VARCHAR(255);
        `);
        console.log('✓ Changed status_comments.user_id to VARCHAR(255)');

        // event_attendees: change user_id from INTEGER to VARCHAR
        console.log('\\n--- Fixing event_attendees table ---');
        await client.query(`
            ALTER TABLE event_attendees DROP CONSTRAINT IF EXISTS event_attendees_user_id_fkey;
        `);
        console.log('✓ Dropped FK constraint on event_attendees');

        await client.query(`
            ALTER TABLE event_attendees 
            ALTER COLUMN user_id TYPE VARCHAR(255) USING user_id::VARCHAR(255);
        `);
        console.log('✓ Changed event_attendees.user_id to VARCHAR(255)');

        // Verify the changes
        console.log('\\n--- Verifying changes ---');
        const result = await client.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('status_likes', 'status_comments', 'event_attendees')
            AND column_name = 'user_id'
            ORDER BY table_name;
        `);
        console.log('\\nColumn types after migration:');
        result.rows.forEach(row => {
            console.log(`  ${row.table_name}.${row.column_name}: ${row.data_type}`);
        });

        console.log('\\n✅ Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

migrate().catch(console.error);

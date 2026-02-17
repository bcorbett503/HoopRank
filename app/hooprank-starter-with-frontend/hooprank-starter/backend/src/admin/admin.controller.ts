/**
 * Admin Controller — Migration, cleanup, and debug endpoints.
 * Extracted from HealthController during Phase 3 decomposition.
 * StatusesService debug/migration methods added during Phase 7 decomposition.
 *
 * All routes preserve their original paths.
 */
import { Controller, Get, Post, Headers } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../auth/public.decorator';

@Controller()
export class AdminController {
    constructor(private dataSource: DataSource) { }

    /**
     * Add image_url columns to messages and team_messages tables
     */
    @Public()
    @Post('migrate/message-image-url')
    async migrateMessageImageUrl() {
        try {
            await this.dataSource.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT`);
            await this.dataSource.query(`ALTER TABLE team_messages ADD COLUMN IF NOT EXISTS image_url TEXT`);
            return { success: true, message: 'image_url columns added to messages and team_messages' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Migrate image_url column to TEXT to support larger base64 images
     */
    @Post('migrate/image-url-text')
    async migrateImageUrlToText() {
        try {
            await this.dataSource.query(`
                ALTER TABLE player_statuses 
                ALTER COLUMN image_url TYPE TEXT
            `);
            return { success: true, message: 'image_url column migrated to TEXT type' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Cleanup endpoint to purge all challenges and matches
     * USE WITH CAUTION - deletes all test data
     */
    @Post('cleanup/matches-challenges')
    async cleanupMatchesAndChallenges() {
        try {
            const deletedChallenges = await this.dataSource.query(`DELETE FROM challenges`);
            const deletedMatches = await this.dataSource.query(`DELETE FROM matches`);
            const deletedMessages = await this.dataSource.query(`DELETE FROM messages WHERE is_challenge = true`);

            return {
                success: true,
                message: 'All challenges and matches purged',
                deletedChallenges: deletedChallenges[1] || 0,
                deletedMatches: deletedMatches[1] || 0,
                deletedMessages: deletedMessages[1] || 0,
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * One-time migration endpoint to create challenges table
     * Safe to call multiple times (uses IF NOT EXISTS)
     */
    @Post('migrate/challenges')
    async migrateChalllenges() {
        try {
            await this.dataSource.query(`
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

            await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_challenges_to_user ON challenges(to_user_id);`);
            await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_challenges_from_user ON challenges(from_user_id);`);
            await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);`);
            await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_challenges_match_id ON challenges(match_id);`);

            // Migrate existing challenge messages
            const existing = await this.dataSource.query(`
                SELECT id, from_id, to_id, court_id, body, challenge_status, match_id, created_at
                FROM messages
                WHERE is_challenge = true
            `);

            let migrated = 0;
            for (const msg of existing) {
                try {
                    await this.dataSource.query(`
                        INSERT INTO challenges (id, from_user_id, to_user_id, court_id, message, status, match_id, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                        ON CONFLICT (id) DO NOTHING
                    `, [
                        msg.id, msg.from_id, msg.to_id, msg.court_id,
                        msg.body, msg.challenge_status || 'pending',
                        msg.match_id, msg.created_at
                    ]);
                    migrated++;
                } catch (e) {
                    // Skip duplicates
                }
            }

            const count = await this.dataSource.query(`SELECT COUNT(*) FROM challenges`);
            const byStatus = await this.dataSource.query(`
                SELECT status, COUNT(*) as count 
                FROM challenges 
                GROUP BY status 
                ORDER BY count DESC
            `);

            return {
                success: true,
                message: 'Challenges table created and data migrated',
                stats: {
                    totalChallenges: count[0].count,
                    byStatus: byStatus,
                    migratedThisRun: migrated,
                    foundInMessages: existing.length
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Remove dev/test courts from the database
     * Cleans up related records (check-ins, follows, alerts) first
     */
    @Post('cleanup/dev-courts')
    async removeDevCourts() {
        try {
            const devCourts = await this.dataSource.query(`
                SELECT id, name, city 
                FROM courts 
                WHERE name ILIKE '%dev%' 
                   OR name ILIKE '%test%'
                   OR id::text LIKE '11111111%'
                   OR id::text LIKE '00000000%'
            `);

            if (devCourts.length === 0) {
                return { success: true, message: 'No dev courts found', deleted: 0 };
            }

            const devCourtIds = devCourts.map(c => c.id);

            let cleanedCheckIns = 0;
            let cleanedFollows = 0;
            let cleanedAlerts = 0;

            try {
                const result = await this.dataSource.query(
                    `DELETE FROM check_ins WHERE court_id = ANY($1::text[])`, [devCourtIds]
                );
                cleanedCheckIns = result[1] || 0;
            } catch (e) { /* Table may not exist */ }

            try {
                const result = await this.dataSource.query(
                    `DELETE FROM user_followed_courts WHERE court_id = ANY($1::text[])`, [devCourtIds]
                );
                cleanedFollows = result[1] || 0;
            } catch (e) { /* Table may not exist */ }

            try {
                const result = await this.dataSource.query(
                    `DELETE FROM user_court_alerts WHERE court_id = ANY($1::text[])`, [devCourtIds]
                );
                cleanedAlerts = result[1] || 0;
            } catch (e) { /* Table may not exist */ }

            const deleteResult = await this.dataSource.query(`
                DELETE FROM courts 
                WHERE name ILIKE '%dev%' 
                   OR name ILIKE '%test%'
                   OR id::text LIKE '11111111%'
                   OR id::text LIKE '00000000%'
                RETURNING id, name
            `);

            const deletedCourts = deleteResult[0] || deleteResult;

            const remaining = await this.dataSource.query('SELECT id, name FROM courts ORDER BY name');

            return {
                success: true,
                message: 'Dev courts removed',
                deleted: deletedCourts.length,
                deletedCourts: deletedCourts,
                cleanedUp: {
                    checkIns: cleanedCheckIns,
                    follows: cleanedFollows,
                    alerts: cleanedAlerts
                },
                remainingCourts: remaining.map(c => ({ id: c.id, name: c.name }))
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ========== Statuses Debug & Migration Endpoints ==========
    // Moved from StatusesController/StatusesService during Phase 7 decomposition.
    // Routes preserve their original /statuses/* paths.

    /**
     * Debug endpoint to check player_statuses table contents
     */
    @Get('statuses/debug-statuses')
    async debugStatuses() {
        try {
            const allStatuses = await this.dataSource.query(`
                SELECT * FROM player_statuses ORDER BY created_at DESC LIMIT 10
            `);
            const followedPlayers = await this.dataSource.query(`
                SELECT * FROM user_followed_players LIMIT 5
            `);
            const followedCourts = await this.dataSource.query(`
                SELECT * FROM user_followed_courts LIMIT 5
            `);
            const usersColumns = await this.dataSource.query(`
                SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'
            `);
            const checkIns = await this.dataSource.query(`
                SELECT * FROM check_ins ORDER BY checked_in_at DESC LIMIT 5
            `);
            const matches = await this.dataSource.query(`
                SELECT * FROM matches ORDER BY created_at DESC LIMIT 5
            `);
            const users = await this.dataSource.query(`
                SELECT id, email, name, avatar_url FROM users LIMIT 5
            `);
            const statusesSchema = await this.dataSource.query(`
                SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'player_statuses'
            `);

            return { allStatuses, followedPlayers, followedCourts, usersColumns, checkIns, matches, users, statusesSchema };
        } catch (error) {
            return { error: error.message, stack: error.stack };
        }
    }

    /**
     * Simple test query to debug unified feed
     */
    @Get('statuses/test-feed')
    async testFeed(@Headers('x-user-id') userId: string) {
        try {
            const simpleQuery = await this.dataSource.query(`
                SELECT 
                    'status' as type,
                    ps.id,
                    ps.user_id as "userId",
                    ps.content,
                    ps.court_id as "courtId",
                    ps.created_at as "createdAt"
                FROM player_statuses ps
                WHERE ps.user_id = $1
                ORDER BY ps.created_at DESC
                LIMIT 10
            `, [userId]);

            return { userId, simpleQuery, message: 'Direct query without JOINs or CTEs' };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Migration endpoint to add video columns to player_statuses
     */
    @Post('statuses/migrate-video-columns')
    async migrateVideoColumns() {
        try {
            const checkQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'player_statuses' 
                AND column_name IN ('video_url', 'video_thumbnail_url', 'video_duration_ms');
            `;
            const existing = await this.dataSource.query(checkQuery);

            if (existing.length === 3) {
                return {
                    success: true,
                    message: 'Video columns already exist',
                    columns: existing.map((r: any) => r.column_name)
                };
            }

            const alterQuery = `
                ALTER TABLE player_statuses 
                ADD COLUMN IF NOT EXISTS video_url VARCHAR(500),
                ADD COLUMN IF NOT EXISTS video_thumbnail_url VARCHAR(500),
                ADD COLUMN IF NOT EXISTS video_duration_ms INTEGER;
            `;
            await this.dataSource.query(alterQuery);

            const verify = await this.dataSource.query(checkQuery);

            return {
                success: true,
                message: 'Video columns added successfully',
                columns: verify.map((r: any) => r.column_name)
            };
        } catch (error) {
            console.error('Migration error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Migration endpoint to add run attribute columns to player_statuses
     */
    @Post('statuses/migrate-run-attributes')
    async migrateRunAttributes() {
        try {
            const alterQuery = `
                ALTER TABLE player_statuses 
                ADD COLUMN IF NOT EXISTS game_mode VARCHAR(10),
                ADD COLUMN IF NOT EXISTS court_type VARCHAR(20),
                ADD COLUMN IF NOT EXISTS age_range VARCHAR(10);
            `;
            await this.dataSource.query(alterQuery);

            const checkQuery = `
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'player_statuses' 
                AND column_name IN ('game_mode', 'court_type', 'age_range');
            `;
            const verify = await this.dataSource.query(checkQuery);

            return {
                success: true,
                message: 'Run attribute columns added successfully',
                columns: verify.map((r: any) => r.column_name)
            };
        } catch (error) {
            console.error('Migration error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * ONE-TIME purge: Delete ALL users except the three Corbetts.
     * Courts and scheduled runs are preserved.
     * REMOVE THIS ENDPOINT AFTER USE.
     */
    @Public()
    @Post('admin/purge-non-corbetts')
    async purgeNonCorbetts() {
        const KEEP_IDS = [
            '4ODZUrySRUhFDC5wVW6dCySBprD2', // Brett Corbett
            '0OW2dC3NsqexmTFTXgu57ZQfaIo2', // Kevin Corbett
            'Zc3Ey4VTslZ3VxsPtcqulmMw9e53', // Richard Corbett
        ];

        const KEEP_LIST = KEEP_IDS.map(id => `'${id}'`).join(',');
        const results: string[] = [];

        try {
            // Preview
            const preview = await this.dataSource.query(
                `SELECT id, name FROM users WHERE id NOT IN (${KEEP_LIST}) ORDER BY name`
            );
            results.push(`Found ${preview.length} users to delete`);

            // Delete in dependency order
            const deletions = [
                `DELETE FROM status_likes WHERE user_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM status_comments WHERE user_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM event_attendees WHERE user_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM status_likes WHERE status_id IN (SELECT id FROM player_statuses WHERE user_id NOT IN (${KEEP_LIST}))`,
                `DELETE FROM status_comments WHERE status_id IN (SELECT id FROM player_statuses WHERE user_id NOT IN (${KEEP_LIST}))`,
                `DELETE FROM event_attendees WHERE status_id IN (SELECT id FROM player_statuses WHERE user_id NOT IN (${KEEP_LIST}))`,
                `DELETE FROM player_statuses WHERE user_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM check_ins WHERE user_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM user_followed_courts WHERE user_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM user_followed_players WHERE follower_id NOT IN (${KEEP_LIST}) OR followed_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM friendships WHERE user_id NOT IN (${KEEP_LIST}) OR friend_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM run_attendees WHERE user_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM team_messages WHERE sender_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM team_members WHERE user_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM teams WHERE owner_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM messages WHERE from_id NOT IN (${KEEP_LIST}) OR to_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM challenges WHERE from_user_id NOT IN (${KEEP_LIST}) OR to_user_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM matches WHERE creator_id NOT IN (${KEEP_LIST}) OR opponent_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM user_reports WHERE reporter_id NOT IN (${KEEP_LIST}) OR reported_user_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM content_reports WHERE reporter_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM blocked_users WHERE user_id NOT IN (${KEEP_LIST}) OR blocked_user_id NOT IN (${KEEP_LIST})`,
                `DELETE FROM users WHERE id NOT IN (${KEEP_LIST})`,
            ];

            for (const sql of deletions) {
                try {
                    const result = await this.dataSource.query(sql);
                    const table = sql.match(/FROM (\w+)/)?.[1] || '?';
                    const count = result[1] || (Array.isArray(result) ? result.length : 0);
                    if (count > 0) {
                        results.push(`✓ ${table}: deleted ${count} rows`);
                    }
                } catch (e) {
                    const table = sql.match(/FROM (\w+)/)?.[1] || '?';
                    if (!e.message.includes('does not exist')) {
                        results.push(`⚠ ${table}: ${e.message}`);
                    }
                }
            }

            // Verify
            const remaining = await this.dataSource.query('SELECT id, name FROM users ORDER BY name');
            const statusCount = await this.dataSource.query('SELECT COUNT(*) FROM player_statuses');
            const matchCount = await this.dataSource.query('SELECT COUNT(*) FROM matches');

            return {
                success: true,
                results,
                remainingUsers: remaining,
                remainingPosts: statusCount[0]?.count || 0,
                remainingMatches: matchCount[0]?.count || 0,
            };
        } catch (error) {
            return { success: false, error: error.message, results };
        }
    }
}

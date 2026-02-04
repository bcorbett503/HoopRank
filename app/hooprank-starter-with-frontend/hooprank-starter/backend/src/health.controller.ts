import { Controller, Get, Post, Query } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from './notifications/notifications.service';

@Controller()
export class HealthController {
    constructor(
        private dataSource: DataSource,
        private notificationsService: NotificationsService,
    ) { }

    @Get('health')
    getHealth() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Seed The Olympic Club court for testing
     */
    @Post('seed/olympic-club')
    async seedOlympicClub() {
        try {
            // Use a fixed UUID for The Olympic Club
            const olympicClubId = '44444444-4444-4444-4444-444444444444';

            // Check if already exists
            const existing = await this.dataSource.query(
                `SELECT id FROM courts WHERE id = $1`, [olympicClubId]
            );

            if (existing.length > 0) {
                return { success: true, message: 'Olympic Club already exists', id: olympicClubId };
            }

            // Insert The Olympic Club with PostGIS geography
            // geog column is ST_Point(longitude, latitude)
            await this.dataSource.query(`
                INSERT INTO courts (id, name, city, indoor, signature, geog)
                VALUES ($1, 'The Olympic Club', 'San Francisco', true, true, ST_SetSRID(ST_MakePoint(-122.4099, 37.7878), 4326)::geography)
            `, [olympicClubId]);

            return { success: true, message: 'Olympic Club created', id: olympicClubId };
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
            // Delete all challenges
            const deletedChallenges = await this.dataSource.query(`DELETE FROM challenges`);

            // Delete all matches
            const deletedMatches = await this.dataSource.query(`DELETE FROM matches`);

            // Also delete challenge messages (legacy)
            const deletedMessages = await this.dataSource.query(`DELETE FROM messages WHERE is_challenge = true`);

            return {
                success: true,
                message: 'All challenges and matches purged',
                deletedChallenges: deletedChallenges[1] || 0,
                deletedMatches: deletedMatches[1] || 0,
                deletedMessages: deletedMessages[1] || 0,
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * One-time migration endpoint to create challenges table
     * Safe to call multiple times (uses IF NOT EXISTS)
     */
    @Post('migrate/challenges')
    async migrateChalllenges() {
        try {
            // Create challenges table with snake_case columns (if not exists)
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

            // Create indexes
            await this.dataSource.query(`
                CREATE INDEX IF NOT EXISTS idx_challenges_to_user ON challenges(to_user_id);
            `);
            await this.dataSource.query(`
                CREATE INDEX IF NOT EXISTS idx_challenges_from_user ON challenges(from_user_id);
            `);
            await this.dataSource.query(`
                CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
            `);
            await this.dataSource.query(`
                CREATE INDEX IF NOT EXISTS idx_challenges_match_id ON challenges(match_id);
            `);

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
                } catch (e) {
                    // Skip duplicates
                }
            }

            // Get stats
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
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Debug endpoint to show all challenges
     */
    @Get('debug/challenges')
    async debugChallenges() {
        const all = await this.dataSource.query(`
            SELECT id, from_user_id, to_user_id, status, match_id, created_at
            FROM challenges
            ORDER BY created_at DESC
        `);
        return all;
    }

    /**
     * Remove dev/test courts from the database
     * Cleans up related records (check-ins, follows, alerts) first
     */
    @Post('cleanup/dev-courts')
    async removeDevCourts() {
        try {
            // List dev courts first
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

            // Clean up related records
            let cleanedCheckIns = 0;
            let cleanedFollows = 0;
            let cleanedAlerts = 0;

            try {
                const result = await this.dataSource.query(
                    `DELETE FROM check_ins WHERE court_id = ANY($1::text[])`,
                    [devCourtIds]
                );
                cleanedCheckIns = result[1] || 0;
            } catch (e) {
                // Table may not exist
            }

            try {
                const result = await this.dataSource.query(
                    `DELETE FROM user_followed_courts WHERE court_id = ANY($1::text[])`,
                    [devCourtIds]
                );
                cleanedFollows = result[1] || 0;
            } catch (e) {
                // Table may not exist
            }

            try {
                const result = await this.dataSource.query(
                    `DELETE FROM user_court_alerts WHERE court_id = ANY($1::text[])`,
                    [devCourtIds]
                );
                cleanedAlerts = result[1] || 0;
            } catch (e) {
                // Table may not exist
            }

            // Now delete the courts
            const deleteResult = await this.dataSource.query(`
                DELETE FROM courts 
                WHERE name ILIKE '%dev%' 
                   OR name ILIKE '%test%'
                   OR id::text LIKE '11111111%'
                   OR id::text LIKE '00000000%'
                RETURNING id, name
            `);

            const deletedCourts = deleteResult[0] || deleteResult;

            // Get remaining courts
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

    /**
     * Test push notification endpoint
     * Usage: POST /debug/test-push?userId=<USER_ID>
     */
    @Post('debug/test-push')
    async testPush(@Query('userId') userId: string) {
        if (!userId) {
            return { success: false, error: 'userId query param required' };
        }

        try {
            // Run same query we use in notificationService for debugging
            const debugQuery = await this.dataSource.query(
                `SELECT id, fcm_token FROM users WHERE id::TEXT = $1 AND fcm_token IS NOT NULL`,
                [userId]
            );

            const result = await this.notificationsService.sendToUser(
                userId,
                '🏀 Test Push Notification',
                'If you see this, push notifications are working!',
                { type: 'test' }
            );

            return {
                success: result,
                message: result
                    ? 'Notification sent successfully'
                    : 'No FCM token for user or user not found',
                userId,
                debugQuery: debugQuery.length > 0 ? { found: true, tokenLength: debugQuery[0].fcm_token?.length || 0 } : { found: false },
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Direct push test - bypasses notification service, sends FCM directly
     */
    @Post('debug/test-push-direct')
    async testPushDirect(@Query('userId') userId: string) {
        if (!userId) {
            return { success: false, error: 'userId query param required' };
        }

        try {
            // Get token directly
            const users = await this.dataSource.query(
                `SELECT fcm_token FROM users WHERE id = $1`, [userId]
            );

            if (users.length === 0 || !users[0].fcm_token) {
                return { success: false, error: 'No FCM token for user', query: 'id = $1', result: users };
            }

            const token = users[0].fcm_token;

            // Import firebase admin and send directly
            const admin = require('firebase-admin');
            const message = {
                token,
                notification: {
                    title: '🏀 Direct Test Push',
                    body: 'Sent directly, bypassing notification service!',
                },
                data: { type: 'test' },
                apns: {
                    payload: {
                        aps: { sound: 'default', badge: 1 },
                    },
                },
            };

            await admin.messaging().send(message);
            return { success: true, message: 'Direct notification sent!', tokenLength: token.length };
        } catch (error) {
            return { success: false, error: error.message, errorCode: error.code };
        }
    }

    /**
     * Debug endpoint to check FCM token for a user directly
     */
    @Get('debug/fcm-token')
    async debugFcmToken(@Query('userId') userId: string) {
        if (!userId) {
            return { error: 'userId query param required' };
        }

        try {
            // Try different queries to diagnose
            const result1 = await this.dataSource.query(
                `SELECT id, name, fcm_token FROM users WHERE id = $1`, [userId]
            );
            const result2 = await this.dataSource.query(
                `SELECT id, name, fcm_token FROM users WHERE id::TEXT = $1`, [userId]
            );
            const countResult = await this.dataSource.query(
                `SELECT COUNT(*) as count FROM users WHERE fcm_token IS NOT NULL`
            );

            return {
                query1_direct: result1,
                query2_cast: result2,
                totalUsersWithToken: countResult[0]?.count,
                userId,
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Debug endpoint to check Firebase initialization status
     */
    @Get('debug/firebase-status')
    async debugFirebaseStatus() {
        const admin = require('firebase-admin');

        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;

        const apps = admin.apps;
        const isInitialized = apps && apps.length > 0;

        return {
            isInitialized,
            appCount: apps?.length || 0,
            environment: {
                hasProjectId: !!projectId,
                projectId: projectId || 'NOT SET',
                hasClientEmail: !!clientEmail,
                clientEmailPrefix: clientEmail ? clientEmail.substring(0, 30) + '...' : 'NOT SET',
                hasPrivateKey: !!privateKey,
                privateKeyLength: privateKey?.length || 0,
                privateKeyStartsCorrectly: privateKey?.startsWith('-----BEGIN') || false,
            },
            defaultApp: isInitialized ? {
                name: apps[0].name,
                options: {
                    projectId: apps[0].options?.projectId,
                    serviceAccountId: apps[0].options?.serviceAccountId,
                }
            } : null,
        };
    }

    /**
     * Debug endpoint to manually initialize Firebase and test it
     */
    @Post('debug/firebase-init')
    async debugFirebaseInit() {
        const admin = require('firebase-admin');

        // Check if already initialized
        if (admin.apps && admin.apps.length > 0) {
            return {
                success: true,
                message: 'Firebase already initialized',
                appName: admin.apps[0].name,
                projectId: admin.apps[0].options?.projectId,
            };
        }

        const projectId = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        let privateKey = process.env.FIREBASE_PRIVATE_KEY;

        if (!projectId || !clientEmail || !privateKey) {
            return {
                success: false,
                error: 'Missing credentials',
                hasProjectId: !!projectId,
                hasClientEmail: !!clientEmail,
                hasPrivateKey: !!privateKey,
            };
        }

        // Debug: show raw key format
        const keyPreview = privateKey.substring(0, 100);
        const hasLiteralBackslashN = privateKey.includes('\\n');
        const hasActualNewline = privateKey.includes('\n');

        try {
            // Normalize private key - handle various escape sequences
            // Handle JSON stringified format
            if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
                try {
                    privateKey = JSON.parse(privateKey);
                } catch (e) {
                    // Not valid JSON, continue
                }
            }

            // Replace escaped newlines with actual newlines
            privateKey = privateKey
                .replace(/\\\\n/g, '\n')  // Double escaped
                .replace(/\\n/g, '\n');   // Single escaped

            const firebaseConfig = {
                projectId,
                clientEmail,
                privateKey,
            };

            const app = admin.initializeApp({
                credential: admin.credential.cert(firebaseConfig),
            });

            return {
                success: true,
                message: 'Firebase initialized successfully!',
                appName: app.name,
                projectId: app.options?.projectId,
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                stack: error.stack?.substring(0, 500),
                keyDebug: {
                    preview: keyPreview,
                    hasLiteralBackslashN,
                    hasActualNewline,
                    length: process.env.FIREBASE_PRIVATE_KEY?.length,
                },
            };
        }
    }
}

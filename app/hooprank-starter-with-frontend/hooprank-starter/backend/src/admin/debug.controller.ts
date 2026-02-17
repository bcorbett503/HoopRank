/**
 * Debug Controller — Diagnostic and testing endpoints.
 * Extracted from HealthController during Phase 3 decomposition.
 *
 * All routes preserve their original paths (debug/*).
 */
import { Controller, Get, Post, Query } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { Public } from '../auth/public.decorator';

@Controller()
export class DebugController {
    constructor(
        private dataSource: DataSource,
        private notificationsService: NotificationsService,
    ) { }

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
     * Test push notification endpoint
     * Usage: POST /debug/test-push?userId=<USER_ID>
     */
    @Post('debug/test-push')
    async testPush(@Query('userId') userId: string) {
        if (!userId) {
            return { success: false, error: 'userId query param required' };
        }

        try {
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
            const users = await this.dataSource.query(
                `SELECT fcm_token FROM users WHERE id = $1`, [userId]
            );

            if (users.length === 0 || !users[0].fcm_token) {
                return { success: false, error: 'No FCM token for user', query: 'id = $1', result: users };
            }

            const token = users[0].fcm_token;

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
                        aps: { sound: 'default' },
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

        const keyPreview = privateKey.substring(0, 100);
        const hasLiteralBackslashN = privateKey.includes('\\n');
        const hasActualNewline = privateKey.includes('\n');

        try {
            if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
                try {
                    privateKey = JSON.parse(privateKey);
                } catch (e) {
                    // Not valid JSON, continue
                }
            }

            privateKey = (privateKey as string).split('\\n').join('\n');
            if (privateKey.includes('\\n')) {
                privateKey = privateKey.split('\\n').join('\n');
            }

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

    /**
     * Debug endpoint to check the structure of check_ins table
     */
    @Get('debug/check-ins-schema')
    async debugCheckInsSchema() {
        try {
            const tableInfo = await this.dataSource.query(`
                SELECT column_name, data_type, udt_name, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'check_ins'
                ORDER BY ordinal_position
            `);

            const fkConstraints = await this.dataSource.query(`
                SELECT
                    tc.constraint_name,
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                WHERE tc.table_name = 'check_ins' AND tc.constraint_type = 'FOREIGN KEY'
            `);

            const sample = await this.dataSource.query(`
                SELECT * FROM check_ins LIMIT 1
            `);

            return {
                tableExists: tableInfo.length > 0,
                columns: tableInfo,
                foreignKeys: fkConstraints,
                sampleRow: sample[0] || null,
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Test all notification types
     * Usage: GET /debug/test-notifications?userId=<USER_ID>
     */
    @Get('debug/test-notifications')
    async testAllNotifications(@Query('userId') userId: string) {
        if (!userId) {
            return { error: 'userId query param required' };
        }

        const results: Record<string, any> = {};

        // 1. Test generic push
        try {
            const sent = await this.notificationsService.sendToUser(
                userId, '🔔 Test Push', 'Testing notification system...', { type: 'test' }
            );
            results['1_generic_push'] = { success: sent, method: 'sendToUser' };
        } catch (e) {
            results['1_generic_push'] = { success: false, error: e.message };
        }

        // 2. Test challenge received
        try {
            await this.notificationsService.sendChallengeNotification(userId, 'Test Player', 'received', 'test-challenge-id');
            results['2_challenge_received'] = { success: true, method: 'sendChallengeNotification(received)' };
        } catch (e) {
            results['2_challenge_received'] = { success: false, error: e.message };
        }

        // 3. Test challenge accepted
        try {
            await this.notificationsService.sendChallengeNotification(userId, 'Test Player', 'accepted', 'test-challenge-id');
            results['3_challenge_accepted'] = { success: true, method: 'sendChallengeNotification(accepted)' };
        } catch (e) {
            results['3_challenge_accepted'] = { success: false, error: e.message };
        }

        // 4. Test challenge declined
        try {
            await this.notificationsService.sendChallengeNotification(userId, 'Test Player', 'declined', 'test-challenge-id');
            results['4_challenge_declined'] = { success: true, method: 'sendChallengeNotification(declined)' };
        } catch (e) {
            results['4_challenge_declined'] = { success: false, error: e.message };
        }

        // 5. Test message notification
        try {
            await this.notificationsService.sendMessageNotification(userId, 'Test Sender', 'Hey, want to play?', 'test-thread-id');
            results['5_new_message'] = { success: true, method: 'sendMessageNotification' };
        } catch (e) {
            results['5_new_message'] = { success: false, error: e.message };
        }

        // 6. Test match completed
        try {
            await this.notificationsService.sendMatchCompletedNotification(userId, 4.2, 0.3, 'Test Opponent', true);
            results['6_match_completed'] = { success: true, method: 'sendMatchCompletedNotification' };
        } catch (e) {
            results['6_match_completed'] = { success: false, error: e.message };
        }

        // 7. Test follow notification
        try {
            await this.notificationsService.sendFollowNotification(userId, 'Test Follower');
            results['7_new_follower'] = { success: true, method: 'sendFollowNotification' };
        } catch (e) {
            results['7_new_follower'] = { success: false, error: e.message };
        }

        // 8. Test court activity
        try {
            await this.notificationsService.sendCourtActivityNotification(
                '22222222-2222-2222-2222-222222222222', 'Test Court', 'Test Player', 'check_in'
            );
            results['8_court_activity'] = { success: true, method: 'sendCourtActivityNotification', note: 'Sent to all users with alerts enabled for this court' };
        } catch (e) {
            results['8_court_activity'] = { success: false, error: e.message };
        }

        const successCount = Object.values(results).filter((r: any) => r.success).length;
        return { userId, totalTests: 8, successCount, failedCount: 8 - successCount, results };
    }
}

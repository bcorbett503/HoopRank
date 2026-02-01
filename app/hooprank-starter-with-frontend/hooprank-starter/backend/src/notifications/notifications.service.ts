import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/user.entity';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>,
        private dataSource: DataSource,
    ) { }

    private get isPostgres(): boolean {
        return !!process.env.DATABASE_URL;
    }

    /**
     * Send push notification to all users who have alerts enabled for a court
     */
    async sendCourtActivityNotification(
        courtId: string,
        courtName: string,
        playerName: string,
        activityType: 'check_in' | 'game_started' = 'check_in',
    ): Promise<void> {
        // Get all users with alerts enabled for this court
        const query = this.isPostgres
            ? `SELECT u.fcm_token, u.id, u.name 
               FROM users u
               JOIN user_court_alerts a ON u.id = a.user_id
               WHERE a.court_id = $1 AND u.fcm_token IS NOT NULL`
            : `SELECT u."fcmToken" as fcm_token, u.id, u.name 
               FROM users u
               JOIN user_court_alerts a ON u.id = a.user_id
               WHERE a.court_id = ? AND u."fcmToken" IS NOT NULL`;

        const result = await this.dataSource.query(query, [courtId]);

        if (result.length === 0) {
            console.log(`No users to notify for court ${courtId}`);
            return;
        }

        const tokens = result.map((r: any) => r.fcm_token).filter((t: string) => t);
        if (tokens.length === 0) return;

        const title = activityType === 'check_in'
            ? `🏀 Activity at ${courtName}`
            : `🏀 Game started at ${courtName}`;

        const body = activityType === 'check_in'
            ? `${playerName} just checked in!`
            : `${playerName} started a game!`;

        try {
            // Send to all tokens
            const message: admin.messaging.MulticastMessage = {
                tokens,
                notification: {
                    title,
                    body,
                },
                data: {
                    type: 'court_activity',
                    courtId,
                    activityType,
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1,
                        },
                    },
                },
            };

            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`Successfully sent ${response.successCount} notifications, ${response.failureCount} failures`);

            // Remove invalid tokens
            if (response.failureCount > 0) {
                const invalidTokens: string[] = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
                        invalidTokens.push(tokens[idx]);
                    }
                });

                if (invalidTokens.length > 0) {
                    // Note: This cleanup only works on PostgreSQL
                    if (this.isPostgres) {
                        await this.dataSource.query(`
                            UPDATE users SET fcm_token = NULL WHERE fcm_token = ANY($1)
                        `, [invalidTokens]);
                        console.log(`Removed ${invalidTokens.length} invalid tokens`);
                    }
                }
            }
        } catch (error) {
            console.error('Error sending notifications:', error);
        }
    }

    /**
     * Save FCM token for a user
     */
    async saveFcmToken(userId: string, token: string): Promise<void> {
        console.log('saveFcmToken: userId=', userId, 'token=', token.substring(0, 20) + '...');
        try {
            // Use raw SQL for more reliable update
            if (this.isPostgres) {
                const result = await this.dataSource.query(`
                    UPDATE users SET fcm_token = $1, updated_at = NOW()
                    WHERE id = $2
                `, [token, userId]);
                console.log('saveFcmToken: update result=', result);
            } else {
                await this.dataSource.query(`
                    UPDATE users SET fcm_token = ?, updated_at = datetime('now')
                    WHERE id = ?
                `, [token, userId]);
            }
        } catch (error) {
            console.error('saveFcmToken error:', error.message);
            throw error;
        }
    }

    /**
     * Enable court alert for a user
     */
    async enableCourtAlert(userId: string, courtId: string): Promise<void> {
        if (this.isPostgres) {
            await this.dataSource.query(`
                INSERT INTO user_court_alerts (user_id, court_id)
                VALUES ($1, $2)
                ON CONFLICT (user_id, court_id) DO NOTHING
            `, [userId, courtId]);
        } else {
            await this.dataSource.query(`
                INSERT OR IGNORE INTO user_court_alerts (user_id, court_id)
                VALUES (?, ?)
            `, [userId, courtId]);
        }
    }

    /**
     * Disable court alert for a user
     */
    async disableCourtAlert(userId: string, courtId: string): Promise<void> {
        const query = this.isPostgres
            ? `DELETE FROM user_court_alerts WHERE user_id = $1 AND court_id = $2`
            : `DELETE FROM user_court_alerts WHERE user_id = ? AND court_id = ?`;
        await this.dataSource.query(query, [userId, courtId]);
    }

    /**
     * Get all court alerts for a user
     */
    async getUserCourtAlerts(userId: string): Promise<string[]> {
        const query = this.isPostgres
            ? `SELECT court_id FROM user_court_alerts WHERE user_id = $1`
            : `SELECT court_id FROM user_court_alerts WHERE user_id = ?`;
        const result = await this.dataSource.query(query, [userId]);
        return result.map((r: any) => r.court_id);
    }

    /**
     * Generic helper to send a push notification to a single user
     */
    async sendToUser(
        userId: string,
        title: string,
        body: string,
        data: Record<string, string> = {},
    ): Promise<boolean> {
        try {
            // Get user's FCM token
            const query = this.isPostgres
                ? `SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL`
                : `SELECT "fcmToken" as fcm_token FROM users WHERE id = ? AND "fcmToken" IS NOT NULL`;

            const result = await this.dataSource.query(query, [userId]);
            if (result.length === 0 || !result[0].fcm_token) {
                console.log(`[Notifications] No FCM token for user ${userId}`);
                return false;
            }

            const token = result[0].fcm_token;

            const message: admin.messaging.Message = {
                token,
                notification: { title, body },
                data,
                apns: {
                    payload: {
                        aps: { sound: 'default', badge: 1 },
                    },
                },
            };

            await admin.messaging().send(message);
            console.log(`[Notifications] Sent to ${userId}: ${title}`);
            return true;
        } catch (error) {
            console.error(`[Notifications] Failed to send to ${userId}:`, error.message);

            // Clean up invalid token
            if (error.code === 'messaging/registration-token-not-registered') {
                if (this.isPostgres) {
                    await this.dataSource.query(`UPDATE users SET fcm_token = NULL WHERE id = $1`, [userId]);
                }
            }
            return false;
        }
    }

    /**
     * Send challenge notification (received, accepted, or declined)
     */
    async sendChallengeNotification(
        toUserId: string,
        fromUserName: string,
        type: 'received' | 'accepted' | 'declined',
        challengeId?: string,
    ): Promise<void> {
        const titles = {
            received: '🏀 New Challenge!',
            accepted: '🏀 Challenge Accepted!',
            declined: '🏀 Challenge Declined',
        };
        const bodies = {
            received: `${fromUserName} challenged you to 1v1`,
            accepted: `${fromUserName} accepted your challenge!`,
            declined: `${fromUserName} declined your challenge`,
        };

        await this.sendToUser(toUserId, titles[type], bodies[type], {
            type: 'challenge',
            challengeType: type,
            challengeId: challengeId || '',
        });
    }

    /**
     * Send new message notification
     */
    async sendMessageNotification(
        toUserId: string,
        fromUserName: string,
        messagePreview: string,
        threadId?: string,
    ): Promise<void> {
        const preview = messagePreview.length > 50
            ? messagePreview.substring(0, 47) + '...'
            : messagePreview;

        await this.sendToUser(toUserId, fromUserName, preview, {
            type: 'message',
            threadId: threadId || '',
        });
    }

    /**
     * Send match completed notification
     */
    async sendMatchCompletedNotification(
        userId: string,
        newRating: number,
        ratingDelta: number,
        opponentName: string,
        won: boolean,
    ): Promise<void> {
        const title = won ? '🏆 Victory!' : '📊 Match Complete';
        const deltaStr = ratingDelta >= 0 ? `+${ratingDelta.toFixed(2)}` : ratingDelta.toFixed(2);
        const body = won
            ? `You beat ${opponentName}! Rating: ${newRating.toFixed(2)} (${deltaStr})`
            : `${opponentName} won. Rating: ${newRating.toFixed(2)} (${deltaStr})`;

        await this.sendToUser(userId, title, body, {
            type: 'match_completed',
            newRating: newRating.toString(),
        });
    }

    /**
     * Send follow notification
     */
    async sendFollowNotification(userId: string, followerName: string): Promise<void> {
        await this.sendToUser(userId, '👋 New Follower', `${followerName} started following you`, {
            type: 'follow',
        });
    }
}

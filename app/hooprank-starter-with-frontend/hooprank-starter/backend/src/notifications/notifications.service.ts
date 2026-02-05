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
        // Use dataSource.options.type for reliable driver detection
        const dbType = (this.dataSource.options as any).type;
        const result = dbType === 'postgres';
        console.log(`[NotificationsService] isPostgres check: dbType=${dbType}, result=${result}`);
        return result;
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
        // Get all users with alerts enabled for this court via user_followed_courts
        const query = this.isPostgres
            ? `SELECT u.fcm_token, u.id, u.name 
               FROM users u
               JOIN user_followed_courts f ON u.id = f.user_id
               WHERE f.court_id = $1 AND f.alerts_enabled = true AND u.fcm_token IS NOT NULL`
            : `SELECT u."fcmToken" as fcm_token, u.id, u.name 
               FROM users u
               JOIN user_followed_courts f ON u.id = f.user_id
               WHERE f.court_id = ? AND f.alerts_enabled = 1 AND u."fcmToken" IS NOT NULL`;

        console.log(`[CourtNotification] Querying users with alerts for court ${courtId}`);
        const result = await this.dataSource.query(query, [courtId]);
        console.log(`[CourtNotification] Found ${result.length} users with alerts enabled`);

        if (result.length === 0) {
            console.log(`[CourtNotification] No users to notify for court ${courtId}`);
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
     * Enable court alert for a user - updates alerts_enabled in user_followed_courts
     */
    async enableCourtAlert(userId: string, courtId: string): Promise<void> {
        console.log(`[Alerts] Enabling alert for user=${userId}, court=${courtId}`);
        if (this.isPostgres) {
            await this.dataSource.query(`
                UPDATE user_followed_courts 
                SET alerts_enabled = true
                WHERE user_id = $1 AND court_id = $2
            `, [userId, courtId]);
        } else {
            await this.dataSource.query(`
                UPDATE user_followed_courts 
                SET alerts_enabled = 1
                WHERE user_id = ? AND court_id = ?
            `, [userId, courtId]);
        }
    }

    /**
     * Disable court alert for a user - updates alerts_enabled in user_followed_courts
     */
    async disableCourtAlert(userId: string, courtId: string): Promise<void> {
        console.log(`[Alerts] Disabling alert for user=${userId}, court=${courtId}`);
        const query = this.isPostgres
            ? `UPDATE user_followed_courts SET alerts_enabled = false WHERE user_id = $1 AND court_id = $2`
            : `UPDATE user_followed_courts SET alerts_enabled = 0 WHERE user_id = ? AND court_id = ?`;
        await this.dataSource.query(query, [userId, courtId]);
    }

    /**
     * Get all court alerts for a user - queries user_followed_courts with alerts_enabled
     */
    async getUserCourtAlerts(userId: string): Promise<string[]> {
        const query = this.isPostgres
            ? `SELECT court_id FROM user_followed_courts WHERE user_id = $1 AND alerts_enabled = true`
            : `SELECT court_id FROM user_followed_courts WHERE user_id = ? AND alerts_enabled = 1`;
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
            console.log(`[Notifications] sendToUser called for userId=${userId}, isPostgres=${this.isPostgres}`);

            // Get user's FCM token - cast id to TEXT for safe comparison
            const query = this.isPostgres
                ? `SELECT fcm_token FROM users WHERE id::TEXT = $1 AND fcm_token IS NOT NULL`
                : `SELECT "fcmToken" as fcm_token FROM users WHERE id = ? AND "fcmToken" IS NOT NULL`;

            console.log(`[Notifications] Executing query: ${query} with userId=${userId}`);
            const result = await this.dataSource.query(query, [userId]);
            console.log(`[Notifications] Query result: ${JSON.stringify(result)}`);

            if (result.length === 0 || !result[0].fcm_token) {
                console.log(`[Notifications] No FCM token for user ${userId} - result was empty or token null`);
                return false;
            }

            const token = result[0].fcm_token;

            const message: admin.messaging.Message = {
                token,
                notification: { title, body },
                data,
                // iOS-specific settings
                apns: {
                    payload: {
                        aps: { sound: 'default', badge: 1 },
                    },
                },
                // Android-specific settings
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'hooprank_channel',
                        priority: 'high',
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

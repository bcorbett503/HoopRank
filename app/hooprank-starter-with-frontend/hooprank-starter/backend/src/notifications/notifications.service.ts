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
        await this.usersRepository.update(userId, { fcmToken: token });
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
}

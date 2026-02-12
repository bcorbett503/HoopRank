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
                        aps: { sound: 'default' },
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
            // Ensure one token maps to one user (prevents cross-account push delivery on shared devices)
            if (this.isPostgres) {
                await this.dataSource.query(`
                    UPDATE users
                    SET fcm_token = NULL, updated_at = NOW()
                    WHERE fcm_token = $1 AND id::TEXT <> $2::TEXT
                `, [token, userId]);

                const result = await this.dataSource.query(`
                    UPDATE users SET fcm_token = $1, updated_at = NOW()
                    WHERE id = $2
                `, [token, userId]);
                console.log('saveFcmToken: update result=', result);
            } else {
                await this.dataSource.query(`
                    UPDATE users SET fcm_token = ?, updated_at = datetime('now')
                    WHERE fcm_token = ? AND id <> ?
                `, [null, token, userId]);

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
     * Clear FCM token for a user on logout/account switch.
     */
    async clearFcmToken(userId: string): Promise<void> {
        if (this.isPostgres) {
            await this.dataSource.query(`
                UPDATE users
                SET fcm_token = NULL, updated_at = NOW()
                WHERE id::TEXT = $1::TEXT
            `, [userId]);
            return;
        }
        await this.dataSource.query(`
            UPDATE users
            SET fcm_token = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [null, userId]);
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
                        aps: { sound: 'default' },
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

    /**
     * Send notification asking opponent to confirm a submitted score
     */
    async sendScoreSubmittedNotification(
        opponentUserId: string,
        submitterName: string,
        scoreCreator: number,
        scoreOpponent: number,
        matchId: string,
    ): Promise<void> {
        const title = '📊 Confirm Score';
        const body = `${submitterName} submitted a score (${scoreCreator}-${scoreOpponent}). Tap to confirm or contest.`;

        await this.sendToUser(opponentUserId, title, body, {
            type: 'score_submitted',
            matchId,
        });
    }

    /**
     * Send notification telling the submitter their score was contested
     */
    async sendScoreContestedNotification(
        submitterUserId: string,
        contesterName: string,
        matchId: string,
    ): Promise<void> {
        const title = '⚠️ Score Contested';
        const body = `${contesterName} contested your submitted score. The match is voided.`;

        await this.sendToUser(submitterUserId, title, body, {
            type: 'score_contested',
            matchId,
        });
    }

    // =====================
    // TEAM NOTIFICATIONS
    // =====================

    /**
     * Helper: send multicast push notification to all active members of a team,
     * optionally excluding one user (e.g. the sender).
     */
    async sendToTeamMembers(
        teamId: string,
        excludeUserId: string | null,
        title: string,
        body: string,
        data: Record<string, string> = {},
    ): Promise<void> {
        try {
            const excludeClause = excludeUserId ? `AND tm.user_id != $2` : '';
            const params = excludeUserId ? [teamId, excludeUserId] : [teamId];

            const result = await this.dataSource.query(`
                SELECT u.fcm_token
                FROM users u
                JOIN team_members tm ON u.id = tm.user_id
                WHERE tm.team_id = $1
                  AND tm.status = 'active'
                  ${excludeClause}
                  AND u.fcm_token IS NOT NULL
            `, params);

            const tokens = result.map((r: any) => r.fcm_token).filter((t: string) => t);
            if (tokens.length === 0) return;

            const message: admin.messaging.MulticastMessage = {
                tokens,
                notification: { title, body },
                data,
                apns: { payload: { aps: { sound: 'default' } } },
            };
            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`[TeamNotif] ${title}: ${response.successCount} sent, ${response.failureCount} failed`);
        } catch (error) {
            console.error(`[TeamNotif] Error sending to team ${teamId}:`, error.message);
        }
    }

    /** Notify player they've been invited to a team */
    async sendTeamInviteNotification(playerId: string, teamName: string): Promise<void> {
        await this.sendToUser(playerId, '🏀 Team Invite!', `You've been invited to join ${teamName}`, {
            type: 'team_invite',
        });
    }

    /** Notify team owner that an invite was accepted */
    async sendTeamInviteAcceptedNotification(ownerId: string, playerName: string, teamName: string): Promise<void> {
        await this.sendToUser(ownerId, '🎉 New Teammate!', `${playerName} joined ${teamName}`, {
            type: 'team_invite_accepted',
        });
    }

    /** Notify all team members about a new event (practice or game) */
    async sendTeamEventNotification(
        teamId: string, creatorId: string,
        eventType: string, title: string, dateStr: string,
    ): Promise<void> {
        const emoji = eventType === 'practice' ? '🏋️' : '🏀';
        await this.sendToTeamMembers(
            teamId, creatorId,
            `${emoji} New ${eventType === 'practice' ? 'Practice' : 'Game'}`,
            `${title} — ${dateStr}`,
            { type: 'team_event', teamId },
        );
    }

    /** Notify opponent team that a score was submitted and needs confirmation */
    async sendTeamScoreSubmittedNotification(
        opponentTeamId: string, submitterTeamName: string,
        scoreCreator: number, scoreOpponent: number, matchId: string,
    ): Promise<void> {
        await this.sendToTeamMembers(
            opponentTeamId, null,
            '📊 Confirm Score',
            `${submitterTeamName} submitted a score (${scoreCreator}-${scoreOpponent}). Open Teams → Schedule to confirm or amend.`,
            { type: 'team_score_submitted', matchId },
        );
    }

    /** Notify original submitter team that an amendment was proposed */
    async sendTeamAmendmentNotification(
        submitterTeamId: string, amenderTeamName: string,
        amendedCreator: number, amendedOpponent: number, matchId: string,
    ): Promise<void> {
        await this.sendToTeamMembers(
            submitterTeamId, null,
            '✏️ Score Amendment',
            `${amenderTeamName} proposed ${amendedCreator}-${amendedOpponent}. Open Teams → Schedule to accept or reject.`,
            { type: 'team_amendment', matchId },
        );
    }

    /** Notify a team that a match was finalized with ratings */
    async sendTeamMatchFinalizedNotification(
        teamId: string, opponentName: string,
        won: boolean, score: string,
    ): Promise<void> {
        const title = won ? '🏆 Victory!' : '📊 Match Finalized';
        const body = won
            ? `Your team beat ${opponentName} (${score}). Ratings updated!`
            : `${opponentName} won (${score}). Ratings updated.`;
        await this.sendToTeamMembers(teamId, null, title, body, {
            type: 'team_match_finalized',
        });
    }

    /** Notify amender team that their amendment was accepted or rejected */
    async sendTeamAmendmentResponseNotification(
        amenderTeamId: string, responderTeamName: string,
        accepted: boolean,
    ): Promise<void> {
        const title = accepted ? '✅ Amendment Accepted' : '❌ Amendment Rejected';
        const body = accepted
            ? `${responderTeamName} accepted your score amendment. Match finalized!`
            : `${responderTeamName} rejected your amendment. Original score stands for confirmation.`;
        await this.sendToTeamMembers(amenderTeamId, null, title, body, {
            type: 'team_amendment_response',
        });
    }
}

import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PlayerStatus, StatusLike, StatusComment, EventAttendee } from './status.entity';
import { DbDialect } from '../common/db-utils';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class StatusesService {
    private dialect: DbDialect;
    private statusIdMigrated = false;

    constructor(
        private dataSource: DataSource,
        @InjectRepository(PlayerStatus)
        private statusRepo: Repository<PlayerStatus>,
        @InjectRepository(StatusLike)
        private likeRepo: Repository<StatusLike>,
        @InjectRepository(StatusComment)
        private commentRepo: Repository<StatusComment>,
        @InjectRepository(EventAttendee)
        private attendeeRepo: Repository<EventAttendee>,
        private notificationsService: NotificationsService,
    ) {
        this.dialect = new DbDialect(dataSource);
    }

    // ========== Status CRUD ==========

    async createStatus(
        userId: string,
        content: string,
        imageUrl?: string,
        scheduledAt?: string,
        courtId?: string,
        videoUrl?: string,
        videoThumbnailUrl?: string,
        videoDurationMs?: number,
        gameMode?: string,
        courtType?: string,
        ageRange?: string,
        taggedPlayerIds?: string[],
        tagMode?: string,
    ): Promise<PlayerStatus> {
        try {
            console.log('createStatus called:', { userId, content, imageUrl, scheduledAt, courtId, videoUrl, videoDurationMs, gameMode, courtType, ageRange });

            // Use raw SQL to insert status (bypasses TypeORM entity schema issues)
            const result = await this.dataSource.query(`
                INSERT INTO player_statuses (user_id, content, image_url, scheduled_at, court_id, video_url, video_thumbnail_url, video_duration_ms, game_mode, court_type, age_range, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
                RETURNING *
            `, [userId, content, imageUrl || null, scheduledAt ? new Date(scheduledAt) : null, courtId || null, videoUrl || null, videoThumbnailUrl || null, videoDurationMs || null, gameMode || null, courtType || null, ageRange || null]);

            const createdStatus = result[0];
            console.log('createStatus success:', createdStatus);

            // Auto-mark creator as attending for scheduled runs
            if (scheduledAt && createdStatus.id) {
                try {
                    await this.markAttending(userId, createdStatus.id);
                    console.log('Auto-marked creator as attending for scheduled run:', createdStatus.id);
                } catch (attendError) {
                    console.error('Failed to auto-mark creator as attending:', attendError.message);
                }
            }

            // Send push notification to court followers for scheduled runs
            if (scheduledAt && courtId) {
                this.sendScheduledRunNotification(userId, courtId, scheduledAt, content).catch(err => {
                    console.error('Failed to send scheduled run notification:', err.message);
                });
            }

            // Send push notifications to tagged players
            if (scheduledAt && tagMode && (tagMode === 'all' || tagMode === 'local' || (tagMode === 'individual' && taggedPlayerIds && taggedPlayerIds.length > 0))) {
                this.sendTaggedPlayerNotifications(userId, tagMode, taggedPlayerIds || [], scheduledAt, courtId, content).catch(err => {
                    console.error('Failed to send tagged player notifications:', err.message);
                });
            }

            return createdStatus;
        } catch (error) {
            console.error('createStatus error:', error.message);
            throw error;
        }
    }

    // Helper method to send scheduled run notifications to court followers
    private async sendScheduledRunNotification(
        userId: string,
        courtId: string,
        scheduledAt: string,
        content: string,
    ): Promise<void> {
        try {
            // Get user name and court name
            const [userResult, courtResult] = await Promise.all([
                this.dataSource.query(`SELECT name FROM users WHERE id = $1`, [userId]),
                this.dataSource.query(`SELECT name FROM courts WHERE id = $1`, [courtId]),
            ]);

            const userName = userResult[0]?.name || 'Someone';
            const courtName = courtResult[0]?.name || 'a court';

            // Format scheduled time
            const scheduledDate = new Date(scheduledAt);
            const timeStr = scheduledDate.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            });

            // Get all users following this court with alerts enabled
            const followers = await this.dataSource.query(`
                SELECT DISTINCT u.fcm_token, u.id
                FROM users u
                JOIN user_court_alerts a ON u.id::TEXT = a.user_id::TEXT
                WHERE a.court_id = $1 AND u.fcm_token IS NOT NULL AND u.id != $2
            `, [courtId, userId]);

            if (followers.length === 0) {
                console.log('No followers to notify for scheduled run at', courtName);
                return;
            }

            console.log(`Sending scheduled run notification to ${followers.length} followers of ${courtName}`);

            // Send notification to each follower
            for (const follower of followers) {
                this.notificationsService.sendToUser(
                    follower.id,
                    `🏀 Run scheduled at ${courtName}`,
                    `${userName} scheduled a run: ${timeStr}`,
                    { type: 'scheduled_run', courtId, scheduledAt },
                ).catch(() => { });
            }
        } catch (error) {
            console.error('sendScheduledRunNotification error:', error.message);
        }
    }

    // Send push notifications to tagged/invited players
    private async sendTaggedPlayerNotifications(
        userId: string,
        tagMode: string,
        taggedPlayerIds: string[],
        scheduledAt: string,
        courtId?: string,
        content?: string,
    ): Promise<void> {
        try {
            // Get creator name and court name
            const [userResult, courtResult] = await Promise.all([
                this.dataSource.query(`SELECT name FROM users WHERE id = $1`, [userId]),
                courtId ? this.dataSource.query(`SELECT name FROM courts WHERE id = $1`, [courtId]) : Promise.resolve([]),
            ]);

            const userName = userResult[0]?.name || 'Someone';
            const courtName = courtResult[0]?.name || '';

            // Format scheduled time
            const scheduledDate = new Date(scheduledAt);
            const timeStr = scheduledDate.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            });

            let playerIdsToNotify: string[] = [];

            if (tagMode === 'all' || tagMode === 'local') {
                // Notify all players that follow this user (or that this user follows)
                const followers = await this.dataSource.query(
                    `SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $1`,
                    [userId],
                );
                playerIdsToNotify = followers.map((r: any) => r.followed_id).filter((id: string) => id !== userId);
            } else if (tagMode === 'individual') {
                playerIdsToNotify = taggedPlayerIds.filter(id => id !== userId);
            }

            if (playerIdsToNotify.length === 0) {
                console.log('No tagged players to notify');
                return;
            }

            const locationStr = courtName ? ` at ${courtName}` : '';
            console.log(`Sending run invite notification to ${playerIdsToNotify.length} tagged players`);

            for (const playerId of playerIdsToNotify) {
                this.notificationsService.sendToUser(
                    playerId,
                    `🏀 ${userName} invited you to a run!`,
                    `${timeStr}${locationStr}`,
                    { type: 'run_invite', scheduledAt, ...(courtId ? { courtId } : {}) },
                ).catch(() => { });
            }
        } catch (error) {
            console.error('sendTaggedPlayerNotifications error:', error.message);
        }
    }

    async getStatus(statusId: number): Promise<any> {
        const d = this.dialect.reset();
        const query = `
            SELECT 
                ps.id,
                ps.user_id as "userId",
                u.name as "userName",
                u.avatar_url as "userPhotoUrl",
                ps.content,
                ps.image_url as "imageUrl",
                ps.created_at as "createdAt",
                (SELECT COUNT(*) FROM status_likes WHERE status_id = ps.id) as "likeCount",
                (SELECT COUNT(*) FROM status_comments WHERE status_id = ps.id) as "commentCount"
            FROM player_statuses ps
            LEFT JOIN users u ON ${d.cast('ps.user_id', 'TEXT')} = ${d.cast('u.id', 'TEXT')}
            WHERE ps.id = ${d.param()}
        `;
        const result = await this.dataSource.query(query, [statusId]);
        return result[0] || null;
    }

    async deleteStatus(userId: string, statusId: number): Promise<boolean> {
        const result = await this.statusRepo.delete({ id: statusId, userId });
        return (result.affected ?? 0) > 0;
    }

    // ========== Feed ==========

    async getFeed(userId: string, limit: number = 50): Promise<any[]> {
        try {
            const d = this.dialect.reset();
            const query = `
                SELECT 
                    ps.id,
                    ps.user_id as "userId",
                    u.name as "userName",
                    u.avatar_url as "userPhotoUrl",
                    ps.content,
                    ps.image_url as "imageUrl",
                    ps.created_at as "createdAt",
                    (SELECT COUNT(*) FROM status_likes WHERE status_id = ps.id) as "likeCount",
                    (SELECT COUNT(*) FROM status_comments WHERE status_id = ps.id) as "commentCount",
                    EXISTS(SELECT 1 FROM status_likes WHERE status_id = ps.id AND ${d.cast('user_id', 'TEXT')} = ${d.param()}) as "isLikedByMe"
                FROM player_statuses ps
                LEFT JOIN users u ON ${d.cast('ps.user_id', 'TEXT')} = ${d.cast('u.id', 'TEXT')}
                WHERE ${d.cast('ps.user_id', 'TEXT')} IN (
                    SELECT ${d.cast('followed_id', 'TEXT')} FROM user_followed_players WHERE ${d.cast('follower_id', 'TEXT')} = ${d.param()}
                )
                OR ${d.cast('ps.user_id', 'TEXT')} = ${d.param()}
                ORDER BY ps.created_at DESC
                LIMIT ${d.param()}
            `;
            return this.dataSource.query(query, [userId, userId, userId, limit]);
        } catch (error) {
            console.error('getFeed error:', error.message);
            return [];
        }
    }

    async getUserPosts(targetUserId: string, viewerUserId?: string): Promise<any[]> {
        const d = this.dialect.reset();
        const query = `
            SELECT 
                ps.id,
                ps.user_id as "userId",
                u.name as "userName",
                u.avatar_url as "userPhotoUrl",
                ps.content,
                ps.image_url as "imageUrl",
                ps.created_at as "createdAt",
                (SELECT COUNT(*) FROM status_likes WHERE status_id = ps.id) as "likeCount",
                (SELECT COUNT(*) FROM status_comments WHERE status_id = ps.id) as "commentCount",
                EXISTS(SELECT 1 FROM status_likes WHERE status_id = ps.id AND ${d.cast('user_id', 'TEXT')} = ${d.param()}) as "isLikedByMe"
            FROM player_statuses ps
            LEFT JOIN users u ON ${d.cast('ps.user_id', 'TEXT')} = ${d.cast('u.id', 'TEXT')}
            WHERE ${d.cast('ps.user_id', 'TEXT')} = ${d.param()}
            ORDER BY ps.created_at DESC
            LIMIT 50
        `;
        return this.dataSource.query(query, [viewerUserId || '', targetUserId]);
    }

    // ========== Likes ==========

    async likeStatus(userId: string, statusId: number): Promise<void> {
        try {
            const like = this.likeRepo.create({ statusId, userId });
            await this.likeRepo.save(like);
        } catch (error: any) {
            // Ignore duplicate key errors (already liked)
            if (!error.message?.includes('UNIQUE constraint') && error.code !== '23505') {
                throw error;
            }
        }
    }

    async unlikeStatus(userId: string, statusId: number): Promise<void> {
        await this.likeRepo.delete({ statusId, userId });
    }

    async isLiked(userId: string, statusId: number): Promise<boolean> {
        const count = await this.likeRepo.count({ where: { statusId, userId } });
        return count > 0;
    }

    async getLikes(statusId: number): Promise<any[]> {
        const d = this.dialect.reset();
        const query = `
            SELECT 
                sl.user_id as "userId",
                u.name as "userName",
                u.avatar_url as "userPhotoUrl",
                sl.created_at as "createdAt"
            FROM status_likes sl
            LEFT JOIN users u ON ${d.cast('sl.user_id', 'TEXT')} = ${d.cast('u.id', 'TEXT')}
            WHERE sl.status_id = ${d.param()}
            ORDER BY sl.created_at DESC
        `;
        return this.dataSource.query(query, [statusId]);
    }

    // ========== Comments ==========

    async addComment(userId: string, statusId: number, content: string): Promise<StatusComment> {
        const comment = this.commentRepo.create({ statusId, userId, content });
        return this.commentRepo.save(comment);
    }

    async getComments(statusId: number): Promise<any[]> {
        const d = this.dialect.reset();
        const query = `
            SELECT 
                sc.id,
                sc.user_id as "userId",
                u.name as "userName",
                u.avatar_url as "userPhotoUrl",
                sc.content,
                sc.created_at as "createdAt"
            FROM status_comments sc
            LEFT JOIN users u ON ${d.cast('sc.user_id', 'TEXT')} = ${d.cast('u.id', 'TEXT')}
            WHERE sc.status_id = ${d.param()}
            ORDER BY sc.created_at ASC
        `;
        return this.dataSource.query(query, [statusId]);
    }

    async deleteComment(userId: string, commentId: number): Promise<boolean> {
        const result = await this.commentRepo.delete({ id: commentId, userId });
        return (result.affected ?? 0) > 0;
    }

    // ========== Event Attendance (I'm IN) ==========

    async markAttending(userId: string, statusId: number): Promise<void> {
        try {
            const attendee = this.attendeeRepo.create({ statusId, userId });
            await this.attendeeRepo.save(attendee);
        } catch (error: any) {
            // Ignore duplicate key errors (already attending)
            if (!error.message?.includes('UNIQUE constraint') && error.code !== '23505') {
                throw error;
            }
        }
    }

    async removeAttending(userId: string, statusId: number): Promise<void> {
        await this.attendeeRepo.delete({ statusId, userId });
    }

    async isAttending(userId: string, statusId: number): Promise<boolean> {
        const count = await this.attendeeRepo.count({ where: { statusId, userId } });
        return count > 0;
    }

    async getAttendees(statusId: number): Promise<any[]> {
        const d = this.dialect.reset();
        const query = `
            SELECT 
                ea.user_id as "userId",
                u.name as "userName",
                u.avatar_url as "userPhotoUrl",
                ea.created_at as "createdAt"
            FROM event_attendees ea
            LEFT JOIN users u ON ${d.cast('ea.user_id', 'TEXT')} = ${d.cast('u.id', 'TEXT')}
            WHERE ea.status_id = ${d.param()}
            ORDER BY ea.created_at ASC
        `;
        return this.dataSource.query(query, [statusId]);
    }

    // ========== Unified Feed ==========

    /**
     * Calculate a relevance score for feed items.
     * Higher score = more relevant to the user.
     */
    private calculateFeedScore(item: any, userId: string, followedPlayerIds: Set<string>, followedCourtIds: Set<string>, now: Date): number {
        let score = 0;

        // 1. RECENCY: Decay factor - newer posts score higher (max 100 points, decays over 7 days)
        const ageMs = now.getTime() - new Date(item.createdAt).getTime();
        const ageHours = ageMs / (1000 * 60 * 60);
        const recencyScore = Math.max(0, 100 - (ageHours / 168) * 100); // 168 hours = 7 days
        score += recencyScore;

        // 2. ENGAGEMENT: Likes, comments, attendees (max ~150 points)
        const likeScore = Math.min((item.likeCount || 0) * 2, 30);       // 2 pts per like, max 30
        const commentScore = Math.min((item.commentCount || 0) * 3, 45); // 3 pts per comment, max 45
        const attendeeScore = Math.min((item.attendeeCount || 0) * 5, 75); // 5 pts per attendee, max 75
        score += likeScore + commentScore + attendeeScore;

        // 3. RELATIONSHIP: Boost followed content (50 points)
        const isOwnPost = item.userId === userId;
        const isFollowedPlayer = followedPlayerIds.has(item.userId);
        const isFollowedCourt = item.courtId && followedCourtIds.has(item.courtId);

        if (isOwnPost) {
            score += 60; // Always show own posts prominently
        } else if (isFollowedPlayer) {
            score += 50; // Followed players get priority
        } else if (isFollowedCourt) {
            score += 40; // Followed courts get good priority
        }

        // 4. UPCOMING EVENTS: Boost scheduled runs in next 48 hours (40 points)
        if (item.scheduledAt) {
            const scheduledTime = new Date(item.scheduledAt);
            const hoursUntilEvent = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);

            if (hoursUntilEvent > 0 && hoursUntilEvent <= 48) {
                // Closer events get higher boost
                const eventBoost = 40 * (1 - hoursUntilEvent / 48);
                score += eventBoost;
            } else if (hoursUntilEvent > 48 && hoursUntilEvent <= 168) {
                // Events within a week still get a small boost
                score += 15;
            }
        }

        // 5. CONTENT TYPE: Matches are inherently interesting (10 points)
        if (item.type === 'match' || item.type === 'team_match') {
            score += 10;
        }

        // 6. DISCOVERY BONUS: Nearby unfollowed courts get a discovery bonus
        //    (This is applied later in the main function based on proximity)
        item._isDiscovery = !isOwnPost && !isFollowedPlayer && !isFollowedCourt;

        return score;
    }

    async getUnifiedFeed(userId: string, filter: string = 'all', limit: number = 50, lat?: number, lng?: number): Promise<any[]> {
        try {
            // Ensure status_id column exists on matches before querying
            if (!this.statusIdMigrated) {
                await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS status_id INTEGER`).catch(() => { });
                this.statusIdMigrated = true;
            }

            console.log('getUnifiedFeed: filter=', filter, 'userId=', userId, 'lat=', lat, 'lng=', lng);

            // Status SELECT clause with additional fields for scoring
            const statusSelectClause = `
                SELECT 
                    'status' as type,
                    ps.id::TEXT as id,
                    ps.id as "statusId",
                    ps.created_at as "createdAt",
                    ps.user_id::TEXT as "userId",
                    COALESCE(u.name, 'Unknown') as "userName",
                    u.avatar_url as "userPhotoUrl",
                    ps.content,
                    ps.image_url as "imageUrl",
                    ps.video_url as "videoUrl",
                    ps.video_thumbnail_url as "videoThumbnailUrl",
                    ps.video_duration_ms as "videoDurationMs",
                    ps.scheduled_at as "scheduledAt",
                    ps.court_id::TEXT as "courtId",
                    c.name as "courtName",
                    ST_Y(c.geog::geometry) as "courtLat",
                    ST_X(c.geog::geometry) as "courtLng",
                    ps.game_mode as "gameMode",
                    ps.court_type as "courtType",
                    ps.age_range as "ageRange",
                    NULL as "matchStatus",
                    NULL as "matchScore",
                    NULL as "winnerName",
                    NULL as "loserName",
                    NULL::DOUBLE PRECISION as "winnerRating",
                    NULL::DOUBLE PRECISION as "loserRating",
                    NULL::DOUBLE PRECISION as "winnerOldRating",
                    NULL::DOUBLE PRECISION as "loserOldRating",
                    COALESCE((SELECT COUNT(*) FROM status_likes WHERE status_id = ps.id), 0)::INTEGER as "likeCount",
                    COALESCE((SELECT COUNT(*) FROM status_comments WHERE status_id = ps.id), 0)::INTEGER as "commentCount",
                    EXISTS(SELECT 1 FROM status_likes WHERE status_id = ps.id AND user_id = $1) as "isLikedByMe",
                    COALESCE((SELECT COUNT(*) FROM event_attendees WHERE status_id = ps.id), 0)::INTEGER as "attendeeCount",
                    EXISTS(SELECT 1 FROM event_attendees WHERE status_id = ps.id AND user_id = $1) as "isAttendingByMe"
                FROM player_statuses ps
                LEFT JOIN users u ON ps.user_id::TEXT = u.id::TEXT
                LEFT JOIN courts c ON ps.court_id::TEXT = c.id::TEXT
            `;

            // Match SELECT clause (for completed 1v1 matches only)
            const matchSelectClause = `
                SELECT 
                    'match' as type,
                    m.id::TEXT as id,
                    m.status_id as "statusId",
                    m.updated_at as "createdAt",
                    m.winner_id::TEXT as "userId",
                    COALESCE(winner.name, 'Unknown') as "userName",
                    winner.avatar_url as "userPhotoUrl",
                    COALESCE(winner.name, 'Player') || ' vs ' || COALESCE(loser.name, 'Opponent') as content,
                    NULL as "imageUrl",
                    NULL as "videoUrl",
                    NULL as "videoThumbnailUrl",
                    NULL::INTEGER as "videoDurationMs",
                    NULL as "scheduledAt",
                    m.court_id::TEXT as "courtId",
                    COALESCE(mc.name, '') as "courtName",
                    ST_Y(mc.geog::geometry) as "courtLat",
                    ST_X(mc.geog::geometry) as "courtLng",
                    NULL as "gameMode",
                    NULL as "courtType",
                    NULL as "ageRange",
                    CASE WHEN m.status = 'completed' THEN 'ended' ELSE m.status END as "matchStatus",
                    CASE 
                        WHEN m.score_creator IS NOT NULL AND m.score_opponent IS NOT NULL 
                        THEN m.score_creator::TEXT || '-' || m.score_opponent::TEXT
                        ELSE NULL
                    END as "matchScore",
                    winner.name as "winnerName",
                    loser.name as "loserName",
                    winner.hoop_rank as "winnerRating",
                    loser.hoop_rank as "loserRating",
                    NULL::DOUBLE PRECISION as "winnerOldRating",
                    NULL::DOUBLE PRECISION as "loserOldRating",
                    COALESCE((SELECT COUNT(*) FROM status_likes WHERE status_id = m.status_id), 0)::INTEGER as "likeCount",
                    COALESCE((SELECT COUNT(*) FROM status_comments WHERE status_id = m.status_id), 0)::INTEGER as "commentCount",
                    COALESCE(EXISTS(SELECT 1 FROM status_likes WHERE status_id = m.status_id AND user_id::TEXT = $1), false) as "isLikedByMe",
                    0 as "attendeeCount",
                    false as "isAttendingByMe"
                FROM matches m
                LEFT JOIN users winner ON m.winner_id::TEXT = winner.id::TEXT
                LEFT JOIN users loser ON 
                    CASE WHEN m.winner_id = m.creator_id THEN m.opponent_id ELSE m.creator_id END::TEXT = loser.id::TEXT
                LEFT JOIN courts mc ON m.court_id::TEXT = mc.id::TEXT
                WHERE m.status = 'completed' AND m.winner_id IS NOT NULL AND (m.team_match IS NULL OR m.team_match = false)
            `;

            // Team Match SELECT clause
            const teamMatchSelectClause = `
                SELECT 
                    'team_match' as type,
                    m.id::TEXT as id,
                    m.status_id as "statusId",
                    m.updated_at as "createdAt",
                    m.winner_id::TEXT as "userId",
                    CASE 
                        WHEN m.winner_id::TEXT = m.creator_team_id::TEXT THEN COALESCE(ct.name, 'Team A')
                        ELSE COALESCE(ot.name, 'Team A')
                    END as "userName",
                    NULL as "userPhotoUrl",
                    COALESCE(ct.name, 'Team A') || ' vs ' || COALESCE(ot.name, 'Team B') as content,
                    NULL as "imageUrl",
                    NULL as "videoUrl",
                    NULL as "videoThumbnailUrl",
                    NULL::INTEGER as "videoDurationMs",
                    NULL as "scheduledAt",
                    m.court_id::TEXT as "courtId",
                    COALESCE(mc.name, '') as "courtName",
                    ST_Y(mc.geog::geometry) as "courtLat",
                    ST_X(mc.geog::geometry) as "courtLng",
                    NULL as "gameMode",
                    NULL as "courtType",
                    NULL as "ageRange",
                    'ended' as "matchStatus",
                    CASE 
                        WHEN m.score_creator IS NOT NULL AND m.score_opponent IS NOT NULL 
                        THEN m.score_creator::TEXT || '-' || m.score_opponent::TEXT
                        ELSE NULL
                    END as "matchScore",
                    CASE 
                        WHEN m.winner_id::TEXT = m.creator_team_id::TEXT THEN ct.name
                        ELSE ot.name
                    END as "winnerName",
                    CASE 
                        WHEN m.winner_id::TEXT = m.creator_team_id::TEXT THEN ot.name
                        ELSE ct.name
                    END as "loserName",
                    COALESCE(m.winner_new_rating, CASE 
                        WHEN m.winner_id::TEXT = m.creator_team_id::TEXT THEN ct.rating
                        ELSE ot.rating
                    END) as "winnerRating",
                    COALESCE(m.loser_new_rating, CASE 
                        WHEN m.winner_id::TEXT = m.creator_team_id::TEXT THEN ot.rating
                        ELSE ct.rating
                    END) as "loserRating",
                    m.winner_old_rating as "winnerOldRating",
                    m.loser_old_rating as "loserOldRating",
                    COALESCE((SELECT COUNT(*) FROM status_likes WHERE status_id = m.status_id), 0)::INTEGER as "likeCount",
                    COALESCE((SELECT COUNT(*) FROM status_comments WHERE status_id = m.status_id), 0)::INTEGER as "commentCount",
                    COALESCE(EXISTS(SELECT 1 FROM status_likes WHERE status_id = m.status_id AND user_id::TEXT = $1), false) as "isLikedByMe",
                    0 as "attendeeCount",
                    false as "isAttendingByMe"
                FROM matches m
                LEFT JOIN teams ct ON m.creator_team_id::TEXT = ct.id::TEXT
                LEFT JOIN teams ot ON m.opponent_team_id::TEXT = ot.id::TEXT
                LEFT JOIN courts mc ON m.court_id::TEXT = mc.id::TEXT
                WHERE m.status = 'completed' AND m.team_match = true AND m.winner_id IS NOT NULL
            `;

            // Get user's followed players and courts for scoring
            const [followedPlayersResult, followedCourtsResult] = await Promise.all([
                this.dataSource.query(`SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $1`, [userId]),
                this.dataSource.query(`SELECT court_id FROM user_followed_courts WHERE user_id::TEXT = $1`, [userId])
            ]);

            const followedPlayerIds = new Set<string>(followedPlayersResult.map((r: any) => r.followed_id));
            const followedCourtIds = new Set<string>(followedCourtsResult.map((r: any) => r.court_id));
            const now = new Date();

            if (filter === 'foryou') {
                // FOR YOU: Smart algorithm with scoring
                console.log('getUnifiedFeed: FOR YOU mode with smart scoring');

                // Fetch more items than needed so we can score and rank them
                const fetchLimit = Math.min(limit * 3, 150);

                let allItems: any[] = [];

                if (lat !== undefined && lng !== undefined) {
                    // TIER 1: Own posts + followed content (no geo filter)
                    const tier1Query = `
                        (${statusSelectClause}
                        WHERE ps.user_id = $1
                           OR ps.user_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $2)
                           OR ps.court_id IN (SELECT court_id FROM user_followed_courts WHERE user_id::TEXT = $2))
                        UNION ALL
                        (${matchSelectClause}
                        AND (m.creator_id = $1 OR m.opponent_id = $1
                             OR m.creator_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $2)
                             OR m.opponent_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $2)))
                        UNION ALL
                        (${teamMatchSelectClause})
                        ORDER BY "createdAt" DESC
                        LIMIT $3
                    `;
                    const tier1Results = await this.dataSource.query(tier1Query, [userId, userId, fetchLimit]);
                    allItems.push(...tier1Results);
                    console.log(`getUnifiedFeed: Tier 1 (followed) = ${tier1Results.length} items`);

                    // TIER 2: Discovery - Nearby courts user doesn't follow (within 50mi / 80km)
                    const discoveryRadius = 80467; // 50 miles in meters
                    const discoveryQuery = `
                        (${statusSelectClause}
                        WHERE c.geog IS NOT NULL 
                          AND ST_DWithin(c.geog, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)
                          AND ps.user_id != $1
                          AND (ps.court_id IS NULL OR ps.court_id NOT IN (SELECT court_id FROM user_followed_courts WHERE user_id::TEXT = $5))
                          AND ps.user_id NOT IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $5))
                        UNION ALL
                        (${matchSelectClause}
                        AND mc.geog IS NOT NULL
                        AND ST_DWithin(mc.geog, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4)
                        AND m.creator_id != $1 AND m.opponent_id != $1
                        AND m.creator_id NOT IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $5)
                        AND m.opponent_id NOT IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $5))
                        ORDER BY "createdAt" DESC
                        LIMIT $6
                    `;
                    const discoveryResults = await this.dataSource.query(discoveryQuery, [userId, lng, lat, discoveryRadius, userId, fetchLimit]);
                    // Mark these as discovery items
                    discoveryResults.forEach((item: any) => item._isDiscovery = true);
                    allItems.push(...discoveryResults);
                    console.log(`getUnifiedFeed: Tier 2 (discovery) = ${discoveryResults.length} items within 50mi`);

                    // TIER 3: Expanding radius if still not enough content
                    if (allItems.length < limit) {
                        const radiusTiers = [160934, 402336, 804672]; // 100mi, 250mi, 500mi
                        for (const radius of radiusTiers) {
                            const expandedQuery = `
                                (${statusSelectClause}
                                WHERE c.geog IS NOT NULL 
                                  AND ST_DWithin(c.geog, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4))
                                UNION ALL
                                (${matchSelectClause}
                                AND mc.geog IS NOT NULL
                                AND ST_DWithin(mc.geog, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4))
                                ORDER BY "createdAt" DESC
                                LIMIT $5
                            `;
                            const expandedResults = await this.dataSource.query(expandedQuery, [userId, lng, lat, radius, fetchLimit]);

                            // Add only new items
                            const existingIds = new Set(allItems.map(i => i.id));
                            const newItems = expandedResults.filter((item: any) => !existingIds.has(item.id));
                            allItems.push(...newItems);

                            console.log(`getUnifiedFeed: Expanded to ${Math.round(radius / 1609)}mi, added ${newItems.length} items`);

                            if (allItems.length >= limit) break;
                        }
                    }
                } else {
                    // No location - fall back to followed content + network-wide popular
                    const fallbackQuery = `
                        (${statusSelectClause}
                        WHERE ps.user_id = $1
                           OR ps.user_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $2)
                           OR ps.court_id IN (SELECT court_id FROM user_followed_courts WHERE user_id::TEXT = $2))
                        UNION ALL
                        (${matchSelectClause}
                        AND (m.creator_id = $1 OR m.opponent_id = $1
                             OR m.creator_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $2)
                             OR m.opponent_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $2)))
                        UNION ALL
                        (${teamMatchSelectClause})
                        ORDER BY "createdAt" DESC
                        LIMIT $3
                    `;
                    allItems = await this.dataSource.query(fallbackQuery, [userId, userId, fetchLimit]);

                    // If not enough, add network-wide content
                    if (allItems.length < limit) {
                        const networkQuery = `
                            (${statusSelectClause})
                            UNION ALL
                            (${matchSelectClause})
                            UNION ALL
                            (${teamMatchSelectClause})
                            ORDER BY "createdAt" DESC
                            LIMIT $2
                        `;
                        const networkResults = await this.dataSource.query(networkQuery, [userId, fetchLimit]);
                        const existingIds = new Set(allItems.map(i => i.id));
                        const newItems = networkResults.filter((item: any) => !existingIds.has(item.id));
                        allItems.push(...newItems);
                    }
                }

                // De-duplicate by id
                const seenIds = new Set<string>();
                allItems = allItems.filter(item => {
                    if (seenIds.has(item.id)) return false;
                    seenIds.add(item.id);
                    return true;
                });

                // Score all items
                const scoredItems = allItems.map(item => ({
                    ...item,
                    _score: this.calculateFeedScore(item, userId, followedPlayerIds, followedCourtIds, now)
                }));

                // Sort by score (highest first)
                scoredItems.sort((a, b) => b._score - a._score);

                // Ensure discovery items are mixed in (at least 20% of feed)
                const discoveryItems = scoredItems.filter(i => i._isDiscovery);
                const regularItems = scoredItems.filter(i => !i._isDiscovery);

                const discoverySlots = Math.max(2, Math.floor(limit * 0.2));
                const regularSlots = limit - discoverySlots;

                const finalFeed: any[] = [];
                let regularIdx = 0;
                let discoveryIdx = 0;

                // Interleave: every 4th item is a discovery item (if available)
                for (let i = 0; i < limit && (regularIdx < regularItems.length || discoveryIdx < discoveryItems.length); i++) {
                    if (i % 5 === 4 && discoveryIdx < discoveryItems.length) {
                        // Discovery slot
                        finalFeed.push(discoveryItems[discoveryIdx++]);
                    } else if (regularIdx < regularItems.length) {
                        // Regular slot
                        finalFeed.push(regularItems[regularIdx++]);
                    } else if (discoveryIdx < discoveryItems.length) {
                        // Fill with discovery if no regular left
                        finalFeed.push(discoveryItems[discoveryIdx++]);
                    }
                }

                // Clean up internal scoring fields before returning
                finalFeed.forEach(item => {
                    delete item._score;
                    delete item._isDiscovery;
                });

                console.log(`getUnifiedFeed: FOR YOU returning ${finalFeed.length} scored items`);
                return finalFeed.slice(0, limit);

            } else if (filter === 'following') {
                // FOLLOWING: Only posts from followed players/courts (unchanged logic)
                const statusQuery = `
                    ${statusSelectClause}
                    WHERE ps.user_id = $1
                       OR ps.court_id IN (SELECT court_id FROM user_followed_courts WHERE user_id::TEXT = $2)
                       OR ps.user_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $3)
                    ORDER BY "createdAt" DESC
                    LIMIT $4
                `;
                const matchQuery = `
                    ${matchSelectClause}
                    AND (m.creator_id = $1 OR m.opponent_id = $1
                         OR m.creator_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $2)
                         OR m.opponent_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $2))
                    ORDER BY "createdAt" DESC
                    LIMIT $3
                `;
                const teamMatchQuery = `
                    ${teamMatchSelectClause}
                    ORDER BY "createdAt" DESC
                    LIMIT $1
                `;
                const [statusResults, matchResults, teamMatchResults] = await Promise.all([
                    this.dataSource.query(statusQuery, [userId, userId, userId, limit]).catch(e => { console.error('FOLLOWING statusQuery error:', e.message); return []; }),
                    this.dataSource.query(matchQuery, [userId, userId, limit]).catch(e => { console.error('FOLLOWING matchQuery error:', e.message); return []; }),
                    this.dataSource.query(teamMatchQuery, [limit]).catch(e => { console.error('FOLLOWING teamMatchQuery error:', e.message); return []; })
                ]);

                // Score and sort
                let merged = [...statusResults, ...matchResults, ...teamMatchResults];
                merged = merged.map(item => ({
                    ...item,
                    _score: this.calculateFeedScore(item, userId, followedPlayerIds, followedCourtIds, now)
                }));
                merged.sort((a, b) => b._score - a._score);
                merged.forEach(item => delete item._score);

                console.log('getUnifiedFeed: FOLLOWING merged', statusResults.length, 'statuses +', matchResults.length, 'matches +', teamMatchResults.length, 'team matches');
                return merged.slice(0, limit);

            } else {
                // ALL: Same as following but with scoring (default view)
                const statusQuery = `
                    ${statusSelectClause}
                    WHERE ps.user_id = $1
                       OR ps.court_id IN (SELECT court_id FROM user_followed_courts WHERE user_id::TEXT = $2)
                       OR ps.user_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $3)
                    ORDER BY "createdAt" DESC
                    LIMIT $4
                `;
                const matchQuery = `
                    ${matchSelectClause}
                    AND (m.creator_id = $1 OR m.opponent_id = $1
                         OR m.creator_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $2)
                         OR m.opponent_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $2))
                    ORDER BY "createdAt" DESC
                    LIMIT $3
                `;
                const teamMatchQuery = `
                    ${teamMatchSelectClause}
                    ORDER BY "createdAt" DESC
                    LIMIT $1
                `;
                const [statusResults, matchResults, teamMatchResults] = await Promise.all([
                    this.dataSource.query(statusQuery, [userId, userId, userId, limit]).catch(e => { console.error('ALL statusQuery error:', e.message); return []; }),
                    this.dataSource.query(matchQuery, [userId, userId, limit]).catch(e => { console.error('ALL matchQuery error:', e.message); return []; }),
                    this.dataSource.query(teamMatchQuery, [limit]).catch(e => { console.error('ALL teamMatchQuery error:', e.message); return []; })
                ]);

                // Score and sort
                let merged = [...statusResults, ...matchResults, ...teamMatchResults];
                merged = merged.map(item => ({
                    ...item,
                    _score: this.calculateFeedScore(item, userId, followedPlayerIds, followedCourtIds, now)
                }));
                merged.sort((a, b) => b._score - a._score);
                merged.forEach(item => delete item._score);

                console.log('getUnifiedFeed: ALL merged', statusResults.length, 'statuses +', matchResults.length, 'matches +', teamMatchResults.length, 'team matches');
                return merged.slice(0, limit);
            }
        } catch (error) {
            console.error('getUnifiedFeed error:', error.message);
            return [];
        }
    }


    // Debug method to check player_statuses table contents
    async debugPlayerStatuses(): Promise<any> {
        try {
            // Get all statuses
            const allStatuses = await this.dataSource.query(`
                SELECT * FROM player_statuses ORDER BY created_at DESC LIMIT 10
            `);

            // Get followed players for test user
            const followedPlayers = await this.dataSource.query(`
                SELECT * FROM user_followed_players LIMIT 5
            `);

            // Get followed courts for test user  
            const followedCourts = await this.dataSource.query(`
                SELECT * FROM user_followed_courts LIMIT 5
            `);

            // Get users table schema
            const usersColumns = await this.dataSource.query(`
                SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'
            `);

            // Get check_ins
            const checkIns = await this.dataSource.query(`
                SELECT * FROM check_ins ORDER BY checked_in_at DESC LIMIT 5
            `);

            // Get matches
            const matches = await this.dataSource.query(`
                SELECT * FROM matches ORDER BY created_at DESC LIMIT 5
            `);

            // Get users table sample (to check id type and data)
            const users = await this.dataSource.query(`
                SELECT id, email, name, avatar_url FROM users LIMIT 5
            `);

            // Get player_statuses schema
            const statusesSchema = await this.dataSource.query(`
                SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'player_statuses'
            `);

            return {
                allStatuses,
                followedPlayers,
                followedCourts,
                usersColumns,
                checkIns,
                matches,
                users,
                statusesSchema
            };
        } catch (error) {
            return { error: error.message, stack: error.stack };
        }
    }

    // Simple test query to debug unified feed
    async testFeedQuery(userId: string): Promise<any> {
        try {
            // Just query statuses directly without complex CTEs
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

            return {
                userId,
                simpleQuery,
                message: 'Direct query without JOINs or CTEs'
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    // Migration method to add video columns
    async migrateVideoColumns(): Promise<any> {
        try {
            // Check if columns already exist
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

            // Add columns that don't exist
            const alterQuery = `
                ALTER TABLE player_statuses 
                ADD COLUMN IF NOT EXISTS video_url VARCHAR(500),
                ADD COLUMN IF NOT EXISTS video_thumbnail_url VARCHAR(500),
                ADD COLUMN IF NOT EXISTS video_duration_ms INTEGER;
            `;
            await this.dataSource.query(alterQuery);

            // Verify columns were added
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

    async migrateRunAttributeColumns(): Promise<any> {
        try {
            const alterQuery = `
                ALTER TABLE player_statuses 
                ADD COLUMN IF NOT EXISTS game_mode VARCHAR(10),
                ADD COLUMN IF NOT EXISTS court_type VARCHAR(20),
                ADD COLUMN IF NOT EXISTS age_range VARCHAR(10);
            `;
            await this.dataSource.query(alterQuery);

            // Verify columns were added
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
}

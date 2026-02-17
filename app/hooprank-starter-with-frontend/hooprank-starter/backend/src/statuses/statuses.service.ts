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
        isRecurring?: boolean,
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

            // Use raw SQL to insert status (bypasses TypeORM entity schema issues)
            const result = await this.dataSource.query(`
                INSERT INTO player_statuses (user_id, content, image_url, scheduled_at, court_id, video_url, video_thumbnail_url, video_duration_ms, game_mode, court_type, age_range, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
                RETURNING *
            `, [userId, content, imageUrl || null, scheduledAt ? new Date(scheduledAt) : null, courtId || null, videoUrl || null, videoThumbnailUrl || null, videoDurationMs || null, gameMode || null, courtType || null, ageRange || null]);

            const createdStatus = result[0];

            // Bridge: also write to scheduled_runs so Courts→Runs filter works
            if (scheduledAt && courtId) {
                try {
                    // scheduled_runs is created/migrated by RunsService on startup, but keep this defensive
                    // so status posting doesn't break if the table/column is missing in some environment.
                    await this.dataSource
                        .query(`ALTER TABLE scheduled_runs ADD COLUMN IF NOT EXISTS status_id INTEGER`)
                        .catch(() => { });

                    const scheduledDate = new Date(scheduledAt);
                    if (!isNaN(scheduledDate.getTime())) {
                        let insertedRuns: any[] = [];
                        const statusId = createdStatus?.id ?? null;

                        if (isRecurring) {
                            // Weekly recurring for one year from the scheduled date/time.
                            // We intentionally materialize the recurrence into scheduled_runs
                            // so existing queries (Courts->Runs, court details) work without
                            // schema changes.
                            // NOTE: scheduled_runs.title is VARCHAR(255); LEFT(...) prevents inserts
                            // from failing if the status content is longer than 255 chars.
                            const until = new Date(scheduledDate);
                            until.setFullYear(until.getFullYear() + 1);

                            insertedRuns = await this.dataSource.query(`
                                INSERT INTO scheduled_runs (court_id, created_by, title, game_mode, court_type, age_range, scheduled_at, created_at, status_id)
                                SELECT $1, $2, LEFT($3, 255), $4, $5, $6, gs.scheduled_at, NOW(), $9
                                FROM generate_series($7::timestamp, $8::timestamp, interval '1 week') AS gs(scheduled_at)
                                RETURNING id
                            `, [
                                courtId,
                                userId,
                                content || null,
                                gameMode || '5v5',
                                courtType || null,
                                ageRange || null,
                                scheduledDate,
                                until,
                                statusId,
                            ]);
                        } else {
                            // NOTE: scheduled_runs.title is VARCHAR(255); LEFT(...) prevents inserts
                            // from failing if the status content is longer than 255 chars.
                            insertedRuns = await this.dataSource.query(`
                                INSERT INTO scheduled_runs (court_id, created_by, title, game_mode, court_type, age_range, scheduled_at, created_at, status_id)
                                VALUES ($1, $2, LEFT($3, 255), $4, $5, $6, $7, NOW(), $8)
                                RETURNING id
                            `, [
                                courtId,
                                userId,
                                content || null,
                                gameMode || '5v5',
                                courtType || null,
                                ageRange || null,
                                scheduledDate,
                                statusId,
                            ]);
                        }

                        // Best-effort: also add the creator to run_attendees so the
                        // court details UI shows a correct attendeeCount/isAttending.
                        try {
                            const runIds = (insertedRuns || [])
                                .map((r: any) => r?.id)
                                .filter((id: any) => !!id);
                            if (runIds.length > 0) {
                                await this.dataSource.query(`
                                    INSERT INTO run_attendees (run_id, user_id, status, created_at)
                                    SELECT unnest($1::uuid[]), $2, 'going', NOW()
                                    ON CONFLICT DO NOTHING
                                `, [runIds, userId]);
                            }
                        } catch (attendBridgeErr) {
                            console.warn('createStatus: run_attendees bridge failed (non-fatal):', attendBridgeErr.message);
                        }
                    } else {
                        console.warn('createStatus: invalid scheduledAt, skipping scheduled_runs bridge');
                    }
                } catch (bridgeErr) {
                    console.warn('createStatus: scheduled_runs bridge failed (non-fatal):', bridgeErr.message);
                }
            }

            // Auto-mark creator as attending for scheduled runs
            if (scheduledAt && createdStatus.id) {
                try {
                    await this.markAttending(userId, createdStatus.id);
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
                return;
            }


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
                return;
            }

            const locationStr = courtName ? ` at ${courtName}` : '';

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
                ps.video_url as "videoUrl",
                ps.video_thumbnail_url as "videoThumbnailUrl",
                ps.video_duration_ms as "videoDurationMs",
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
        const deleted = (result.affected ?? 0) > 0;

        if (deleted) {
            // If this status represents a scheduled run (or recurring series), clean up
            // the scheduled_runs instances so Courts -> Runs doesn't show orphan data.
            try {
                await this.dataSource.query(`
                    DELETE FROM run_attendees
                    WHERE run_id IN (
                        SELECT id FROM scheduled_runs WHERE status_id = $1 AND created_by = $2
                    )
                `, [statusId, userId]);
                await this.dataSource.query(
                    `DELETE FROM scheduled_runs WHERE status_id = $1 AND created_by = $2`,
                    [statusId, userId],
                );
            } catch (e) {
                console.warn('deleteStatus: scheduled_runs cleanup failed (non-fatal):', e.message);
            }
        }

        return deleted;
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
                    ps.video_url as "videoUrl",
                    ps.video_thumbnail_url as "videoThumbnailUrl",
                    ps.video_duration_ms as "videoDurationMs",
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
                ps.video_url as "videoUrl",
                ps.video_thumbnail_url as "videoThumbnailUrl",
                ps.video_duration_ms as "videoDurationMs",
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
                    -- For recurring scheduled runs, always expose the *next* upcoming instance so the feed
                    -- doesn't disappear after the first occurrence.
                    COALESCE((
                        SELECT MIN(sr.scheduled_at)
                        FROM scheduled_runs sr
                        WHERE sr.status_id = ps.id
                          AND sr.scheduled_at >= NOW()
                    ), ps.scheduled_at) as "scheduledAt",
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
                LEFT JOIN matches shadow_m ON shadow_m.status_id = ps.id
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
                        ELSE COALESCE(ot.name, m.opponent_name, 'Team A')
                    END as "userName",
                    NULL as "userPhotoUrl",
                    COALESCE(ct.name, 'Team A') || ' vs ' || COALESCE(ot.name, m.opponent_name, 'Team B') as content,
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
                        WHEN m.winner_id::TEXT = m.creator_team_id::TEXT THEN COALESCE(ct.name, 'Team A')
                        ELSE COALESCE(ot.name, m.opponent_name, 'Team A')
                    END as "winnerName",
                    CASE 
                        WHEN m.winner_id::TEXT = m.creator_team_id::TEXT THEN COALESCE(ot.name, m.opponent_name, 'Opponent')
                        ELSE COALESCE(ct.name, 'Opponent')
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

                // Fetch more items than needed so we can score and rank them
                const fetchLimit = Math.min(limit * 3, 150);

                let allItems: any[] = [];

                if (lat !== undefined && lng !== undefined) {
                    // TIER 1: Own posts + followed content (no geo filter)
                    const tier1Query = `
                        (${statusSelectClause}
                        WHERE shadow_m.id IS NULL AND (ps.user_id = $1
                           OR ps.user_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $2)
                           OR ps.court_id IN (SELECT court_id FROM user_followed_courts WHERE user_id::TEXT = $2)))
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

                    // TIER 2: Discovery - Nearby courts user doesn't follow (within 50mi / 80km)
                    const discoveryRadius = 80467; // 50 miles in meters
                    const discoveryQuery = `
                        (${statusSelectClause}
                        WHERE shadow_m.id IS NULL
                          AND c.geog IS NOT NULL 
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

                    // TIER 3: Expanding radius if still not enough content
                    if (allItems.length < limit) {
                        const radiusTiers = [160934, 402336, 804672]; // 100mi, 250mi, 500mi
                        for (const radius of radiusTiers) {
                            const expandedQuery = `
                                (${statusSelectClause}
                                WHERE shadow_m.id IS NULL
                                  AND c.geog IS NOT NULL 
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


                            if (allItems.length >= limit) break;
                        }
                    }
                } else {
                    // No location - fall back to followed content + network-wide popular
                    const fallbackQuery = `
                        (${statusSelectClause}
                        WHERE shadow_m.id IS NULL AND (ps.user_id = $1
                           OR ps.user_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $2)
                           OR ps.court_id IN (SELECT court_id FROM user_followed_courts WHERE user_id::TEXT = $2)))
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
                            (${statusSelectClause} WHERE shadow_m.id IS NULL)
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

                return finalFeed.slice(0, limit);

            } else if (filter === 'following') {
                // FOLLOWING: Only posts from followed players/courts (unchanged logic)
                const statusQuery = `
                    ${statusSelectClause}
                    WHERE shadow_m.id IS NULL AND (ps.user_id = $1
                       OR ps.court_id IN (SELECT court_id FROM user_followed_courts WHERE user_id::TEXT = $2)
                       OR ps.user_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $3))
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

                return merged.slice(0, limit);

            } else {
                // ALL: Same as following but with scoring (default view)
                const statusQuery = `
                    ${statusSelectClause}
                    WHERE shadow_m.id IS NULL AND (ps.user_id = $1
                       OR ps.court_id IN (SELECT court_id FROM user_followed_courts WHERE user_id::TEXT = $2)
                       OR ps.user_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $3))
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

                return merged.slice(0, limit);
            }
        } catch (error) {
            console.error('getUnifiedFeed error:', error.message);
            return [];
        }
    }

}

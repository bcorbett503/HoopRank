import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class StatusesService {
    constructor(private dataSource: DataSource) { }

    // Create a new status
    async createStatus(userId: number, content: string, imageUrl?: string, scheduledAt?: string): Promise<any> {
        const result = await this.dataSource.query(`
            INSERT INTO player_statuses (user_id, content, image_url, scheduled_at, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id, user_id as "userId", content, image_url as "imageUrl", scheduled_at as "scheduledAt", created_at as "createdAt"
        `, [userId, content, imageUrl || null, scheduledAt || null]);
        return result[0];
    }

    // Get status by ID with like/comment counts
    async getStatus(statusId: number): Promise<any> {
        const result = await this.dataSource.query(`
            SELECT 
                ps.id,
                ps.user_id as "userId",
                u.display_name as "userName",
                u.avatar_url as "userPhotoUrl",
                ps.content,
                ps.image_url as "imageUrl",
                ps.created_at as "createdAt",
                (SELECT COUNT(*) FROM status_likes WHERE status_id = ps.id) as "likeCount",
                (SELECT COUNT(*) FROM status_comments WHERE status_id = ps.id) as "commentCount"
            FROM player_statuses ps
            JOIN users u ON ps.user_id = u.id
            WHERE ps.id = $1
        `, [statusId]);
        return result[0] || null;
    }

    // Get feed of statuses from followed users
    async getFeed(userId: number, limit: number = 50): Promise<any[]> {
        const result = await this.dataSource.query(`
            SELECT 
                ps.id,
                ps.user_id as "userId",
                u.display_name as "userName",
                u.avatar_url as "userPhotoUrl",
                ps.content,
                ps.image_url as "imageUrl",
                ps.created_at as "createdAt",
                (SELECT COUNT(*) FROM status_likes WHERE status_id = ps.id) as "likeCount",
                (SELECT COUNT(*) FROM status_comments WHERE status_id = ps.id) as "commentCount",
                EXISTS(SELECT 1 FROM status_likes WHERE status_id = ps.id AND user_id = $1) as "isLikedByMe"
            FROM player_statuses ps
            JOIN users u ON ps.user_id = u.id
            WHERE ps.user_id IN (
                SELECT followed_id FROM user_followed_players WHERE follower_id = $1
            )
            OR ps.user_id = $1
            ORDER BY ps.created_at DESC
            LIMIT $2
        `, [userId, limit]);
        return result;
    }

    // Get all posts by a specific user
    async getUserPosts(targetUserId: number, viewerUserId?: number): Promise<any[]> {
        const result = await this.dataSource.query(`
            SELECT 
                ps.id,
                ps.user_id as "userId",
                u.display_name as "userName",
                u.avatar_url as "userPhotoUrl",
                ps.content,
                ps.image_url as "imageUrl",
                ps.created_at as "createdAt",
                (SELECT COUNT(*) FROM status_likes WHERE status_id = ps.id) as "likeCount",
                (SELECT COUNT(*) FROM status_comments WHERE status_id = ps.id) as "commentCount",
                EXISTS(SELECT 1 FROM status_likes WHERE status_id = ps.id AND user_id = $2) as "isLikedByMe"
            FROM player_statuses ps
            JOIN users u ON ps.user_id = u.id
            WHERE ps.user_id = $1
            ORDER BY ps.created_at DESC
            LIMIT 50
        `, [targetUserId, viewerUserId || 0]);
        return result;
    }

    // Like a status
    async likeStatus(userId: number, statusId: number): Promise<void> {
        await this.dataSource.query(`
            INSERT INTO status_likes (status_id, user_id, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (status_id, user_id) DO NOTHING
        `, [statusId, userId]);
    }

    // Unlike a status
    async unlikeStatus(userId: number, statusId: number): Promise<void> {
        await this.dataSource.query(`
            DELETE FROM status_likes WHERE status_id = $1 AND user_id = $2
        `, [statusId, userId]);
    }

    // Check if user liked a status
    async isLiked(userId: number, statusId: number): Promise<boolean> {
        const result = await this.dataSource.query(`
            SELECT 1 FROM status_likes WHERE status_id = $1 AND user_id = $2
        `, [statusId, userId]);
        return result.length > 0;
    }

    // Get likes for a status
    async getLikes(statusId: number): Promise<any[]> {
        const result = await this.dataSource.query(`
            SELECT 
                sl.user_id as "userId",
                u.display_name as "userName",
                u.avatar_url as "userPhotoUrl",
                sl.created_at as "createdAt"
            FROM status_likes sl
            JOIN users u ON sl.user_id = u.id
            WHERE sl.status_id = $1
            ORDER BY sl.created_at DESC
        `, [statusId]);
        return result;
    }

    // Add a comment
    async addComment(userId: number, statusId: number, content: string): Promise<any> {
        const result = await this.dataSource.query(`
            INSERT INTO status_comments (status_id, user_id, content, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id, status_id as "statusId", user_id as "userId", content, created_at as "createdAt"
        `, [statusId, userId, content]);
        return result[0];
    }

    // Get comments for a status
    async getComments(statusId: number): Promise<any[]> {
        const result = await this.dataSource.query(`
            SELECT 
                sc.id,
                sc.user_id as "userId",
                u.display_name as "userName",
                u.avatar_url as "userPhotoUrl",
                sc.content,
                sc.created_at as "createdAt"
            FROM status_comments sc
            JOIN users u ON sc.user_id = u.id
            WHERE sc.status_id = $1
            ORDER BY sc.created_at ASC
        `, [statusId]);
        return result;
    }

    // Delete a comment (only by owner)
    async deleteComment(userId: number, commentId: number): Promise<boolean> {
        const result = await this.dataSource.query(`
            DELETE FROM status_comments WHERE id = $1 AND user_id = $2
        `, [commentId, userId]);
        return result.rowCount > 0;
    }

    // Delete a status (only by owner)
    async deleteStatus(userId: number, statusId: number): Promise<boolean> {
        const result = await this.dataSource.query(`
            DELETE FROM player_statuses WHERE id = $1 AND user_id = $2
        `, [statusId, userId]);
        return result.rowCount > 0;
    }

    // ========== Event Attendance (I'm IN) ==========

    // Mark user as attending an event
    async markAttending(userId: number, statusId: number): Promise<void> {
        await this.dataSource.query(`
            INSERT INTO event_attendees (status_id, user_id, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (status_id, user_id) DO NOTHING
        `, [statusId, userId]);
    }

    // Remove user from attending an event
    async removeAttending(userId: number, statusId: number): Promise<void> {
        await this.dataSource.query(`
            DELETE FROM event_attendees WHERE status_id = $1 AND user_id = $2
        `, [statusId, userId]);
    }

    // Check if user is attending an event
    async isAttending(userId: number, statusId: number): Promise<boolean> {
        const result = await this.dataSource.query(`
            SELECT 1 FROM event_attendees WHERE status_id = $1 AND user_id = $2
        `, [statusId, userId]);
        return result.length > 0;
    }

    // Get list of attendees for an event
    async getAttendees(statusId: number): Promise<any[]> {
        const result = await this.dataSource.query(`
            SELECT 
                ea.user_id as "userId",
                u.display_name as "userName",
                u.avatar_url as "userPhotoUrl",
                ea.created_at as "createdAt"
            FROM event_attendees ea
            JOIN users u ON ea.user_id = u.id
            WHERE ea.status_id = $1
            ORDER BY ea.created_at ASC
        `, [statusId]);
        return result;
    }

    // Get unified feed combining statuses, check-ins, and matches
    async getUnifiedFeed(userId: number, filter: string = 'all', limit: number = 50): Promise<any[]> {
        // Build the query based on filter
        let query = '';

        if (filter === 'courts') {
            // Only court-related activity (check-ins and matches at followed courts)
            query = `
                WITH followed_courts AS (
                    SELECT court_id FROM user_followed_courts WHERE user_id = $1
                ),
                followed_players AS (
                    SELECT followed_id FROM user_followed_players WHERE follower_id = $1
                )
                SELECT * FROM (
                    -- Check-ins at followed courts
                    SELECT 
                        'checkin' as type,
                        ci.id::text as id,
                        ci.checked_in_at as "createdAt",
                        ci.user_id as "userId",
                        u.display_name as "userName",
                        u.avatar_url as "userPhotoUrl",
                        NULL as content,
                        NULL as "imageUrl",
                        NULL as "scheduledAt",
                        ci.court_id as "courtId",
                        fc.name as "courtName",
                        NULL as "matchScore",
                        NULL as "matchStatus",
                        0 as "likeCount",
                        0 as "commentCount",
                        false as "isLikedByMe",
                        0 as "attendeeCount",
                        false as "isAttendingByMe"
                    FROM check_ins ci
                    JOIN users u ON ci.user_id = u.id
                    LEFT JOIN courts fc ON ci.court_id = fc.id::text
                    WHERE ci.court_id IN (SELECT court_id FROM followed_courts)
                    AND ci.checked_in_at > NOW() - INTERVAL '7 days'

                    UNION ALL

                    -- Matches at followed courts
                    SELECT 
                        'match' as type,
                        m.id::text as id,
                        m.created_at as "createdAt",
                        m.creator_id::integer as "userId",
                        u.display_name as "userName",
                        u.avatar_url as "userPhotoUrl",
                        NULL as content,
                        NULL as "imageUrl",
                        NULL as "scheduledAt",
                        m.court_id::text as "courtId",
                        fc.name as "courtName",
                        m.rating_diff_json::text as "matchScore",
                        m.status as "matchStatus",
                        0 as "likeCount",
                        0 as "commentCount",
                        false as "isLikedByMe",
                        0 as "attendeeCount",
                        false as "isAttendingByMe"
                    FROM matches m
                    JOIN users u ON m.creator_id::integer = u.id
                    LEFT JOIN courts fc ON m.court_id = fc.id
                    WHERE m.court_id::text IN (SELECT court_id FROM followed_courts)
                    AND m.created_at > NOW() - INTERVAL '7 days'
                ) combined
                ORDER BY "createdAt" DESC
                LIMIT $2
            `;
        } else {
            // All activity: statuses + check-ins + matches for followed players/courts
            query = `
                WITH followed_courts AS (
                    SELECT court_id FROM user_followed_courts WHERE user_id = $1
                ),
                followed_players AS (
                    SELECT followed_id FROM user_followed_players WHERE follower_id = $1
                )
                SELECT * FROM (
                    -- Status posts from followed players + own posts
                    SELECT 
                        'status' as type,
                        ps.id::text as id,
                        ps.created_at as "createdAt",
                        ps.user_id as "userId",
                        u.display_name as "userName",
                        u.avatar_url as "userPhotoUrl",
                        ps.content,
                        ps.image_url as "imageUrl",
                        ps.scheduled_at as "scheduledAt",
                        NULL as "courtId",
                        NULL as "courtName",
                        NULL as "matchScore",
                        NULL as "matchStatus",
                        (SELECT COUNT(*) FROM status_likes WHERE status_id = ps.id)::integer as "likeCount",
                        (SELECT COUNT(*) FROM status_comments WHERE status_id = ps.id)::integer as "commentCount",
                        EXISTS(SELECT 1 FROM status_likes WHERE status_id = ps.id AND user_id = $1) as "isLikedByMe",
                        (SELECT COUNT(*) FROM event_attendees WHERE status_id = ps.id)::integer as "attendeeCount",
                        EXISTS(SELECT 1 FROM event_attendees WHERE status_id = ps.id AND user_id = $1) as "isAttendingByMe"
                    FROM player_statuses ps
                    JOIN users u ON ps.user_id = u.id
                    WHERE ps.user_id IN (SELECT followed_id FROM followed_players)
                    OR ps.user_id = $1

                    UNION ALL

                    -- Check-ins at followed courts
                    SELECT 
                        'checkin' as type,
                        ci.id::text as id,
                        ci.checked_in_at as "createdAt",
                        ci.user_id as "userId",
                        u.display_name as "userName",
                        u.avatar_url as "userPhotoUrl",
                        NULL as content,
                        NULL as "imageUrl",
                        NULL as "scheduledAt",
                        ci.court_id as "courtId",
                        fc.name as "courtName",
                        NULL as "matchScore",
                        NULL as "matchStatus",
                        0 as "likeCount",
                        0 as "commentCount",
                        false as "isLikedByMe",
                        0 as "attendeeCount",
                        false as "isAttendingByMe"
                    FROM check_ins ci
                    JOIN users u ON ci.user_id = u.id
                    LEFT JOIN courts fc ON ci.court_id = fc.id::text
                    WHERE ci.court_id IN (SELECT court_id FROM followed_courts)
                    AND ci.checked_in_at > NOW() - INTERVAL '7 days'

                    UNION ALL

                    -- Matches involving followed players or at followed courts
                    SELECT 
                        'match' as type,
                        m.id::text as id,
                        m.created_at as "createdAt",
                        m.creator_id::integer as "userId",
                        u.display_name as "userName",
                        u.avatar_url as "userPhotoUrl",
                        NULL as content,
                        NULL as "imageUrl",
                        NULL as "scheduledAt",
                        m.court_id::text as "courtId",
                        fc.name as "courtName",
                        m.rating_diff_json::text as "matchScore",
                        m.status as "matchStatus",
                        0 as "likeCount",
                        0 as "commentCount",
                        false as "isLikedByMe",
                        0 as "attendeeCount",
                        false as "isAttendingByMe"
                    FROM matches m
                    JOIN users u ON m.creator_id::integer = u.id
                    LEFT JOIN courts fc ON m.court_id = fc.id
                    WHERE (
                        m.court_id::text IN (SELECT court_id FROM followed_courts)
                        OR m.creator_id::integer IN (SELECT followed_id FROM followed_players)
                        OR m.guest_id::integer IN (SELECT followed_id FROM followed_players)
                    )
                    AND m.created_at > NOW() - INTERVAL '7 days'
                ) combined
                ORDER BY "createdAt" DESC
                LIMIT $2
            `;
        }

        const result = await this.dataSource.query(query, [userId, limit]);
        return result;
    }
}

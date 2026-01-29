import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PlayerStatus, StatusLike, StatusComment, EventAttendee } from './status.entity';
import { DbDialect } from '../common/db-utils';

@Injectable()
export class StatusesService {
    private dialect: DbDialect;

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
        videoDurationMs?: number
    ): Promise<PlayerStatus> {
        try {
            console.log('createStatus called:', { userId, content, imageUrl, scheduledAt, courtId, videoUrl, videoDurationMs });

            // Use raw SQL to insert status (bypasses TypeORM entity schema issues)
            // NOTE: video columns commented out until schema sync completes
            // TODO: Re-enable video columns after database migration: video_url, video_thumbnail_url, video_duration_ms
            const result = await this.dataSource.query(`
                INSERT INTO player_statuses (user_id, content, image_url, scheduled_at, court_id, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
                RETURNING *
            `, [userId, content, imageUrl || null, scheduledAt ? new Date(scheduledAt) : null, courtId || null]);

            console.log('createStatus success:', result[0]);
            return result[0];
        } catch (error) {
            console.error('createStatus error:', error.message);
            throw error;
        }
    }

    async getStatus(statusId: number): Promise<any> {
        const d = this.dialect.reset();
        const query = `
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
                    u.display_name as "userName",
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
                u.display_name as "userName",
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
                u.display_name as "userName",
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
                u.display_name as "userName",
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
                u.display_name as "userName",
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

    async getUnifiedFeed(userId: string, filter: string = 'all', limit: number = 50): Promise<any[]> {
        try {
            // Simplified query - status posts only for now
            // Use LEFT JOINs and avoid subqueries to tables that may not exist
            // NOTE: video_url, video_thumbnail_url, video_duration_ms columns will be available
            // after schema sync - for now use NULL placeholders to avoid query errors
            const query = `
                SELECT 
                    'status' as type,
                    ps.id::TEXT as id,
                    ps.created_at as "createdAt",
                    ps.user_id as "userId",
                    COALESCE(u.display_name, 'Unknown') as "userName",
                    u.avatar_url as "userPhotoUrl",
                    ps.content,
                    ps.image_url as "imageUrl",
                    NULL as "videoUrl",
                    NULL as "videoThumbnailUrl",
                    NULL as "videoDurationMs",
                    ps.scheduled_at as "scheduledAt",
                    ps.court_id as "courtId",
                    c.name as "courtName",
                    0 as "likeCount",
                    0 as "commentCount",
                    false as "isLikedByMe",
                    0 as "attendeeCount",
                    false as "isAttendingByMe"
                FROM player_statuses ps
                LEFT JOIN users u ON ps.user_id::TEXT = u.id::TEXT
                LEFT JOIN courts c ON ps.court_id::TEXT = c.id::TEXT
                WHERE ps.user_id = $1
                   OR ps.court_id IN (SELECT court_id FROM user_followed_courts WHERE user_id::TEXT = $2)
                   OR ps.user_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id::TEXT = $3)
                ORDER BY ps.created_at DESC
                LIMIT $4
            `;

            console.log('getUnifiedFeed: executing simplified query for user:', userId);
            const results = await this.dataSource.query(query, [userId, userId, userId, limit]);
            console.log('getUnifiedFeed: got', results.length, 'results');
            return results;
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
                SELECT id, email, display_name, avatar_url FROM users LIMIT 5
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
}

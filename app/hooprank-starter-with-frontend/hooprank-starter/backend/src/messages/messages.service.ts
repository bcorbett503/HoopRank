import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Message } from './message.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MessagesService {
    constructor(
        @InjectRepository(Message)
        private messagesRepository: Repository<Message>,
        private dataSource: DataSource,
    ) { }

    async sendMessage(senderId: string, receiverId: string, content: string, matchId?: string, isChallenge?: boolean): Promise<Message> {
        const isPostgres = !!process.env.DATABASE_URL;
        const id = uuidv4();
        const threadId = uuidv4();

        if (isPostgres) {
            const result = await this.dataSource.query(`
                INSERT INTO messages (id, thread_id, from_id, to_id, body, is_challenge, challenge_status, match_id, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                RETURNING *
            `, [id, threadId, senderId, receiverId, content, isChallenge || false, isChallenge ? 'pending' : null, matchId || null]);
            return result[0];
        }

        const message = this.messagesRepository.create({
            id,
            threadId,
            fromId: senderId,
            toId: receiverId,
            body: content,
            isChallenge: isChallenge || false,
            challengeStatus: isChallenge ? 'pending' : null,
            matchId
        } as any);
        const saved = await this.messagesRepository.save(message);
        return Array.isArray(saved) ? saved[0] : saved;
    }

    async getPendingChallenges(userId: string): Promise<any[]> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            try {
                // Get challenges where user is sender OR receiver with pending status
                const results = await this.dataSource.query(`
                    SELECT m.*, 
                        u.id as sender_id, u.name as sender_name, u.avatar_url as sender_avatar_url, u.hoop_rank as sender_hoop_rank,
                        CASE 
                            WHEN m.from_id = $1 THEN 'sent'
                            ELSE 'received'
                        END as direction
                    FROM messages m
                    JOIN users u ON u.id = CASE WHEN m.from_id = $1 THEN m.to_id ELSE m.from_id END
                    WHERE m.is_challenge = true 
                        AND m.challenge_status = 'pending'
                        AND (m.from_id = $1 OR m.to_id = $1)
                    ORDER BY m.created_at DESC
                `, [userId]);

                return results.map((r: any) => ({
                    message: {
                        id: r.id,
                        senderId: r.from_id,
                        receiverId: r.to_id,
                        content: r.body,
                        createdAt: r.created_at,
                        isChallenge: r.is_challenge,
                        challengeStatus: r.challenge_status,
                        matchId: r.match_id,
                    },
                    sender: {
                        id: r.sender_id,
                        name: r.sender_name,
                        photoUrl: r.sender_avatar_url,
                        hoopRank: r.sender_hoop_rank,
                    },
                    direction: r.direction,
                }));
            } catch (error) {
                console.error('getPendingChallenges error:', error.message);
                return [];
            }
        }

        // SQLite fallback
        return [];
    }

    async getConversations(userId: string): Promise<any[]> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            try {
                // Get the most recent message with each unique conversation partner
                const results = await this.dataSource.query(`
                    WITH ranked_messages AS (
                        SELECT m.*, 
                            CASE WHEN m.from_id = $1 THEN m.to_id ELSE m.from_id END as other_user_id,
                            ROW_NUMBER() OVER (
                                PARTITION BY CASE WHEN m.from_id = $1 THEN m.to_id ELSE m.from_id END
                                ORDER BY m.created_at DESC
                            ) as rn
                        FROM messages m
                        WHERE m.from_id = $1 OR m.to_id = $1
                    )
                    SELECT rm.*, u.id as user_id, u.display_name, u.avatar_url, u.rating
                    FROM ranked_messages rm
                    JOIN users u ON u.id = rm.other_user_id
                    WHERE rm.rn = 1
                    ORDER BY rm.created_at DESC
                `, [userId]);


                return results.map((r: any) => ({
                    threadId: r.thread_id,
                    user: {
                        id: r.user_id,
                        name: r.display_name,
                        photoUrl: r.avatar_url,
                        rating: r.rating,
                    },
                    lastMessage: {
                        id: r.id,
                        senderId: r.from_id,
                        receiverId: r.to_id,
                        content: r.body,
                        createdAt: r.created_at,
                        isChallenge: r.is_challenge,
                        challengeStatus: r.challenge_status,
                    },
                    // Simple unread logic: if last message was from the other user, treat as unread
                    unreadCount: r.from_id !== userId ? 1 : 0,
                }));
            } catch (error) {
                console.error('getConversations error:', error.message);
                return [];
            }
        }

        // SQLite fallback - Get all messages where user is sender or receiver
        const messages = await this.messagesRepository.find({
            where: [
                { fromId: userId },
                { toId: userId }
            ],
            relations: ['sender', 'receiver'],
            order: { createdAt: 'DESC' }
        });

        // Group by other user
        const conversations = new Map<string, any>();

        for (const msg of messages) {
            const otherUser = msg.fromId === userId ? msg.receiver : msg.sender;
            if (otherUser && !conversations.has(otherUser.id)) {
                conversations.set(otherUser.id, {
                    user: otherUser,
                    lastMessage: msg
                });
            }
        }

        return Array.from(conversations.values());
    }

    async getMessages(userId: string, otherUserId: string): Promise<Message[]> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            try {
                const results = await this.dataSource.query(`
                    SELECT id, thread_id, from_id as "senderId", to_id as "receiverId", 
                           body as content, created_at as "createdAt", 
                           is_challenge as "isChallenge", challenge_status as "challengeStatus",
                           match_id as "matchId"
                    FROM messages
                    WHERE (from_id = $1 AND to_id = $2) OR (from_id = $2 AND to_id = $1)
                    ORDER BY created_at ASC
                `, [userId, otherUserId]);
                return results;
            } catch (error) {
                console.error('getMessages error:', error.message);
                return [];
            }
        }

        return await this.messagesRepository.find({
            where: [
                { fromId: userId, toId: otherUserId },
                { fromId: otherUserId, toId: userId }
            ],
            order: { createdAt: 'ASC' }
        });
    }

    /**
     * Get count of unread messages for a user (messages where user is receiver and not read)
     * For now, return count of conversations with messages from others (simple implementation)
     */
    async getUnreadCount(userId: string): Promise<number> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            try {
                // Count distinct senders who sent messages to this user
                // This is a simplified version - a full implementation would need read_at tracking
                const result = await this.dataSource.query(`
                    SELECT COUNT(DISTINCT from_id) as count
                    FROM messages
                    WHERE to_id = $1
                `, [userId]);
                return parseInt(result[0]?.count || '0', 10);
            } catch (error) {
                console.error('getUnreadCount error:', error.message);
                return 0;
            }
        }

        // SQLite fallback
        return 0;
    }

    /**
     * Update challenge status (accept/decline)
     */
    async updateChallengeStatus(messageId: string, status: 'accepted' | 'declined', userId: string): Promise<any> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            try {
                // Update the challenge status
                await this.dataSource.query(`
                    UPDATE messages 
                    SET challenge_status = $1, updated_at = NOW()
                    WHERE id = $2 AND is_challenge = true
                `, [status, messageId]);

                // Return the updated message
                const result = await this.dataSource.query(`
                    SELECT * FROM messages WHERE id = $1
                `, [messageId]);

                return result.length > 0 ? result[0] : null;
            } catch (error) {
                console.error('updateChallengeStatus error:', error.message);
                throw error;
            }
        }

        // SQLite fallback
        return null;
    }
}


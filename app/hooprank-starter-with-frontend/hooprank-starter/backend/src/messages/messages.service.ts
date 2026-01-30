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
            try {
                console.log('sendMessage: inserting message:', { id, threadId, senderId, receiverId, content, isChallenge, matchId });
                const result = await this.dataSource.query(`
                    INSERT INTO messages (id, thread_id, from_id, to_id, body, read, is_challenge, challenge_status, match_id, created_at)
                    VALUES ($1, $2, $3, $4, $5, false, $6, $7, $8, NOW())
                    RETURNING *
                `, [id, threadId, senderId, receiverId, content, isChallenge || false, isChallenge ? 'pending' : null, matchId || null]);
                console.log('sendMessage: success:', result[0]);
                return result[0];
            } catch (error) {
                console.error('sendMessage error:', error.message, error.stack);
                throw error;
            }
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
                        u.id as sender_id, u.name as sender_name, u.avatar_url as sender_avatar_url, u.hoop_rank as sender_rating,
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
                        rating: r.sender_rating,
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
                // Ensure read columns exist for unread tracking
                await this.ensureReadColumnsExist();

                // Get the most recent message with each unique conversation partner
                // Also count unread messages from each conversation partner
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
                    ),
                    unread_counts AS (
                        SELECT from_id as other_user_id, COUNT(*) as unread_count
                        FROM messages
                        WHERE to_id = $1 AND (read = false OR read IS NULL)
                        GROUP BY from_id
                    )
                    SELECT rm.*, u.id as user_id, u.name, u.avatar_url, u.hoop_rank as rating,
                           COALESCE(uc.unread_count, 0) as unread_count
                    FROM ranked_messages rm
                    JOIN users u ON u.id = rm.other_user_id
                    LEFT JOIN unread_counts uc ON uc.other_user_id = rm.other_user_id
                    WHERE rm.rn = 1
                    ORDER BY rm.created_at DESC
                `, [userId]);


                return results.map((r: any) => ({
                    threadId: r.thread_id,
                    user: {
                        id: r.user_id,
                        name: r.name,
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
                        read: r.read,
                    },
                    // Use actual unread count from database
                    unreadCount: parseInt(r.unread_count || '0', 10),
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
                // Ensure read columns exist
                await this.ensureReadColumnsExist();

                // Count actual unread messages (where user is receiver and read is false or null)
                const result = await this.dataSource.query(`
                    SELECT COUNT(*) as count
                    FROM messages
                    WHERE to_id = $1 AND (read = false OR read IS NULL)
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
                    SET challenge_status = $1
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

    /**
     * Mark all messages from a specific sender as read
     * Called when user opens a conversation
     */
    async markConversationAsRead(userId: string, otherUserId: string): Promise<{ markedCount: number }> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            try {
                // Ensure the 'read' and 'read_at' columns exist (auto-migration)
                await this.ensureReadColumnsExist();

                // Mark all messages FROM the other user TO the current user as read
                const result = await this.dataSource.query(`
                    UPDATE messages 
                    SET read = true, read_at = NOW()
                    WHERE from_id = $1 AND to_id = $2 AND (read = false OR read IS NULL)
                `, [otherUserId, userId]);

                // PostgreSQL returns affected row count in result[1] for UPDATE
                const markedCount = result?.[1] || 0;
                return { markedCount };
            } catch (error) {
                console.error('markConversationAsRead error:', error.message);
                return { markedCount: 0 };
            }
        }
        return { markedCount: 0 };
    }

    /**
     * Ensure the read tracking columns exist in the messages table
     */
    private async ensureReadColumnsExist(): Promise<void> {
        try {
            // Check if 'read' column exists
            const readCol = await this.dataSource.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'messages' AND column_name = 'read'
            `);

            if (readCol.length === 0) {
                await this.dataSource.query(`
                    ALTER TABLE messages ADD COLUMN read BOOLEAN DEFAULT false
                `);
                console.log('Added read column to messages table');
            }

            // Check if 'read_at' column exists  
            const readAtCol = await this.dataSource.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'messages' AND column_name = 'read_at'
            `);

            if (readAtCol.length === 0) {
                await this.dataSource.query(`
                    ALTER TABLE messages ADD COLUMN read_at TIMESTAMP
                `);
                console.log('Added read_at column to messages table');
            }
        } catch (error) {
            console.error('ensureReadColumnsExist error:', error.message);
        }
    }

    async debugMessagesTable(): Promise<any> {
        try {
            // Get table schema
            const schema = await this.dataSource.query(`
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'messages'
                ORDER BY ordinal_position
            `);

            // Count messages
            const count = await this.dataSource.query(`SELECT COUNT(*) as count FROM messages`);

            // Check foreign key constraints
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
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_name = 'messages'
            `);

            // Check if message_threads table exists
            const threads = await this.dataSource.query(`
                SELECT table_name FROM information_schema.tables 
                WHERE table_name LIKE '%thread%';
            `);

            // Try a test insert and rollback
            const { v4: uuidv4 } = require('uuid');
            const testId = uuidv4();
            const testThreadId = uuidv4();
            let insertError = null;
            try {
                await this.dataSource.query(`
                    INSERT INTO messages (id, thread_id, from_id, to_id, body, read, is_challenge, created_at)
                    VALUES ($1, $2, $3, $4, $5, false, false, NOW())
                    RETURNING id
                `, [testId, testThreadId, 'test-user', 'test-user2', 'test']);
                // Delete test row
                await this.dataSource.query(`DELETE FROM messages WHERE id = $1`, [testId]);
            } catch (e) {
                insertError = e.message;
            }

            return {
                success: true,
                schema,
                messageCount: count[0]?.count,
                fkConstraints,
                threadTables: threads,
                testInsertError: insertError
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}


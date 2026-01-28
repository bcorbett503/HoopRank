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
            // Get challenges where user is sender OR receiver with pending status
            const results = await this.dataSource.query(`
                SELECT m.*, 
                    u.id as sender_id, u.name as sender_name, u.photo_url as sender_photo_url, u.hoop_rank as sender_hoop_rank,
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
                    photoUrl: r.sender_photo_url,
                    hoopRank: r.sender_hoop_rank,
                },
                direction: r.direction,
            }));
        }

        // SQLite fallback
        return [];
    }

    async getConversations(userId: string): Promise<any[]> {
        // Get all messages where user is sender or receiver
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
        return await this.messagesRepository.find({
            where: [
                { fromId: userId, toId: otherUserId },
                { fromId: otherUserId, toId: userId }
            ],
            order: { createdAt: 'ASC' }
        });
    }
}


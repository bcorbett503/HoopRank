import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './message.entity';

@Injectable()
export class MessagesService {
    constructor(
        @InjectRepository(Message)
        private messagesRepository: Repository<Message>,
    ) { }

    async sendMessage(senderId: string, receiverId: string, content: string, matchId?: string): Promise<Message> {
        const message = this.messagesRepository.create({
            senderId,
            receiverId,
            content,
            matchId
        });
        return await this.messagesRepository.save(message);
    }

    async getConversations(userId: string): Promise<any[]> {
        // Get all messages where user is sender or receiver
        const messages = await this.messagesRepository.find({
            where: [
                { senderId: userId },
                { receiverId: userId }
            ],
            relations: ['sender', 'receiver'],
            order: { createdAt: 'DESC' }
        });

        // Group by other user
        const conversations = new Map<string, any>();

        for (const msg of messages) {
            const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
            if (!conversations.has(otherUser.id)) {
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
                { senderId: userId, receiverId: otherUserId },
                { senderId: otherUserId, receiverId: userId }
            ],
            order: { createdAt: 'ASC' }
        });
    }
}

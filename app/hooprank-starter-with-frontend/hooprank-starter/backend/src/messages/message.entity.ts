import { Entity, Column, PrimaryColumn, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Message entity mapped to production PostgreSQL schema.
 * Production uses from_id/to_id/thread_id instead of senderId/receiverId.
 */
@Entity('messages')
export class Message {
    @PrimaryColumn({ type: 'uuid' })
    id: string;

    @Column({ name: 'thread_id', type: 'uuid' })
    threadId: string;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'from_id' })
    sender: User;

    @Column({ name: 'from_id', type: 'text' })
    fromId: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'to_id' })
    receiver: User;

    @Column({ name: 'to_id', type: 'text', nullable: true })
    toId: string;

    @Column({ type: 'text' })
    body: string;

    @Column({ type: 'boolean', default: false })
    read: boolean;

    @Column({ name: 'is_challenge', type: 'boolean', default: false })
    isChallenge: boolean;

    @Column({ name: 'challenge_status', type: 'text', nullable: true })
    challengeStatus: string;

    @Column({ name: 'match_id', type: 'uuid', nullable: true })
    matchId: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    // Legacy compatibility
    get senderId(): string { return this.fromId; }
    get receiverId(): string | undefined { return this.toId; }
    get content(): string { return this.body; }
}

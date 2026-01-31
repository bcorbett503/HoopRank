import { Entity, Column, PrimaryColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Court } from '../courts/court.entity';
import { Match } from '../matches/match.entity';

/**
 * Challenge entity - manages challenge lifecycle independently from messages.
 * 
 * Status flow:
 *   pending -> accepted (creates match) -> completed (when score submitted)
 *   pending -> declined
 *   pending -> cancelled (by sender)
 */
@Entity('challenges')
export class Challenge {
    @PrimaryColumn({ type: 'uuid' })
    id: string;

    @Column({ name: 'from_user_id', type: 'text' })
    fromUserId: string;

    @Column({ name: 'to_user_id', type: 'text' })
    toUserId: string;

    @Column({ name: 'court_id', type: 'uuid', nullable: true })
    courtId: string;

    @Column({ type: 'text', nullable: true })
    message: string;

    @Column({ type: 'text', default: 'pending' })
    status: string;  // pending, accepted, declined, completed, cancelled

    @Column({ name: 'match_id', type: 'uuid', nullable: true })
    matchId: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => User)
    @JoinColumn({ name: 'from_user_id' })
    fromUser: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'to_user_id' })
    toUser: User;

    @ManyToOne(() => Court, { nullable: true })
    @JoinColumn({ name: 'court_id' })
    court: Court;

    @ManyToOne(() => Match, { nullable: true })
    @JoinColumn({ name: 'match_id' })
    match: Match;
}

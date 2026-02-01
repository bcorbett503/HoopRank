import { Entity, Column, PrimaryColumn, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Court } from '../courts/court.entity';

/**
 * Match entity mapped to production PostgreSQL schema.
 * Production uses creator_id/opponent_id instead of hostId/guestId.
 */
@Entity('matches')
export class Match {
    @PrimaryColumn({ type: 'uuid' })
    id: string;

    @Column({ type: 'text', default: 'pending' })
    status: string; // 'pending' | 'accepted' | 'completed' | 'cancelled'

    @Column({ name: 'match_type', type: 'varchar', default: '1v1' })
    matchType: string;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'creator_id' })
    creator: User;

    @Column({ name: 'creator_id', type: 'text' })
    creatorId: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'opponent_id' })
    opponent: User;

    @Column({ name: 'opponent_id', type: 'text', nullable: true })
    opponentId: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'winner_id' })
    winner: User;

    @Column({ name: 'winner_id', type: 'text', nullable: true })
    winnerId: string;

    @ManyToOne(() => Court, (court) => court.matches, { nullable: true })
    @JoinColumn({ name: 'court_id' })
    court: Court;

    @Column({ name: 'court_id', type: 'uuid', nullable: true })
    courtId: string;

    @Column({ name: 'score_creator', type: 'int', nullable: true })
    scoreCreator: number;

    @Column({ name: 'score_opponent', type: 'int', nullable: true })
    scoreOpponent: number;

    @Column({ name: 'timer_start', type: 'timestamptz', nullable: true })
    timerStart: Date;

    @Column({ type: 'jsonb', nullable: true })
    score: any;

    @Column({ type: 'jsonb', nullable: true })
    result: any;

    @Column({ name: 'started_by', type: 'jsonb', default: '{}' })
    startedBy: any;

    @Column({ type: 'text', array: true, nullable: true })
    participants: string[];

    // Team match fields
    @Column({ name: 'team_match', type: 'boolean', default: false })
    teamMatch: boolean;

    @Column({ name: 'creator_team_id', type: 'uuid', nullable: true })
    creatorTeamId: string;

    @Column({ name: 'opponent_team_id', type: 'uuid', nullable: true })
    opponentTeamId: string;

    @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
    completedAt: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    // Legacy compatibility - map to old names for existing code
    get hostId(): string { return this.creatorId; }
    get guestId(): string | undefined { return this.opponentId; }
}

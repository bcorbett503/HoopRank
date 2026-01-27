import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Court } from '../courts/court.entity';

@Entity('matches')
export class Match {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ default: 'pending' })
    status: string; // 'pending' | 'accepted' | 'completed' | 'cancelled'

    @Column({ nullable: true })
    scheduledAt: Date;

    @Column('simple-json', { nullable: true })
    ratingDiff: Record<string, number>;

    @ManyToOne(() => User, (user) => user.hostedMatches, { nullable: true })
    host: User;

    @Column({ nullable: true })
    hostId: string;

    @ManyToOne(() => User, (user) => user.guestMatches, { nullable: true })
    guest: User;

    @Column({ nullable: true })
    guestId: string;

    @ManyToOne(() => User, { nullable: true })
    winner: User;

    @Column({ nullable: true })
    winnerId: string;

    @ManyToOne(() => Court, (court) => court.matches, { nullable: true })
    court: Court;

    @Column({ nullable: true })
    courtId: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

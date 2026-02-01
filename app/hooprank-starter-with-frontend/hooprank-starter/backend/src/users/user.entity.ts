import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { Match } from '../matches/match.entity';

/**
 * User entity mapped to production PostgreSQL schema.
 * Production uses snake_case columns and text type for id.
 */
@Entity('users')
export class User {
    @PrimaryColumn({ type: 'text' })
    id: string;

    @Column({ type: 'text', nullable: true })
    email: string;

    @Column({ type: 'text', nullable: true })
    username: string;

    @Column({ type: 'text' })
    name: string;

    @Column({ type: 'date', nullable: true })
    dob: Date;

    @Column({ name: 'avatar_url', type: 'text', nullable: true })
    avatarUrl: string;

    @Column({ name: 'hoop_rank', type: 'numeric', precision: 3, scale: 2, default: 3.0 })
    hoopRank: number;

    @Column({ type: 'numeric', precision: 3, scale: 2, default: 5.0 })
    reputation: number;

    @Column({ type: 'text', nullable: true })
    position: string;

    @Column({ type: 'text', nullable: true })
    height: string;

    @Column({ type: 'int', nullable: true })
    weight: number;

    @Column({ type: 'text', nullable: true })
    zip: string;

    @Column({ name: 'loc_enabled', type: 'boolean', default: false })
    locEnabled: boolean;

    @Column({ type: 'text', nullable: true })
    city: string;

    @Column({ name: 'games_played', type: 'int', nullable: true })
    gamesPlayed: number;

    @Column({ name: 'games_contested', type: 'int', nullable: true })
    gamesContested: number;

    @Column({ type: 'float', nullable: true })
    lat: number;

    @Column({ type: 'float', nullable: true })
    lng: number;

    @Column({ type: 'date', nullable: true })
    birthdate: Date;

    @Column({ name: 'fcm_token', type: 'text', nullable: true })
    fcmToken: string;

    @Column({ name: 'auth_token', type: 'text', nullable: true })
    authToken: string;

    @Column({ name: 'auth_provider', type: 'text', nullable: true })
    authProvider: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    // Relations
    @ManyToMany(() => User, (user) => user.friends)
    @JoinTable({
        name: 'friendships',
        joinColumn: { name: 'user_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'friend_id', referencedColumnName: 'id' }
    })
    friends: User[];

    @OneToMany(() => Match, (match) => match.creator)
    createdMatches: Match[];

    @OneToMany(() => Match, (match) => match.opponent)
    opponentMatches: Match[];
}

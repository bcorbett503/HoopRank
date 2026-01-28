import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Team entity for 3v3 and 5v5 teams
 */
@Entity('teams')
export class Team {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text' })
    name: string;

    @Column({ name: 'team_type', type: 'text' })
    teamType: string; // '3v3' or '5v5'

    @Column({ name: 'owner_id', type: 'text' })
    ownerId: string;

    @Column({ type: 'numeric', precision: 2, scale: 1, default: 3.0 })
    rating: number;

    @Column({ type: 'int', default: 0 })
    wins: number;

    @Column({ type: 'int', default: 0 })
    losses: number;

    @Column({ name: 'logo_url', type: 'text', nullable: true })
    logoUrl: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'owner_id' })
    owner: User;

    @OneToMany(() => TeamMember, (member) => member.team)
    members: TeamMember[];
}

/**
 * Team member junction table
 */
@Entity('team_members')
export class TeamMember {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'team_id', type: 'uuid' })
    teamId: string;

    @Column({ name: 'user_id', type: 'text' })
    userId: string;

    @Column({ type: 'text', default: 'pending' })
    status: string; // 'pending', 'active', 'declined'

    @Column({ type: 'text', default: 'member' })
    role: string; // 'owner', 'member'

    @CreateDateColumn({ name: 'joined_at' })
    joinedAt: Date;

    @ManyToOne(() => Team, (team) => team.members)
    @JoinColumn({ name: 'team_id' })
    team: Team;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;
}

/**
 * Team message for group chat
 */
@Entity('team_messages')
export class TeamMessage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'team_id', type: 'uuid' })
    teamId: string;

    @Column({ name: 'sender_id', type: 'text' })
    senderId: string;

    @Column({ type: 'text' })
    content: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ManyToOne(() => Team)
    @JoinColumn({ name: 'team_id' })
    team: Team;
}


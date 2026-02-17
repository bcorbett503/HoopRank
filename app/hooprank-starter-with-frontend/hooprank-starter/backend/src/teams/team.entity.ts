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

    @Column({ name: 'age_group', type: 'text', nullable: true })
    ageGroup: string; // 'U10', 'U12', 'U14', 'U18', 'HS', 'College', 'Open'

    @Column({ type: 'text', nullable: true })
    gender: string; // 'Mens', 'Womens', 'Coed'

    @Column({ name: 'skill_level', type: 'text', nullable: true })
    skillLevel: string; // 'Recreational', 'Competitive', 'Elite'

    @Column({ name: 'home_court_id', type: 'text', nullable: true })
    homeCourtId: string;

    @Column({ type: 'text', nullable: true })
    city: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ name: 'owner_id', type: 'text' })
    ownerId: string;

    @Column({ type: 'numeric', precision: 3, scale: 2, default: 3.0 })
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

    @Column({ name: 'image_url', type: 'text', nullable: true })
    imageUrl: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @ManyToOne(() => Team)
    @JoinColumn({ name: 'team_id' })
    team: Team;
}


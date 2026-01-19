import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToMany, JoinTable, OneToMany } from 'typeorm';
import { Match } from '../matches/match.entity';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    firebaseUid: string;

    @Column({ unique: true, nullable: true })
    email: string;

    @Column({ nullable: true })
    name: string;

    @Column({ nullable: true })
    photoUrl: string;

    // Profile fields
    @Column({ nullable: true })
    team: string;

    @Column({ nullable: true })
    position: string;

    @Column({ nullable: true })
    height: string;

    @Column({ nullable: true })
    weight: string;

    @Column({ nullable: true })
    age: number;

    // Stats (simplified for now)
    @Column('float', { default: 0 })
    rating: number;

    @Column('float', { default: 0 })
    offense: number;

    @Column('float', { default: 0 })
    defense: number;

    @Column('float', { default: 0 })
    shooting: number;

    @Column('float', { default: 0 })
    passing: number;

    @Column('float', { default: 0 })
    rebounding: number;

    @Column({ default: 0 })
    matchesPlayed: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Relations
    @ManyToMany(() => User, (user) => user.friends)
    @JoinTable()
    friends: User[];

    @OneToMany(() => Match, (match) => match.host)
    hostedMatches: Match[];

    @OneToMany(() => Match, (match) => match.guest)
    guestMatches: Match[];
}

import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('messages')
export class Message {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, { nullable: true })
    sender: User;

    @Column({ nullable: true })
    senderId: string;

    @ManyToOne(() => User, { nullable: true })
    receiver: User;

    @Column({ nullable: true })
    receiverId: string;

    @Column({ nullable: true })
    content: string;

    @Column({ nullable: true })
    matchId: string;

    @CreateDateColumn()
    createdAt: Date;
}

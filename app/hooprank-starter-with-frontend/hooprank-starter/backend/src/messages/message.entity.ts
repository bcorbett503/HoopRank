import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('messages')
export class Message {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User)
    sender: User;

    @Column()
    senderId: string;

    @ManyToOne(() => User)
    receiver: User;

    @Column()
    receiverId: string;

    @Column()
    content: string;

    @Column({ nullable: true })
    matchId: string;

    @CreateDateColumn()
    createdAt: Date;
}

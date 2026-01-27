import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('player_statuses')
export class PlayerStatus {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'user_id' })
    userId: number;

    @Column()
    content: string;

    @Column({ name: 'image_url', nullable: true })
    imageUrl: string;

    @Column({ name: 'scheduled_at', type: 'datetime', nullable: true })
    scheduledAt: Date;

    @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
}

@Entity('status_likes')
export class StatusLike {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'status_id' })
    statusId: number;

    @Column({ name: 'user_id' })
    userId: number;

    @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
}

@Entity('status_comments')
export class StatusComment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'status_id' })
    statusId: number;

    @Column({ name: 'user_id' })
    userId: number;

    @Column()
    content: string;

    @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
}

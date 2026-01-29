import { Entity, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';

// Note: We don't use @ManyToOne relations here to avoid enforcing FK constraints.
// User info is joined only in queries where needed, allowing flexibility for dev testing.

@Entity('player_statuses')
export class PlayerStatus {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'user_id' })
    userId: string;

    @Column()
    content: string;

    @Column({ name: 'image_url', type: 'varchar', nullable: true })
    imageUrl?: string;

    @Column({ name: 'scheduled_at', type: 'timestamp', nullable: true })
    scheduledAt?: Date;

    @Column({ name: 'court_id', type: 'varchar', length: 255, nullable: true })
    courtId?: string;

    @Column({ name: 'video_url', type: 'varchar', length: 500, nullable: true })
    videoUrl?: string;

    @Column({ name: 'video_thumbnail_url', type: 'varchar', length: 500, nullable: true })
    videoThumbnailUrl?: string;

    @Column({ name: 'video_duration_ms', type: 'integer', nullable: true })
    videoDurationMs?: number;

    @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
}

@Entity('status_likes')
@Unique(['statusId', 'userId'])
export class StatusLike {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'status_id' })
    @Index()
    statusId: number;

    @Column({ name: 'user_id' })
    userId: string;

    @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
}

@Entity('status_comments')
export class StatusComment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'status_id' })
    @Index()
    statusId: number;

    @Column({ name: 'user_id' })
    userId: string;

    @Column()
    content: string;

    @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
}

@Entity('event_attendees')
@Unique(['statusId', 'userId'])
export class EventAttendee {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'status_id' })
    @Index()
    statusId: number;

    @Column({ name: 'user_id' })
    userId: string;

    @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
}

// Follow tables for feed filtering
@Entity('user_followed_courts')
@Unique(['userId', 'courtId'])
export class UserFollowedCourt {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'user_id', type: 'varchar', length: 255 })
    userId: string;

    @Column({ name: 'court_id', type: 'varchar', length: 255 })
    courtId: string;

    @Column({ name: 'alerts_enabled', default: false })
    alertsEnabled: boolean;

    @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
}

@Entity('user_followed_players')
@Unique(['followerId', 'followedId'])
export class UserFollowedPlayer {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'follower_id', type: 'varchar', length: 255 })
    followerId: string;

    @Column({ name: 'followed_id', type: 'varchar', length: 255 })
    followedId: string;

    @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
}

@Entity('check_ins')
export class CheckIn {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'user_id' })
    userId: string;

    @Column({ name: 'court_id' })
    courtId: string;

    @Column({ name: 'checked_in_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    checkedInAt: Date;

    @Column({ name: 'checked_out_at', type: 'timestamp', nullable: true })
    checkedOutAt?: Date;
}

import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity('scheduled_runs')
export class ScheduledRun {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'court_id', type: 'varchar', length: 255 })
    courtId: string;

    @Column({ name: 'created_by', type: 'varchar', length: 255 })
    createdBy: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    title?: string;

    @Column({ name: 'game_mode', type: 'varchar', length: 20, default: "'5v5'" })
    gameMode: string;

    @Column({ name: 'court_type', type: 'varchar', length: 20, nullable: true })
    courtType?: string; // 'full' or 'half'

    @Column({ name: 'age_range', type: 'varchar', length: 20, nullable: true })
    ageRange?: string; // '18+', '21+', '30+', '40+', '50+', 'open'

    @Column({ name: 'scheduled_at', type: 'timestamp' })
    scheduledAt: Date;

    @Column({ name: 'duration_minutes', type: 'integer', default: 120 })
    durationMinutes: number;

    @Column({ name: 'max_players', type: 'integer', default: 10 })
    maxPlayers: number;

    @Column({ type: 'text', nullable: true })
    notes?: string;

    @Column({ name: 'tagged_player_ids', type: 'text', nullable: true })
    taggedPlayerIds?: string; // JSON array of player IDs

    @Column({ name: 'tag_mode', type: 'varchar', length: 20, nullable: true })
    tagMode?: string; // 'all', 'local', or 'individual'

    @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
}

@Entity('run_attendees')
@Unique(['runId', 'userId'])
export class RunAttendee {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'run_id', type: 'uuid' })
    runId: string;

    @Column({ name: 'user_id', type: 'varchar', length: 255 })
    userId: string;

    @Column({ type: 'varchar', length: 20, default: "'going'" })
    status: string;

    @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;
}

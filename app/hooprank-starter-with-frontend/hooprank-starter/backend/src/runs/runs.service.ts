import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class RunsService implements OnModuleInit {
    constructor(private dataSource: DataSource) { }

    async onModuleInit(): Promise<void> {
        // Best-effort schema bootstrap so scheduled runs features work in prod without manual migrations.
        await this.ensureTables();
    }

    // ========== Create ==========

    async createRun(userId: string, data: {
        courtId: string;
        scheduledAt: string;
        title?: string;
        gameMode?: string;
        courtType?: string;
        ageRange?: string;
        durationMinutes?: number;
        maxPlayers?: number;
        notes?: string;
        taggedPlayerIds?: string[];
        tagMode?: string;
    }): Promise<any> {
        const taggedJson = data.taggedPlayerIds && data.taggedPlayerIds.length > 0
            ? JSON.stringify(data.taggedPlayerIds)
            : null;

        const result = await this.dataSource.query(`
            INSERT INTO scheduled_runs (court_id, created_by, title, game_mode, court_type, age_range, scheduled_at, duration_minutes, max_players, notes, tagged_player_ids, tag_mode, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
            RETURNING *
        `, [
            data.courtId,
            userId,
            data.title || null,
            data.gameMode || '5v5',
            data.courtType || null,
            data.ageRange || null,
            new Date(data.scheduledAt),
            data.durationMinutes || 120,
            data.maxPlayers || 10,
            data.notes || null,
            taggedJson,
            data.tagMode || null,
        ]);

        const run = result[0];

        // Auto-join creator
        try {
            await this.joinRun(run.id, userId);
        } catch (e) {
            console.error('Failed to auto-join creator to run:', e.message);
        }

        return run;
    }

    // ========== Read ==========

    async getCourtRuns(courtId: string, userId?: string): Promise<any[]> {
        const now = new Date().toISOString();

        const runs = await this.dataSource.query(`
            SELECT 
                sr.id,
                sr.court_id as "courtId",
                c.name as "courtName",
                c.city as "courtCity",
                ST_Y(c.geog::geometry) as "courtLat",
                ST_X(c.geog::geometry) as "courtLng",
                sr.created_by as "createdBy",
                COALESCE(u.name, 'Unknown') as "creatorName",
                u.avatar_url as "creatorPhotoUrl",
                sr.title,
                sr.game_mode as "gameMode",
                sr.court_type as "courtType",
                sr.age_range as "ageRange",
                sr.scheduled_at as "scheduledAt",
                sr.duration_minutes as "durationMinutes",
                sr.max_players as "maxPlayers",
                sr.notes,
                sr.tagged_player_ids as "taggedPlayerIds",
                sr.tag_mode as "tagMode",
                sr.created_at as "createdAt",
                COALESCE((SELECT COUNT(*) FROM run_attendees WHERE run_id = sr.id), 0)::INTEGER as "attendeeCount",
                EXISTS(SELECT 1 FROM run_attendees WHERE run_id = sr.id AND user_id = $2) as "isAttending"
            FROM scheduled_runs sr
            LEFT JOIN courts c ON sr.court_id::TEXT = c.id::TEXT
            LEFT JOIN users u ON sr.created_by::TEXT = u.id::TEXT
            WHERE sr.court_id::TEXT = $1::TEXT
              AND sr.scheduled_at >= $3
            ORDER BY sr.scheduled_at ASC
        `, [courtId, userId || '', now]);

        // Attach attendees to each run
        for (const run of runs) {
            run.attendees = await this.getRunAttendees(run.id);
        }

        return runs;
    }

    async getRunAttendees(runId: string): Promise<any[]> {
        return this.dataSource.query(`
            SELECT 
                ra.user_id as "id",
                COALESCE(u.name, 'Unknown') as "name",
                u.avatar_url as "photoUrl"
            FROM run_attendees ra
            LEFT JOIN users u ON ra.user_id::TEXT = u.id::TEXT
            WHERE ra.run_id = $1
            ORDER BY ra.created_at ASC
        `, [runId]);
    }

    // ========== Capacity Check ==========

    async checkCapacity(runId: string): Promise<{ isFull: boolean; attendeeCount: number; maxPlayers: number } | null> {
        try {
            const result = await this.dataSource.query(`
                SELECT 
                    sr.max_players as "maxPlayers",
                    COALESCE((SELECT COUNT(*) FROM run_attendees WHERE run_id = sr.id), 0)::INTEGER as "attendeeCount"
                FROM scheduled_runs sr
                WHERE sr.id = $1
            `, [runId]);
            if (result.length === 0) return null;
            const { maxPlayers, attendeeCount } = result[0];
            return { isFull: attendeeCount >= maxPlayers, attendeeCount, maxPlayers };
        } catch (e) {
            console.error('checkCapacity error:', e.message);
            return null;
        }
    }

    // ========== Join / Leave ==========

    async joinRun(runId: string, userId: string): Promise<void> {
        try {
            await this.dataSource.query(`
                INSERT INTO run_attendees (run_id, user_id, status, created_at)
                VALUES ($1, $2, 'going', NOW())
            `, [runId, userId]);
        } catch (error: any) {
            // Ignore duplicate key errors
            if (error.code !== '23505' && !error.message?.includes('UNIQUE')) {
                throw error;
            }
        }
    }

    async leaveRun(runId: string, userId: string): Promise<void> {
        await this.dataSource.query(`
            DELETE FROM run_attendees WHERE run_id = $1 AND user_id = $2
        `, [runId, userId]);
    }

    // ========== Cancel ==========

    async cancelRun(runId: string, userId: string): Promise<boolean> {
        // Only the creator can cancel
        const result = await this.dataSource.query(`
            DELETE FROM scheduled_runs WHERE id = $1 AND created_by = $2 RETURNING id
        `, [runId, userId]);

        // TypeORM raw query for DELETE RETURNING may return [rows, count] or just rows
        const rows = Array.isArray(result[0]) ? result[0] : result;
        const deleted = Array.isArray(rows) && rows.length > 0 && rows[0]?.id;

        if (deleted) {
            // Clean up attendees
            await this.dataSource.query(`DELETE FROM run_attendees WHERE run_id = $1`, [runId]);
            return true;
        }
        return false;
    }

    // ========== Discovery ==========

    async getCourtsWithRuns(todayOnly: boolean = false): Promise<{ courtId: string }[]> {
        const now = new Date();

        let query: string;
        let params: any[];

        if (todayOnly) {
            const endOfDay = new Date(now);
            endOfDay.setHours(23, 59, 59, 999);

            query = `
                SELECT DISTINCT court_id as "courtId"
                FROM scheduled_runs
                WHERE scheduled_at >= $1 AND scheduled_at <= $2
            `;
            params = [now.toISOString(), endOfDay.toISOString()];
        } else {
            query = `
                SELECT DISTINCT court_id as "courtId"
                FROM scheduled_runs
                WHERE scheduled_at >= $1
            `;
            params = [now.toISOString()];
        }

        try {
            return await this.dataSource.query(query, params) || [];
        } catch (error) {
            console.error('RunsService.getCourtsWithRuns error:', error.message);
            return [];
        }
    }

    // ========== Migration ==========

    async ensureTables(): Promise<string> {
        try {
            await this.dataSource.query(`
                CREATE TABLE IF NOT EXISTS scheduled_runs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    court_id VARCHAR(255) NOT NULL,
                    created_by VARCHAR(255) NOT NULL,
                    title VARCHAR(255),
                    game_mode VARCHAR(20) DEFAULT '5v5',
                    court_type VARCHAR(20),
                    age_range VARCHAR(20),
                    scheduled_at TIMESTAMP NOT NULL,
                    status_id INTEGER,
                    duration_minutes INTEGER DEFAULT 120,
                    max_players INTEGER DEFAULT 10,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Add columns that may not exist on older tables
            const newColumns = [
                { name: 'title', type: "VARCHAR(255)" },
                { name: 'game_mode', type: "VARCHAR(20) DEFAULT '5v5'" },
                { name: 'court_type', type: "VARCHAR(20)" },
                { name: 'age_range', type: "VARCHAR(20)" },
                { name: 'status_id', type: "INTEGER" },
                { name: 'duration_minutes', type: "INTEGER DEFAULT 120" },
                { name: 'max_players', type: "INTEGER DEFAULT 10" },
                { name: 'notes', type: "TEXT" },
                { name: 'tagged_player_ids', type: "TEXT" },
                { name: 'tag_mode', type: "VARCHAR(20)" },
            ];
            for (const col of newColumns) {
                try {
                    await this.dataSource.query(`ALTER TABLE scheduled_runs ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
                } catch (e) {
                    // Column already exists - ignore
                }
            }

            // Drop any FK constraints TypeORM may have auto-created
            const fksToDrop = ['scheduled_runs_created_by_fkey', 'scheduled_runs_court_id_fkey'];
            for (const fk of fksToDrop) {
                try {
                    await this.dataSource.query(`ALTER TABLE scheduled_runs DROP CONSTRAINT IF EXISTS "${fk}"`);
                } catch (e) {
                    // Constraint doesn't exist - ignore
                }
            }

            await this.dataSource.query(`
                CREATE TABLE IF NOT EXISTS run_attendees (
                    id SERIAL PRIMARY KEY,
                    run_id UUID NOT NULL,
                    user_id VARCHAR(255) NOT NULL,
                    status VARCHAR(20) DEFAULT 'going',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(run_id, user_id)
                )
            `);

            // Migrate any existing scheduled runs from player_statuses
            const existing = await this.dataSource.query(`
                SELECT COUNT(*) as count FROM scheduled_runs
            `);

            if (parseInt(existing[0].count) === 0) {
                // Check if there are statuses with scheduled_at to migrate
                const statusRuns = await this.dataSource.query(`
                    SELECT ps.id, ps.court_id, ps.user_id, ps.content, ps.scheduled_at, ps.created_at
                    FROM player_statuses ps
                    WHERE ps.scheduled_at IS NOT NULL AND ps.court_id IS NOT NULL AND ps.scheduled_at >= NOW()
                `);

                for (const sr of statusRuns) {
                    await this.dataSource.query(`
                        INSERT INTO scheduled_runs (court_id, created_by, title, game_mode, scheduled_at, created_at)
                        VALUES ($1, $2, $3, '5v5', $4, $5)
                        ON CONFLICT DO NOTHING
                    `, [sr.court_id, sr.user_id, sr.content, sr.scheduled_at, sr.created_at]);
                }

                return `Tables created. Migrated ${statusRuns.length} existing runs from player_statuses.`;
            }

            return 'Tables already exist.';
        } catch (error) {
            console.error('ensureTables error:', error.message);
            return `Error: ${error.message}`;
        }
    }
}

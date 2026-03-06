import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class RunsService {
    private readonly logger = new Logger(RunsService.name);
    private statusIdColumnEnsured = false;

    constructor(private dataSource: DataSource) { }

    private async ensureStatusIdColumn(): Promise<void> {
        if (this.statusIdColumnEnsured) return;
        try {
            await this.dataSource.query(`ALTER TABLE scheduled_runs ADD COLUMN IF NOT EXISTS status_id INTEGER`);
        } catch (error: any) {
            this.logger.warn(`Could not ensure scheduled_runs.status_id column: ${error.message}`);
        } finally {
            this.statusIdColumnEnsured = true;
        }
    }

    private async attachStatusIdToRun(runId: string, statusId?: number | null): Promise<void> {
        if (!runId || !statusId) return;
        await this.ensureStatusIdColumn();
        try {
            await this.dataSource.query(`UPDATE scheduled_runs SET status_id = $1 WHERE id = $2`, [statusId, runId]);
        } catch (error: any) {
            this.logger.warn(`Failed to attach status_id=${statusId} to run ${runId}: ${error.message}`);
        }
    }

    private async recurringStatusExists(statusId?: number | null): Promise<boolean> {
        if (!statusId) return false;
        try {
            const result = await this.dataSource.query(
                `SELECT 1 FROM player_statuses WHERE id = $1 LIMIT 1`,
                [statusId],
            );
            return Array.isArray(result) && result.length > 0;
        } catch (error: any) {
            this.logger.warn(`Failed to verify recurring status ${statusId}: ${error.message}`);
            return false;
        }
    }

    private async createFeedStatusForRecurringTemplate(
        userId: string,
        data: {
            title?: string | null;
            scheduledAt: Date;
            courtId: string;
            gameMode: string;
            courtType?: string | null;
            ageRange?: string | null;
        },
    ): Promise<number | null> {
        try {
            const result = await this.dataSource.query(`
                INSERT INTO player_statuses (user_id, content, scheduled_at, court_id, game_mode, court_type, age_range, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                RETURNING id
            `, [
                userId,
                data.title || 'HoopRank Scheduled Run',
                data.scheduledAt,
                data.courtId,
                data.gameMode,
                data.courtType || null,
                data.ageRange || null,
            ]);
            return result?.[0]?.id ?? null;
        } catch (error: any) {
            this.logger.warn(`Failed to create feed status for recurring run: ${error.message}`);
            return null;
        }
    }

    private buildTemplateSignature(template: any): string {
        const dt = new Date(template.scheduled_at);
        return [
            template.court_id || '',
            template.title || '',
            dt.getUTCDay(),
            dt.getUTCHours(),
            dt.getUTCMinutes(),
        ].join('|');
    }

    private async ensureRecurringTemplateStatus(template: {
        id: string;
        status_id?: number | null;
        created_by: string;
        title?: string | null;
        scheduled_at: Date | string;
        court_id: string;
        game_mode?: string | null;
        court_type?: string | null;
        age_range?: string | null;
    }): Promise<number | null> {
        const existingStatusId = template.status_id ?? null;
        if (await this.recurringStatusExists(existingStatusId)) {
            return existingStatusId;
        }

        if (existingStatusId) {
            this.logger.warn(`Recurring template ${template.id} has dangling status_id=${existingStatusId}; recreating.`);
        }

        const scheduledAt = new Date(template.scheduled_at);
        const statusId = await this.createFeedStatusForRecurringTemplate(template.created_by, {
            title: template.title,
            scheduledAt,
            courtId: template.court_id,
            gameMode: template.game_mode || '5v5',
            courtType: template.court_type || null,
            ageRange: template.age_range || null,
        });

        if (statusId) {
            await this.attachStatusIdToRun(template.id, statusId);
        }

        return statusId;
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
        isRecurring?: boolean;
    }): Promise<any> {
        const scheduledAt = new Date(data.scheduledAt);
        const taggedJson = data.taggedPlayerIds && data.taggedPlayerIds.length > 0
            ? JSON.stringify(data.taggedPlayerIds)
            : null;

        const isRecur = data.isRecurring ? true : false;
        const recurRule = isRecur ? 'weekly' : null;
        const title = data.title || null;
        const gameMode = data.gameMode || '5v5';
        const courtType = data.courtType || null;
        const ageRange = data.ageRange || null;
        const durationMinutes = data.durationMinutes || 120;
        const maxPlayers = data.maxPlayers || 10;
        const notes = data.notes || null;
        const tagMode = data.tagMode || null;

        if (isRecur) {
            const existingTemplates = await this.dataSource.query(`
                SELECT *
                FROM scheduled_runs
                WHERE is_recurring = true
                  AND recurrence_rule = 'weekly'
                  AND court_id = $1
                  AND COALESCE(title, '') = COALESCE($2, '')
                  AND EXTRACT(DOW FROM scheduled_at AT TIME ZONE 'UTC') = EXTRACT(DOW FROM $3::timestamptz AT TIME ZONE 'UTC')
                  AND EXTRACT(HOUR FROM scheduled_at AT TIME ZONE 'UTC') = EXTRACT(HOUR FROM $3::timestamptz AT TIME ZONE 'UTC')
                  AND EXTRACT(MINUTE FROM scheduled_at AT TIME ZONE 'UTC') = EXTRACT(MINUTE FROM $3::timestamptz AT TIME ZONE 'UTC')
                ORDER BY created_at ASC
            `, [
                data.courtId,
                title,
                scheduledAt,
            ]);

            if (existingTemplates.length > 0) {
                const existing = existingTemplates[0];
                const duplicateTemplates = existingTemplates.slice(1);

                // Hard-enforce a single template row per event signature.
                for (const dup of duplicateTemplates) {
                    try {
                        await this.dataSource.query(`DELETE FROM run_attendees WHERE run_id = $1`, [dup.id]);
                        await this.dataSource.query(`DELETE FROM scheduled_runs WHERE id = $1`, [dup.id]);
                    } catch (error: any) {
                        this.logger.warn(`Failed to delete duplicate recurring template ${dup.id}: ${error.message}`);
                    }
                }
                if (duplicateTemplates.length > 0) {
                    this.logger.log(`Deduped ${duplicateTemplates.length} recurring template(s) for ${title || 'Untitled Run'}`);
                }

                const updated = await this.dataSource.query(`
                    UPDATE scheduled_runs
                    SET created_by = $1,
                        game_mode = $2,
                        court_type = $3,
                        age_range = $4,
                        duration_minutes = $5,
                        max_players = $6,
                        notes = $7,
                        tagged_player_ids = $8,
                        tag_mode = $9
                    WHERE id = $10
                    RETURNING *
                `, [
                    userId,
                    gameMode,
                    courtType,
                    ageRange,
                    durationMinutes,
                    maxPlayers,
                    notes,
                    taggedJson,
                    tagMode,
                    existing.id,
                ]);

                const statusId = await this.ensureRecurringTemplateStatus({
                    id: existing.id,
                    status_id: existing.status_id,
                    created_by: userId,
                    title,
                    scheduled_at: existing.scheduled_at || scheduledAt,
                    court_id: data.courtId,
                    game_mode: gameMode,
                    court_type: courtType,
                    age_range: ageRange,
                });
                if (statusId && updated?.[0]) {
                    updated[0].status_id = statusId;
                }

                return updated?.[0] || existing;
            }
        }

        let statusId: number | null = null;
        if (isRecur) {
            statusId = await this.createFeedStatusForRecurringTemplate(userId, {
                title,
                scheduledAt,
                courtId: data.courtId,
                gameMode,
                courtType,
                ageRange,
            });
        }

        const result = await this.dataSource.query(`
            INSERT INTO scheduled_runs (court_id, created_by, title, game_mode, court_type, age_range, scheduled_at, duration_minutes, max_players, notes, tagged_player_ids, tag_mode, is_recurring, recurrence_rule, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
            RETURNING *
        `, [
            data.courtId,
            userId,
            title,
            gameMode,
            courtType,
            ageRange,
            scheduledAt,
            durationMinutes,
            maxPlayers,
            notes,
            taggedJson,
            tagMode,
            isRecur,
            recurRule
        ]);

        const run = result[0];

        if (isRecur && run?.id && statusId) {
            await this.attachStatusIdToRun(run.id, statusId);
        }

        // Auto-join creator for concrete one-off runs only.
        if (!isRecur) {
            try {
                await this.joinRun(run.id, userId);
            } catch (e) {
                console.error('Failed to auto-join creator to run:', e.message);
            }
        }

        return run;
    }

    // ========== Read ==========

    async getCourtRuns(courtId: string, userId?: string): Promise<any[]> {
        const now = new Date().toISOString();

        const runs = await this.dataSource.query(`
            SELECT * FROM (
                SELECT DISTINCT ON (
                    sr.court_id,
                    EXTRACT(DOW FROM sr.scheduled_at AT TIME ZONE 'UTC'),
                    EXTRACT(HOUR FROM sr.scheduled_at AT TIME ZONE 'UTC'),
                    EXTRACT(MINUTE FROM sr.scheduled_at AT TIME ZONE 'UTC')
                )
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
                    sr.is_recurring as "isRecurring",
                    sr.recurrence_rule as "recurrenceRule",
                    COALESCE((SELECT COUNT(*) FROM run_attendees WHERE run_id = sr.id), 0)::INTEGER as "attendeeCount",
                    EXISTS(SELECT 1 FROM run_attendees WHERE run_id = sr.id AND user_id = $2) as "isAttending"
                FROM scheduled_runs sr
                LEFT JOIN courts c ON sr.court_id::TEXT = c.id::TEXT
                LEFT JOIN users u ON sr.created_by::TEXT = u.id::TEXT
                WHERE sr.court_id::TEXT = $1::TEXT
                  AND (
                     sr.is_recurring = true 
                     OR 
                     sr.scheduled_at >= $3
                  )
                ORDER BY 
                    sr.court_id,
                    EXTRACT(DOW FROM sr.scheduled_at AT TIME ZONE 'UTC'),
                    EXTRACT(HOUR FROM sr.scheduled_at AT TIME ZONE 'UTC'),
                    EXTRACT(MINUTE FROM sr.scheduled_at AT TIME ZONE 'UTC'),
                    sr.is_recurring DESC,
                    sr.scheduled_at ASC
            ) deduped
            ORDER BY deduped."scheduledAt" ASC
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

    // ========== CRON SPANWER: True Recurring Runs ==========
    // Runs every hour to find active templates and spawn the physical run 48 hrs out
    @Cron(CronExpression.EVERY_HOUR)
    async spawnUpcomingRecurringRuns() {
        this.logger.log('CRON: Checking for upcoming recurring runs to spawn...');

        try {
            // 1) Find all "template" runs
            // A template is a run where is_recurring = true
            // We only look at templates whose 'scheduled_at' is in the past, meaning the FIRST instance already happened
            // or is about to happen, making it a true template. 
            // We use the original scheduled_at to derive the DAY OF WEEK and TIME.
            const templatesRaw = await this.dataSource.query(`
                SELECT 
                    id, court_id, created_by, title, game_mode, court_type, 
                    age_range, duration_minutes, max_players, notes, 
                    tagged_player_ids, tag_mode, recurrence_rule, scheduled_at, status_id, created_at
                FROM scheduled_runs 
                WHERE is_recurring = true AND recurrence_rule = 'weekly'
            `);

            if (templatesRaw.length === 0) return;

            // Defensive dedupe: if legacy duplicate templates exist, only process one per true event signature.
            const templateMap = new Map<string, any>();
            for (const template of templatesRaw) {
                const key = this.buildTemplateSignature(template);
                const current = templateMap.get(key);
                if (!current) {
                    templateMap.set(key, template);
                    continue;
                }

                const currentHasStatus = current.status_id !== null && current.status_id !== undefined;
                const nextHasStatus = template.status_id !== null && template.status_id !== undefined;
                if (!currentHasStatus && nextHasStatus) {
                    templateMap.set(key, template);
                    continue;
                }

                const currentCreatedAt = current.created_at ? new Date(current.created_at).getTime() : Number.MAX_SAFE_INTEGER;
                const nextCreatedAt = template.created_at ? new Date(template.created_at).getTime() : Number.MAX_SAFE_INTEGER;
                if (nextCreatedAt < currentCreatedAt) {
                    templateMap.set(key, template);
                }
            }

            const templates = Array.from(templateMap.values());

            // Target window: any run that should occur between NOW and +48 hours
            const now = new Date();
            const windowEnd = new Date(now.getTime() + (48 * 60 * 60 * 1000));

            let spawnedCount = 0;

            for (const template of templates) {
                const originalDate = new Date(template.scheduled_at);
                const targetDayOfWeek = originalDate.getUTCDay();
                const targetHours = originalDate.getUTCHours();
                const targetMinutes = originalDate.getUTCMinutes();
                const templateStatusId = await this.ensureRecurringTemplateStatus({
                    id: template.id,
                    status_id: template.status_id ?? null,
                    created_by: template.created_by,
                    title: template.title,
                    scheduled_at: template.scheduled_at,
                    court_id: template.court_id,
                    game_mode: template.game_mode || '5v5',
                    court_type: template.court_type,
                    age_range: template.age_range,
                });
                if (templateStatusId) {
                    template.status_id = templateStatusId;
                }

                if (templateStatusId) {
                    try {
                        // Backfill future concrete instances that were spawned without status linkage.
                        await this.dataSource.query(`
                            UPDATE scheduled_runs
                            SET status_id = $1
                            WHERE status_id IS NULL
                              AND is_recurring = false
                              AND court_id = $2
                              AND COALESCE(title, '') = COALESCE($3, '')
                              AND created_by = $4
                              AND scheduled_at >= NOW()
                              AND EXTRACT(DOW FROM scheduled_at AT TIME ZONE 'UTC') = $5
                              AND EXTRACT(HOUR FROM scheduled_at AT TIME ZONE 'UTC') = $6
                              AND EXTRACT(MINUTE FROM scheduled_at AT TIME ZONE 'UTC') = $7
                        `, [
                            templateStatusId,
                            template.court_id,
                            template.title,
                            template.created_by,
                            targetDayOfWeek,
                            targetHours,
                            targetMinutes,
                        ]);
                    } catch (error: any) {
                        this.logger.warn(`CRON: Failed status_id backfill for template ${template.id}: ${error.message}`);
                    }
                }

                // Calculate the specific date this week that matches the template's day/time
                // Crucial fix: Construct the clone using strictly UTC accessors
                const upcomingInstance = new Date();
                upcomingInstance.setUTCHours(targetHours, targetMinutes, 0, 0);

                // Shift to the correct day of the current week (Sunday = 0)
                const currentDay = upcomingInstance.getUTCDay();
                const distance = (targetDayOfWeek + 7 - currentDay) % 7;
                upcomingInstance.setUTCDate(upcomingInstance.getUTCDate() + distance);

                // If 'upcomingInstance' is strictly inside our [NOW ... NOW + 48h] window
                if (upcomingInstance > now && upcomingInstance <= windowEnd) {

                    // 2) Check if we already spawned this exact instance to avoid duplicates
                    const existingCheck = await this.dataSource.query(`
                        SELECT id FROM scheduled_runs 
                        WHERE court_id = $1 AND title = $2 AND scheduled_at = $3 AND is_recurring = false
                    `, [template.court_id, template.title, upcomingInstance]);

                    if (existingCheck.length === 0) {
                        // 3) Spawn the physical instance for the feed!
                        // Notice: is_recurring = false, because this is a concrete instance of the template
                        const insertResult = await this.dataSource.query(`
                            INSERT INTO scheduled_runs (
                                court_id, created_by, title, game_mode, court_type, 
                                age_range, duration_minutes, max_players, notes, 
                                tagged_player_ids, tag_mode, scheduled_at, is_recurring, created_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, NOW())
                            RETURNING id
                        `, [
                            template.court_id, template.created_by, template.title, template.game_mode, template.court_type,
                            template.age_range, template.duration_minutes, template.max_players, template.notes,
                            template.tagged_player_ids, template.tag_mode, upcomingInstance
                        ]);

                        const spawnedId = insertResult?.[0]?.id;
                        if (spawnedId && templateStatusId) {
                            await this.attachStatusIdToRun(spawnedId, templateStatusId);
                        }

                        spawnedCount++;
                        this.logger.log(`CRON: Spawned recurring instance: "${template.title}" at ${upcomingInstance.toISOString()}`);
                    }
                }
            }

            if (spawnedCount > 0) {
                this.logger.log(`CRON: Successfully spawned ${spawnedCount} recurring run instances.`);
            }

        } catch (error) {
            this.logger.error('CRON Error spawning recurring runs:', error.message);
        }
    }

}

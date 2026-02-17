import { Controller, Get, Post, Delete, Body, Param, Headers, Query } from '@nestjs/common';
import { RunsService } from './runs.service';

@Controller()
export class RunsController {
    constructor(private readonly runsService: RunsService) { }

    // ========== /runs endpoints ==========

    // Create a new scheduled run
    @Post('runs')
    async createRun(
        @Headers('x-user-id') userId: string,
        @Body() body: {
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
        },
    ) {
        if (!userId) {
            return { success: false, error: 'User ID required' };
        }
        const run = await this.runsService.createRun(userId, body);
        return { success: true, id: run.id, run };
    }

    // Get nearby scheduled runs (for mobile app calling /runs/nearby)
    @Get('runs/nearby')
    async getNearbyRuns(
        @Headers('x-user-id') userId: string,
        @Query('lat') lat?: string,
        @Query('lng') lng?: string,
        @Query('radius') radius?: string,
    ) {
        // Return all upcoming runs — location filtering can be refined later
        try {
            const now = new Date().toISOString();
            const runs = await this.runsService['dataSource'].query(`
                SELECT 
                    sr.id,
                    sr.court_id as "courtId",
                    c.name as "courtName",
                    c.city as "courtCity",
                    sr.created_by as "createdBy",
                    COALESCE(u.name, 'Unknown') as "creatorName",
                    sr.title,
                    sr.game_mode as "gameMode",
                    sr.scheduled_at as "scheduledAt",
                    sr.duration_minutes as "durationMinutes",
                    sr.max_players as "maxPlayers",
                    sr.notes,
                    COALESCE((SELECT COUNT(*) FROM run_attendees WHERE run_id = sr.id), 0)::INTEGER as "attendeeCount"
                FROM scheduled_runs sr
                LEFT JOIN courts c ON sr.court_id::TEXT = c.id::TEXT
                LEFT JOIN users u ON sr.created_by::TEXT = u.id::TEXT
                WHERE sr.scheduled_at >= $1
                ORDER BY sr.scheduled_at ASC
                LIMIT 50
            `, [now]);
            return runs;
        } catch (error) {
            console.error('getNearbyRuns error:', error.message);
            return [];
        }
    }

    // Get courts with runs (alias for mobile path /runs/courts)
    @Get('runs/courts')
    async getCourtsWithRunsAlias(
        @Query('today') today?: string,
    ) {
        const todayOnly = today === 'true';
        return this.runsService.getCourtsWithRuns(todayOnly);
    }

    // Get courts that have upcoming scheduled runs
    @Get('runs/courts-with-runs')
    async getCourtsWithRuns(
        @Query('today') today?: string,
    ) {
        const todayOnly = today === 'true';
        return this.runsService.getCourtsWithRuns(todayOnly);
    }

    // Join a run
    @Post('runs/:id/join')
    async joinRun(
        @Param('id') runId: string,
        @Headers('x-user-id') userId: string,
    ) {
        if (!userId) {
            return { success: false, error: 'User ID required' };
        }
        // Enforce RSVP cap
        const capacityCheck = await this.runsService.checkCapacity(runId);
        if (capacityCheck && capacityCheck.isFull) {
            return { success: false, error: 'Run is full', isFull: true };
        }
        await this.runsService.joinRun(runId, userId);
        return { success: true };
    }

    // Leave a run
    @Delete('runs/:id/leave')
    async leaveRun(
        @Param('id') runId: string,
        @Headers('x-user-id') userId: string,
    ) {
        if (!userId) {
            return { success: false, error: 'User ID required' };
        }
        await this.runsService.leaveRun(runId, userId);
        return { success: true };
    }

    // Cancel a run (creator only)
    @Delete('runs/:id')
    async cancelRun(
        @Param('id') runId: string,
        @Headers('x-user-id') userId: string,
    ) {
        if (!userId) {
            return { success: false, error: 'User ID required' };
        }
        const deleted = await this.runsService.cancelRun(runId, userId);
        return { success: deleted };
    }


    // ========== /courts/:id/runs endpoint ==========
    // The mobile app calls GET /courts/:id/runs

    @Get('courts/:courtId/runs')
    async getCourtRuns(
        @Param('courtId') courtId: string,
        @Headers('x-user-id') userId: string,
    ) {
        return this.runsService.getCourtRuns(courtId, userId);
    }
}

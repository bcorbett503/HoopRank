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
        },
    ) {
        if (!userId) {
            return { success: false, error: 'User ID required' };
        }
        const run = await this.runsService.createRun(userId, body);
        return { success: true, id: run.id, run };
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

    // Migration endpoint to create tables
    @Post('runs/migrate')
    async migrate() {
        return this.runsService.ensureTables();
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

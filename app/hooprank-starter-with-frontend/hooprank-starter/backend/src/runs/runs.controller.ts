import { Controller, Get, Query, Headers } from '@nestjs/common';
import { RunsService } from './runs.service';

@Controller('runs')
export class RunsController {
    constructor(private readonly runsService: RunsService) { }

    // Get courts that have upcoming scheduled runs
    // If today=true, only returns courts with runs scheduled for today
    @Get('courts-with-runs')
    async getCourtsWithRuns(
        @Query('today') today?: string,
    ) {
        const todayOnly = today === 'true';
        return this.runsService.getCourtsWithRuns(todayOnly);
    }

    // Get nearby runs (placeholder for future implementation)
    @Get('nearby')
    async getNearbyRuns(
        @Headers('x-user-id') userId: string,
        @Query('radiusMiles') radiusMiles?: string,
    ) {
        // TODO: Implement location-based run discovery
        return [];
    }
}

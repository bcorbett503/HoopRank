import { Controller, Get, Query, Headers } from '@nestjs/common';
import { ActivityService } from './activity.service';

@Controller('activity')
export class ActivityController {
    constructor(private readonly activityService: ActivityService) { }

    @Get('global')
    async getGlobalActivity(
        @Query('limit') limit: string = '10',
        @Headers('x-user-id') userId: string,
    ) {
        return this.activityService.getGlobalActivity(parseInt(limit) || 10);
    }

    @Get('local')
    async getLocalActivity(
        @Query('limit') limit: string = '20',
        @Query('radiusMiles') radiusMiles: string = '25',
        @Headers('x-user-id') userId: string,
    ) {
        if (!userId) return [];
        return this.activityService.getLocalActivity(userId, parseInt(limit) || 20, parseInt(radiusMiles) || 25);
    }
}

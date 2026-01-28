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
}

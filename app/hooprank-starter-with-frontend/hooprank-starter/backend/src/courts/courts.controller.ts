import { Controller, Get, Post, Param, Headers } from '@nestjs/common';
import { CourtsService } from './courts.service';
import { Court } from './court.entity';

@Controller('courts')
export class CourtsController {
    constructor(private readonly courtsService: CourtsService) { }

    @Get()
    async findAll(): Promise<Court[]> {
        return this.courtsService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: string): Promise<Court | undefined> {
        return this.courtsService.findById(id);
    }

    @Get(':id/activity')
    async getActivity(@Param('id') id: string) {
        return this.courtsService.getCourtActivity(id);
    }

    @Get(':id/check-ins')
    async getActiveCheckIns(@Param('id') id: string) {
        return this.courtsService.getActiveCheckIns(id);
    }

    @Post(':id/check-in')
    async checkIn(
        @Param('id') courtId: string,
        @Headers('x-user-id') userId: string,
    ) {
        if (!userId) {
            return { success: false, error: 'User ID required' };
        }
        const checkIn = await this.courtsService.checkIn(userId, courtId);
        return { success: true, checkIn };
    }

    @Post(':id/check-out')
    async checkOut(
        @Param('id') courtId: string,
        @Headers('x-user-id') userId: string,
    ) {
        if (!userId) {
            return { success: false, error: 'User ID required' };
        }
        await this.courtsService.checkOut(userId, courtId);
        return { success: true };
    }
}

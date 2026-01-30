import { Controller, Get, Post, Param, Headers, Query, BadRequestException } from '@nestjs/common';
import { CourtsService } from './courts.service';
import { Court } from './court.entity';

@Controller('courts')
export class CourtsController {
    constructor(private readonly courtsService: CourtsService) { }

    @Get()
    async findAll(
        @Query('minLat') minLat?: string,
        @Query('maxLat') maxLat?: string,
        @Query('minLng') minLng?: string,
        @Query('maxLng') maxLng?: string,
    ): Promise<Court[]> {
        // If bbox parameters provided, use geographic search
        if (minLat && maxLat && minLng && maxLng) {
            return this.courtsService.searchByLocation(
                parseFloat(minLat),
                parseFloat(maxLat),
                parseFloat(minLng),
                parseFloat(maxLng)
            );
        }
        // Otherwise return all courts
        return this.courtsService.findAll();
    }

    @Post('admin/create')
    async createCourt(
        @Headers('x-user-id') userId: string,
        @Query('id') id: string,
        @Query('name') name: string,
        @Query('city') city: string,
        @Query('lat') lat: string,
        @Query('lng') lng: string,
        @Query('indoor') indoor?: string,
        @Query('rims') rims?: string,
    ) {
        return this.courtsService.createCourt({
            id,
            name,
            city,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            indoor: indoor === 'true',
            rims: rims ? parseInt(rims) : 2,
        });
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

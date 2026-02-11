import { Controller, Get, Post, Delete, Param, Headers, Query, BadRequestException } from '@nestjs/common';
import { CourtsService } from './courts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Court } from './court.entity';
import { DataSource } from 'typeorm';

@Controller('courts')
export class CourtsController {
    constructor(
        private readonly courtsService: CourtsService,
        private readonly notificationsService: NotificationsService,
        private readonly dataSource: DataSource,
    ) { }

    @Post('admin/migrate')
    async runMigrations(
        @Headers('x-user-id') userId: string,
    ) {
        const results: string[] = [];
        try {
            await this.dataSource.query(`ALTER TABLE courts ADD COLUMN IF NOT EXISTS venue_type TEXT`);
            results.push('venue_type column ensured');
        } catch (e) {
            results.push(`venue_type: ${e.message}`);
        }
        return { success: true, migrations: results };
    }

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
        @Query('access') access?: string,
        @Query('venue_type') venue_type?: string,
    ) {
        return this.courtsService.createCourt({
            id,
            name,
            city,
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            indoor: indoor === 'true',
            rims: rims ? parseInt(rims) : 2,
            access: access || 'public',
            venue_type: venue_type || undefined,
        });
    }

    @Post('admin/delete')
    async deleteCourt(
        @Headers('x-user-id') userId: string,
        @Query('name') name: string,
        @Query('city') city: string,
    ) {
        const result = await this.dataSource.query(
            `DELETE FROM courts WHERE name = $1 AND city = $2 RETURNING id, name`,
            [name, city]
        );
        return { success: true, deleted: result.length, courts: result };
    }

    @Post('admin/update-source')
    async updateSource(
        @Headers('x-user-id') userId: string,
        @Query('source') source: string,
        @Query('indoor') indoor?: string,
        @Query('state') state?: string,
    ) {
        let query = `UPDATE courts SET source = $1 WHERE 1=1`;
        const params: any[] = [source];
        let idx = 2;

        if (indoor !== undefined) {
            query += ` AND indoor = $${idx}`;
            params.push(indoor === 'true');
            idx++;
        }
        if (state) {
            query += ` AND city LIKE $${idx}`;
            params.push(`%, ${state}`);
            idx++;
        }

        const result = await this.dataSource.query(query + ' RETURNING id', params);
        return { success: true, updated: result.length, source };
    }

    @Post('admin/update-venue-type')
    async updateVenueType(
        @Headers('x-user-id') userId: string,
        @Query('venue_type') venue_type: string,
        @Query('name_pattern') name_pattern?: string,
        @Query('indoor') indoor?: string,
        @Query('current_venue_type') current_venue_type?: string,
    ) {
        let query = `UPDATE courts SET venue_type = $1 WHERE 1=1`;
        const params: any[] = [venue_type];
        let idx = 2;

        if (name_pattern) {
            query += ` AND name ILIKE $${idx}`;
            params.push(name_pattern);
            idx++;
        }
        if (indoor !== undefined) {
            query += ` AND indoor = $${idx}`;
            params.push(indoor === 'true');
            idx++;
        }
        if (current_venue_type) {
            query += ` AND venue_type = $${idx}`;
            params.push(current_venue_type);
            idx++;
        }

        const result = await this.dataSource.query(query + ' RETURNING id, name', params);
        return { success: true, updated: result.length, venue_type };
    }

    @Get('follower-counts')
    async getFollowerCounts() {
        return this.courtsService.getFollowerCounts();
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

        // Send push notifications to users who have alerts enabled for this court
        try {
            // Get court name and user name for the notification
            // Some court IDs (like OSM way IDs) are not UUIDs - handle gracefully
            let courtName = 'Unknown Court';
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(courtId)) {
                const courtResult = await this.dataSource.query(
                    `SELECT name FROM courts WHERE id = $1`, [courtId]
                );
                courtName = courtResult[0]?.name || 'Unknown Court';
            }

            const userResult = await this.dataSource.query(
                `SELECT name FROM users WHERE id = $1`, [userId]
            );
            const userName = userResult[0]?.name || 'Someone';

            // Fire and forget - don't block the response on notification delivery
            this.notificationsService.sendCourtActivityNotification(
                courtId,
                courtName,
                userName,
                'check_in'
            ).catch(err => console.error('Failed to send court activity notification:', err));

            console.log(`[CheckIn] Triggered notification for ${userName} at ${courtName}`);
        } catch (err) {
            console.error('[CheckIn] Error fetching court/user for notification:', err);
        }

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

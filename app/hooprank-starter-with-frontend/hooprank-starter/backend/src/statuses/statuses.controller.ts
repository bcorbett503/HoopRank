import { Controller, Get, Post, Delete, Body, Param, Headers, Query } from '@nestjs/common';
import { StatusesService } from './statuses.service';

@Controller('statuses')
export class StatusesController {
    constructor(private readonly statusesService: StatusesService) { }

    // Create a new status
    @Post()
    async createStatus(
        @Headers('x-user-id') userId: string,
        @Body() body: {
            content: string;
            imageUrl?: string;
            scheduledAt?: string;
            courtId?: string;
            videoUrl?: string;
            videoThumbnailUrl?: string;
            videoDurationMs?: number;
            gameMode?: string;
            courtType?: string;
            ageRange?: string;
        },
    ) {
        if (!userId) {
            return { success: false, error: 'User ID required' };
        }
        const status = await this.statusesService.createStatus(
            userId,
            body.content,
            body.imageUrl,
            body.scheduledAt,
            body.courtId,
            body.videoUrl,
            body.videoThumbnailUrl,
            body.videoDurationMs,
            body.gameMode,
            body.courtType,
            body.ageRange,
        );
        return { success: true, status };
    }

    // Get all statuses (bare GET /statuses — used by mobile)
    @Get()
    async getAllStatuses(@Headers('x-user-id') userId: string) {
        if (!userId) {
            return [];
        }
        return this.statusesService.getFeed(userId);
    }

    // Get feed of statuses from followed users
    @Get('feed')
    async getFeed(@Headers('x-user-id') userId: string) {
        if (!userId) {
            return [];
        }
        return this.statusesService.getFeed(userId);
    }

    // Debug endpoint to check player_statuses table
    @Get('debug-statuses')
    async debugStatuses() {
        return this.statusesService.debugPlayerStatuses();
    }

    // Test endpoint to debug feed query in isolation
    @Get('test-feed')
    async testFeed(@Headers('x-user-id') userId: string) {
        return this.statusesService.testFeedQuery(userId);
    }

    // Migration endpoint to add video columns
    @Post('migrate-video-columns')
    async migrateVideoColumns() {
        return this.statusesService.migrateVideoColumns();
    }

    // Migration endpoint to add run attribute columns
    @Post('migrate-run-attributes')
    async migrateRunAttributes() {
        return this.statusesService.migrateRunAttributeColumns();
    }

    // Get unified feed (statuses + check-ins + matches)
    // Supports filter: 'foryou' (local 50mi), 'following' (followed only), 'all' (default)
    @Get('unified-feed')
    async getUnifiedFeed(
        @Headers('x-user-id') userId: string,
        @Query('filter') filter: string = 'all',
        @Query('lat') lat?: string,
        @Query('lng') lng?: string,
    ) {
        try {
            if (!userId) {
                return [];
            }
            const latitude = lat ? parseFloat(lat) : undefined;
            const longitude = lng ? parseFloat(lng) : undefined;
            return await this.statusesService.getUnifiedFeed(userId, filter || 'all', 50, latitude, longitude);
        } catch (error) {
            console.error('Controller getUnifiedFeed error:', error.message);
            return [];
        }
    }


    // Get single status with details
    @Get(':id')
    async getStatus(@Param('id') id: string) {
        const statusId = parseInt(id, 10);
        if (isNaN(statusId)) {
            return null;
        }
        return this.statusesService.getStatus(statusId);
    }

    // Get all posts by a specific user
    @Get('user/:userId')
    async getUserPosts(
        @Param('userId') targetUserId: string,
        @Headers('x-user-id') viewerId: string,
    ) {
        if (!targetUserId) {
            return [];
        }
        return this.statusesService.getUserPosts(targetUserId, viewerId || undefined);
    }

    // Delete a status
    @Delete(':id')
    async deleteStatus(
        @Headers('x-user-id') userId: string,
        @Param('id') id: string,
    ) {
        const statusId = parseInt(id, 10);
        if (!userId || isNaN(statusId)) {
            return { success: false, error: 'Invalid ID' };
        }
        const deleted = await this.statusesService.deleteStatus(userId, statusId);
        return { success: deleted };
    }

    // Like a status
    @Post(':id/like')
    async likeStatus(
        @Headers('x-user-id') userId: string,
        @Param('id') id: string,
    ) {
        const statusId = parseInt(id, 10);
        if (!userId || isNaN(statusId)) {
            return { success: false, error: 'Invalid ID' };
        }
        await this.statusesService.likeStatus(userId, statusId);
        return { success: true };
    }

    // Unlike a status
    @Delete(':id/like')
    async unlikeStatus(
        @Headers('x-user-id') userId: string,
        @Param('id') id: string,
    ) {
        const statusId = parseInt(id, 10);
        if (!userId || isNaN(statusId)) {
            return { success: false, error: 'Invalid ID' };
        }
        await this.statusesService.unlikeStatus(userId, statusId);
        return { success: true };
    }

    // Get likes for a status
    @Get(':id/likes')
    async getLikes(@Param('id') id: string) {
        const statusId = parseInt(id, 10);
        if (isNaN(statusId)) {
            return [];
        }
        return this.statusesService.getLikes(statusId);
    }

    // Add a comment
    @Post(':id/comments')
    async addComment(
        @Headers('x-user-id') userId: string,
        @Param('id') id: string,
        @Body() body: { content: string },
    ) {
        const statusId = parseInt(id, 10);
        if (!userId || isNaN(statusId)) {
            return { success: false, error: 'Invalid ID' };
        }
        const comment = await this.statusesService.addComment(userId, statusId, body.content);
        return { success: true, comment };
    }

    // Get comments for a status
    @Get(':id/comments')
    async getComments(@Param('id') id: string) {
        const statusId = parseInt(id, 10);
        if (isNaN(statusId)) {
            return [];
        }
        return this.statusesService.getComments(statusId);
    }

    // Delete a comment
    @Delete('comments/:commentId')
    async deleteComment(
        @Headers('x-user-id') userId: string,
        @Param('commentId') commentId: string,
    ) {
        const commentIdNum = parseInt(commentId, 10);
        if (!userId || isNaN(commentIdNum)) {
            return { success: false, error: 'Invalid ID' };
        }
        const deleted = await this.statusesService.deleteComment(userId, commentIdNum);
        return { success: deleted };
    }

    // ========== Event Attendance (I'm IN) ==========

    // Mark as attending an event
    @Post(':id/attend')
    async markAttending(
        @Headers('x-user-id') userId: string,
        @Param('id') id: string,
    ) {
        const statusId = parseInt(id, 10);
        if (!userId || isNaN(statusId)) {
            return { success: false, error: 'Invalid ID' };
        }
        await this.statusesService.markAttending(userId, statusId);
        return { success: true };
    }

    // Remove attendance from an event
    @Delete(':id/attend')
    async removeAttending(
        @Headers('x-user-id') userId: string,
        @Param('id') id: string,
    ) {
        const statusId = parseInt(id, 10);
        if (!userId || isNaN(statusId)) {
            return { success: false, error: 'Invalid ID' };
        }
        await this.statusesService.removeAttending(userId, statusId);
        return { success: true };
    }

    // Get attendees for an event
    @Get(':id/attendees')
    async getAttendees(@Param('id') id: string) {
        const statusId = parseInt(id, 10);
        if (isNaN(statusId)) {
            return [];
        }
        return this.statusesService.getAttendees(statusId);
    }
}

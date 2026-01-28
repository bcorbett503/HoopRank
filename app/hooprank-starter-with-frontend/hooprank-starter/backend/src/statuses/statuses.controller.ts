import { Controller, Get, Post, Delete, Body, Param, Headers, Query } from '@nestjs/common';
import { StatusesService } from './statuses.service';

@Controller('statuses')
export class StatusesController {
    constructor(private readonly statusesService: StatusesService) { }

    // Create a new status
    @Post()
    async createStatus(
        @Headers('x-user-id') userId: string,
        @Body() body: { content: string; imageUrl?: string; scheduledAt?: string; courtId?: string },
    ) {
        if (!userId) {
            return { success: false, error: 'User ID required' };
        }
        const status = await this.statusesService.createStatus(userId, body.content, body.imageUrl, body.scheduledAt, body.courtId);
        return { success: true, status };
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

    // Get unified feed (statuses + check-ins + matches)
    @Get('unified-feed')
    async getUnifiedFeed(
        @Headers('x-user-id') userId: string,
        @Query('filter') filter: string = 'all',
    ) {
        try {
            if (!userId) {
                return [];
            }
            return await this.statusesService.getUnifiedFeed(userId, filter || 'all');
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

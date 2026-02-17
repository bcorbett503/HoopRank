import { Controller, Get, Post, Delete, Body, Param, Headers, Query, BadRequestException } from '@nestjs/common';
import { StatusesService } from './statuses.service';
import { UsersService } from '../users/users.service';
import { filterContent } from '../common/content_filter';
import { CreateStatusDto } from './dto/create-status.dto';

@Controller('statuses')
export class StatusesController {
    constructor(
        private readonly statusesService: StatusesService,
        private readonly usersService: UsersService,
    ) { }

    // Create a new status
    @Post()
    async createStatus(
        @Headers('x-user-id') userId: string,
        @Body() body: CreateStatusDto,
    ) {
        if (!userId) {
            return { success: false, error: 'User ID required' };
        }
        // Content filter (Guideline 1.2)
        const filterResult = filterContent(body.content || '');
        if (!filterResult.clean) {
            return { success: false, error: 'Your post contains inappropriate language. Please revise and try again.' };
        }
        const status = await this.statusesService.createStatus(
            userId,
            body.content,
            body.imageUrl,
            body.scheduledAt,
            body.isRecurring,
            body.courtId,
            body.videoUrl,
            body.videoThumbnailUrl,
            body.videoDurationMs,
            body.gameMode,
            body.courtType,
            body.ageRange,
            body.taggedPlayerIds,
            body.tagMode,
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

    // Get unified feed (statuses + check-ins + matches)
    // Supports filter: 'foryou' (local 50mi), 'following' (followed only), 'all' (default)
    @Get('unified-feed')
    async getUnifiedFeed(
        @Headers('x-user-id') userId: string,
        @Query('filter') filter: string = 'all',
        @Query('lat') lat?: string,
        @Query('lng') lng?: string,
        @Query('limit') limitStr?: string,
        @Query('offset') offsetStr?: string,
    ) {
        try {
            if (!userId) {
                return [];
            }
            const limit = Math.min(Math.max(parseInt(limitStr || '', 10) || 50, 1), 100);
            const offset = Math.max(parseInt(offsetStr || '', 10) || 0, 0);
            const latitude = lat ? parseFloat(lat) : undefined;
            const longitude = lng ? parseFloat(lng) : undefined;
            const results = await this.statusesService.getUnifiedFeed(userId, filter || 'all', limit + 1, latitude, longitude);
            // Fetch limit+1 to detect hasMore, return only limit items
            const hasMore = results.length > limit;
            return { items: results.slice(0, limit), hasMore };
        } catch (error) {
            console.error('Controller getUnifiedFeed error:', error.message);
            return { items: [], hasMore: false };
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
        // Content filter (Guideline 1.2)
        const commentFilter = filterContent(body.content || '');
        if (!commentFilter.clean) {
            return { success: false, error: 'Your comment contains inappropriate language. Please revise and try again.' };
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

    // ========== Content Reporting (Guideline 1.2) ==========

    @Post(':id/report')
    async reportStatus(
        @Headers('x-user-id') userId: string,
        @Param('id') id: string,
        @Body() body: { reason: string },
    ) {
        const statusId = parseInt(id, 10);
        if (!userId || isNaN(statusId) || !body.reason) {
            return { success: false, error: 'userId, statusId, and reason required' };
        }
        return this.usersService.reportStatus(userId, statusId, body.reason);
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

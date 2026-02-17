import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, Headers, Inject, forwardRef, ForbiddenException } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { TeamsService } from '../teams/teams.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('messages')
export class MessagesController {
    constructor(
        private readonly messagesService: MessagesService,
        @Inject(forwardRef(() => TeamsService))
        private readonly teamsService: TeamsService,
    ) { }

    @Post()
    async sendMessage(
        @Headers('x-user-id') userId: string,
        @Body() body: { senderId?: string; receiverId?: string; toUserId?: string; content: string; matchId?: string; isChallenge?: boolean; imageUrl?: string }
    ) {
        // Sender is always the authenticated user; ignore caller-supplied senderId.
        const senderId = userId;
        const receiverId = body.receiverId || body.toUserId;
        if (!senderId || !receiverId) {
            throw new Error('Receiver ID required (receiverId or toUserId)');
        }
        if (body.senderId && body.senderId !== senderId) {
            throw new ForbiddenException('senderId must match authenticated user');
        }
        return this.messagesService.sendMessage(senderId, receiverId, body.content, body.matchId, body.isChallenge, undefined, body.imageUrl);
    }

    @Get('challenges')
    async getChallenges(@Headers('x-user-id') userId: string) {
        return this.messagesService.getPendingChallenges(userId);
    }

    @Get('team-chats')
    async getTeamChats(@Headers('x-user-id') userId: string) {
        return this.teamsService.getTeamChats(userId);
    }

    @Get('unread-count')
    async getUnreadCount(@Headers('x-user-id') userId: string) {
        const count = await this.messagesService.getUnreadCount(userId);
        return { unreadCount: count };
    }

    // GET /messages/conversations — uses x-user-id header (mobile path)
    @Get('conversations')
    async getConversationsFromHeader(@Headers('x-user-id') userId: string) {
        return this.messagesService.getConversations(userId);
    }

    @Get('conversations/:userId')
    async getConversations(
        @Headers('x-user-id') authUserId: string,
        @Param('userId') userId: string,
    ) {
        if (authUserId !== userId) {
            throw new ForbiddenException('You can only view your own conversations');
        }
        return this.messagesService.getConversations(authUserId);
    }

    // GET /messages/:otherUserId — uses x-user-id header (mobile path)
    @Get(':otherUserId')
    async getMessagesWithHeader(
        @Headers('x-user-id') userId: string,
        @Param('otherUserId') otherUserId: string,
    ) {
        return this.messagesService.getMessages(userId, otherUserId);
    }

    @Get(':userId/:otherUserId')
    async getMessages(
        @Headers('x-user-id') authUserId: string,
        @Param('userId') userId: string,
        @Param('otherUserId') otherUserId: string,
    ) {
        if (authUserId !== userId) {
            throw new ForbiddenException('You can only view your own messages');
        }
        return this.messagesService.getMessages(authUserId, otherUserId);
    }

    @Put(':otherUserId/read')
    async markAsRead(
        @Headers('x-user-id') userId: string,
        @Param('otherUserId') otherUserId: string
    ) {
        const result = await this.messagesService.markConversationAsRead(userId, otherUserId);
        return { success: true, markedCount: result.markedCount };
    }

    @Get('debug-messages')
    async debugMessages() {
        return this.messagesService.debugMessagesTable();
    }

    @Post('migrate-court-id')
    async migrateCourtId() {
        return this.messagesService.migrateCourtIdColumn();
    }

    @Post('cleanup-duplicate-challenges')
    async cleanupDuplicateChallenges() {
        return this.messagesService.cleanupDuplicateChallenges();
    }
}

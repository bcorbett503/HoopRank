import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, Headers, Inject, forwardRef } from '@nestjs/common';
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
        @Body() body: { senderId?: string; receiverId?: string; toUserId?: string; content: string; matchId?: string; isChallenge?: boolean }
    ) {
        // Support both formats: {senderId, receiverId} and {toUserId} (mobile)
        const senderId = body.senderId || userId;
        const receiverId = body.receiverId || body.toUserId;
        if (!senderId || !receiverId) {
            throw new Error('Receiver ID required (receiverId or toUserId)');
        }
        return this.messagesService.sendMessage(senderId, receiverId, body.content, body.matchId, body.isChallenge);
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
    async getConversations(@Param('userId') userId: string) {
        return this.messagesService.getConversations(userId);
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
    async getMessages(@Param('userId') userId: string, @Param('otherUserId') otherUserId: string) {
        return this.messagesService.getMessages(userId, otherUserId);
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

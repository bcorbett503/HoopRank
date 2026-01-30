import { Controller, Get, Post, Body, Param, UseGuards, Request, Headers, Inject, forwardRef } from '@nestjs/common';
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
        @Body() body: { senderId: string; receiverId: string; content: string; matchId?: string; isChallenge?: boolean }
    ) {
        // Validate that the authenticated user matches the sender
        if (!userId || userId !== body.senderId) {
            throw new Error('Unauthorized: sender must match authenticated user');
        }
        return this.messagesService.sendMessage(body.senderId, body.receiverId, body.content, body.matchId, body.isChallenge);
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

    @Get('conversations/:userId')
    async getConversations(@Param('userId') userId: string) {
        return this.messagesService.getConversations(userId);
    }

    @Get(':userId/:otherUserId')
    async getMessages(@Param('userId') userId: string, @Param('otherUserId') otherUserId: string) {
        return this.messagesService.getMessages(userId, otherUserId);
    }
}

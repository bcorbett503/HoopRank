import { Controller, Get, Post, Body, Param, UseGuards, Request, Headers } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('messages')
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) { }

    @Post()
    @UseGuards(AuthGuard)
    async sendMessage(@Body() body: { senderId: string; receiverId: string; content: string; matchId?: string; isChallenge?: boolean }) {
        return this.messagesService.sendMessage(body.senderId, body.receiverId, body.content, body.matchId, body.isChallenge);
    }

    @Get('challenges')
    async getChallenges(@Headers('x-user-id') userId: string) {
        return this.messagesService.getPendingChallenges(userId);
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

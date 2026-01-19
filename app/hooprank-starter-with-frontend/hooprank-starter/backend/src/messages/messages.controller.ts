import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('messages')
@UseGuards(AuthGuard)
export class MessagesController {
    constructor(private readonly messagesService: MessagesService) { }

    @Post()
    async sendMessage(@Body() body: { senderId: string; receiverId: string; content: string; matchId?: string }) {
        return this.messagesService.sendMessage(body.senderId, body.receiverId, body.content, body.matchId);
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

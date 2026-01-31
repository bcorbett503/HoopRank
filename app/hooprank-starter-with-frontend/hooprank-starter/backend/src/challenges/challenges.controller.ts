import { Controller, Get, Post, Body, Param, Headers, Put } from '@nestjs/common';
import { MessagesService } from '../messages/messages.service';

@Controller('challenges')
export class ChallengesController {
    constructor(
        private readonly messagesService: MessagesService,
    ) { }

    /**
     * Create a new challenge (creates a message with isChallenge=true)
     * Optionally tag a court where the game will be played
     */
    @Post()
    async createChallenge(
        @Headers('x-user-id') userId: string,
        @Body() body: { toUserId: string; message?: string; courtId?: string }
    ) {
        if (!userId) {
            throw new Error('Unauthorized: x-user-id header required');
        }

        // Create challenge as a message with isChallenge flag
        const challenge = await this.messagesService.sendMessage(
            userId,
            body.toUserId,
            body.message || 'Want to play?',
            undefined, // no matchId
            true, // isChallenge = true
            body.courtId // optional court tag
        );

        return challenge;
    }

    /**
     * Get pending challenges for the current user
     */
    @Get()
    async getChallenges(@Headers('x-user-id') userId: string) {
        return this.messagesService.getPendingChallenges(userId);
    }

    /**
     * Accept a challenge
     */
    @Put(':id/accept')
    async acceptChallenge(
        @Headers('x-user-id') userId: string,
        @Param('id') challengeId: string
    ) {
        return this.messagesService.updateChallengeStatus(challengeId, 'accepted', userId);
    }

    /**
     * Decline a challenge
     */
    @Put(':id/decline')
    async declineChallenge(
        @Headers('x-user-id') userId: string,
        @Param('id') challengeId: string
    ) {
        return this.messagesService.updateChallengeStatus(challengeId, 'declined', userId);
    }
}

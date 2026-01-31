import { Controller, Get, Post, Body, Param, Headers, Put, Delete, HttpException, HttpStatus } from '@nestjs/common';
import { ChallengesService } from './challenges.service';

@Controller('challenges')
export class ChallengesController {
    constructor(
        private readonly challengesService: ChallengesService,
    ) { }

    /**
     * Create a new challenge
     * Optionally include a court where the game will be played
     */
    @Post()
    async createChallenge(
        @Headers('x-user-id') userId: string,
        @Body() body: { toUserId: string; message?: string; courtId?: string }
    ) {
        if (!userId) {
            throw new HttpException('Unauthorized: x-user-id header required', HttpStatus.UNAUTHORIZED);
        }

        return this.challengesService.create(userId, body.toUserId, body.message, body.courtId);
    }

    /**
     * Get challenges for the current user
     */
    @Get()
    async getChallenges(@Headers('x-user-id') userId: string) {
        if (!userId) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }
        return this.challengesService.getAllForUser(userId);
    }

    /**
     * Get only pending challenges (incoming)
     */
    @Get('pending')
    async getPendingChallenges(@Headers('x-user-id') userId: string) {
        if (!userId) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }
        return this.challengesService.getPendingForUser(userId);
    }

    /**
     * Accept a challenge
     */
    @Put(':id/accept')
    async acceptChallenge(
        @Headers('x-user-id') userId: string,
        @Param('id') challengeId: string
    ) {
        if (!userId) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }
        return this.challengesService.accept(challengeId, userId);
    }

    /**
     * Decline a challenge
     */
    @Put(':id/decline')
    async declineChallenge(
        @Headers('x-user-id') userId: string,
        @Param('id') challengeId: string
    ) {
        if (!userId) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }
        return this.challengesService.decline(challengeId, userId);
    }

    /**
     * Cancel a challenge (sender only)
     */
    @Delete(':id')
    async cancelChallenge(
        @Headers('x-user-id') userId: string,
        @Param('id') challengeId: string
    ) {
        if (!userId) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }
        return this.challengesService.cancel(challengeId, userId);
    }
}

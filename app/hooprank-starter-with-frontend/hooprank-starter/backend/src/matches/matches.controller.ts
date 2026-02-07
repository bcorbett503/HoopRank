import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { Match } from './match.entity';
import { CreateMatchDto } from './dto/create-match.dto';
import { MessagesService } from '../messages/messages.service';

@Controller('api/v1/matches')
export class MatchesController {
  constructor(
    private readonly matches: MatchesService,
    private readonly messages: MessagesService
  ) { }

  @Post()
  async create(@Body() body: CreateMatchDto & { message?: string }): Promise<Match> {
    // Use creatorId/opponentId - mapped from hostId/guestId in DTO
    const creatorId = body.hostId || (body as any).creatorId;
    const opponentId = body.guestId || (body as any).opponentId;
    const match = await this.matches.create(creatorId, opponentId, body.courtId);

    if (body.message && opponentId) {
      await this.messages.sendMessage(creatorId, opponentId, body.message, match.id);
    }

    return match;
  }

  @Post(':id/accept')
  async accept(
    @Param('id') id: string,
    @Body() body: { guestId?: string; opponentId?: string },
    @Headers('x-user-id') userId?: string,
  ): Promise<Match> {
    const opponentId = body.guestId || body.opponentId || userId;
    if (!opponentId) throw new Error('opponentId required');
    return await this.matches.accept(id, opponentId);
  }

  @Post(':id/complete')
  async complete(@Param('id') id: string, @Body() body: { winner: string }): Promise<Match> {
    return await this.matches.complete(id, body.winner);
  }

  /**
   * Submit score for a match
   * Determines winner from scores and calls complete to update ratings
   */
  @Post(':id/score')
  async submitScore(
    @Param('id') id: string,
    @Body() body: { me: number; opponent: number; courtId?: string },
    @Headers('x-user-id') userId: string
  ): Promise<{ match: Match }> {
    try {
      console.log(`[submitScore] Starting for match ${id}, user ${userId}, scores: me=${body.me}, opponent=${body.opponent}, courtId=${body.courtId || 'none'}`);

      // Get match to determine who is who
      const match = await this.matches.get(id);
      if (!match) throw new Error('Match not found');

      const creatorId = (match as any).creator_id || match.creatorId;
      const opponentId = (match as any).opponent_id || match.opponentId;

      // Determine scores based on who is submitting
      const isSubmitterCreator = userId === creatorId;
      const scoreCreator = isSubmitterCreator ? body.me : body.opponent;
      const scoreOpponent = isSubmitterCreator ? body.opponent : body.me;

      // Phase 1: Store scores without updating ratings — opponent must confirm
      const updatedMatch = await this.matches.submitScoreOnly(id, userId, scoreCreator, scoreOpponent, body.courtId);

      console.log(`[submitScore] Score submitted — awaiting opponent confirmation`);
      return { match: updatedMatch };
    } catch (error) {
      console.error(`[submitScore] Error for match ${id}:`, error);
      throw error;
    }
  }

  @Get('pending-confirmation')
  async getPendingConfirmations(@Headers('x-user-id') userId: string) {
    if (!userId) return [];
    return this.matches.getPendingConfirmations(userId);
  }

  @Post(':id/confirm')
  async confirmScore(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string
  ): Promise<{ match: Match }> {
    if (!userId) throw new Error('Authentication required');
    const match = await this.matches.confirmScore(id, userId);
    return { match };
  }

  @Post(':id/contest')
  async contestScore(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string
  ): Promise<{ match: Match }> {
    if (!userId) throw new Error('Authentication required');
    const match = await this.matches.contestScore(id, userId);
    return { match };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<Match | { error: string }> {
    const match = await this.matches.get(id);
    return match ?? { error: 'not found' };
  }
}

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
  async accept(@Param('id') id: string, @Body() body: { guestId?: string; opponentId?: string }): Promise<Match> {
    const opponentId = body.guestId || body.opponentId;
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
    @Body() body: { me: number; opponent: number },
    @Headers('x-user-id') userId: string
  ): Promise<{ match: Match; ratingChange?: { myChange: number; opponentChange: number } }> {
    // Get match to determine who is who
    const match = await this.matches.get(id);
    if (!match) throw new Error('Match not found');

    // Get the submitter ID from the header
    const submitterId = userId;

    // Handle both camelCase (entity) and snake_case (raw SQL) property names
    const creatorId = (match as any).creator_id || match.creatorId;
    const opponentId = (match as any).opponent_id || match.opponentId;

    // Determine scores based on who is submitting
    // If submitter is creator, their score is score_creator
    const isSubmitterCreator = submitterId === creatorId;
    const scoreCreator = isSubmitterCreator ? body.me : body.opponent;
    const scoreOpponent = isSubmitterCreator ? body.opponent : body.me;

    // Determine winner based on scores: if me > opponent, submitter wins
    const submitterOpponentId = submitterId === creatorId ? opponentId : creatorId;
    const winnerId = body.me > body.opponent ? submitterId : submitterOpponentId;

    // Complete the match with scores (this updates ratings and challenge status)
    const completedMatch = await this.matches.completeWithScores(id, winnerId, scoreCreator, scoreOpponent);

    return { match: completedMatch };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<Match | { error: string }> {
    const match = await this.matches.get(id);
    return match ?? { error: 'not found' };
  }
}

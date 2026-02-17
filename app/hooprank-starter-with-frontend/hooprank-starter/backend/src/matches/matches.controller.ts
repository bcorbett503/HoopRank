import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Param, Post } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { Match } from './match.entity';
import { CreateMatchDto } from './dto/create-match.dto';
import { SubmitScoreDto } from './dto/submit-score.dto';
import { MessagesService } from '../messages/messages.service';

/** Map backend status to iOS MatchStatus enum values */
const STATUS_MAP: Record<string, string> = {
  pending: 'waiting',
  accepted: 'live',
  completed: 'ended',
  cancelled: 'cancelled',
  contested: 'contested',
};

function mapMatchForIOS(match: any): any {
  if (!match || match.error) return match;
  return {
    ...match,
    // TODO(contract): Keep backendStatus until all clients normalize both
    // status vocabularies. /matches now emits mapped values, while some other
    // endpoints (e.g. user match history) still expose raw backend statuses.
    // Map status directly to iOS enum values
    status: STATUS_MAP[match.status] || match.status,
    // Keep original status as a fallback
    backendStatus: match.status,
    // snake_case aliases for iOS models
    creator_id: match.creatorId ?? match.creator_id,
    opponent_id: match.opponentId ?? match.opponent_id,
    court_id: match.courtId ?? match.court_id,
    score_creator: match.scoreCreator ?? match.score_creator,
    score_opponent: match.scoreOpponent ?? match.score_opponent,
    match_type: match.matchType ?? match.match_type ?? '1v1',
    created_at: match.createdAt ?? match.created_at,
    updated_at: match.updatedAt ?? match.updated_at,
  };
}

@Controller('api/v1/matches')
export class MatchesController {
  constructor(
    private readonly matches: MatchesService,
    private readonly messages: MessagesService
  ) { }

  @Post()
  async create(
    @Headers('x-user-id') userId: string,
    @Body() body: CreateMatchDto & { message?: string },
  ): Promise<Match> {
    // Use creatorId/opponentId - mapped from hostId/guestId in DTO
    const creatorId = userId;
    const requestedCreatorId = body.hostId || (body as any).creatorId;
    if (requestedCreatorId && requestedCreatorId !== creatorId) {
      throw new ForbiddenException('hostId must match authenticated user');
    }
    const opponentId = body.guestId || (body as any).opponentId;
    const match = await this.matches.create(creatorId, opponentId, body.courtId);

    if (body.message && opponentId) {
      await this.messages.sendMessage(creatorId, opponentId, body.message, match.id);
    }

    return mapMatchForIOS(match);
  }

  @Post(':id/accept')
  async accept(
    @Param('id') id: string,
    @Body() body: { guestId?: string; opponentId?: string },
    @Headers('x-user-id') userId?: string,
  ): Promise<Match> {
    const requestedOpponentId = body.guestId || body.opponentId;
    if (requestedOpponentId && userId && requestedOpponentId !== userId) {
      throw new ForbiddenException('opponentId must match authenticated user');
    }
    const opponentId = userId;
    if (!opponentId) throw new Error('opponentId required');
    return mapMatchForIOS(await this.matches.accept(id, opponentId));
  }

  @Post(':id/complete')
  async complete(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() body: { winner: string },
  ): Promise<Match> {
    if (!userId) {
      throw new Error('Authentication required');
    }
    if (body.winner !== userId) {
      throw new ForbiddenException('winner must match authenticated user');
    }
    const match = await this.matches.get(id);
    if (!match) throw new Error('Match not found');
    const creatorId = (match as any).creator_id || (match as any).creatorId;
    const opponentId = (match as any).opponent_id || (match as any).opponentId;
    if (userId !== creatorId && userId !== opponentId) {
      throw new ForbiddenException('You are not a participant in this match');
    }
    return mapMatchForIOS(await this.matches.complete(id, body.winner));
  }

  /**
   * Submit score for a match
   * Determines winner from scores and calls complete to update ratings
   */
  @Post(':id/score')
  async submitScore(
    @Param('id') id: string,
    @Body() body: SubmitScoreDto,
    @Headers('x-user-id') userId: string
  ): Promise<{ match: Match }> {
    try {

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

      return { match: mapMatchForIOS(updatedMatch) };
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
  @HttpCode(200)
  async confirmScore(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string
  ): Promise<{ match: Match }> {
    if (!userId) throw new Error('Authentication required');
    const match = await this.matches.confirmScore(id, userId);
    return { match: mapMatchForIOS(match) };
  }

  @Post(':id/contest')
  @HttpCode(200)
  async contestScore(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string
  ): Promise<{ match: Match }> {
    if (!userId) throw new Error('Authentication required');
    const match = await this.matches.contestScore(id, userId);
    return { match: mapMatchForIOS(match) };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<Match | { error: string }> {
    const match = await this.matches.get(id);
    return mapMatchForIOS(match) ?? { error: 'not found' };
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
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

  @Get(':id')
  async get(@Param('id') id: string): Promise<Match | { error: string }> {
    const match = await this.matches.get(id);
    return match ?? { error: 'not found' };
  }
}

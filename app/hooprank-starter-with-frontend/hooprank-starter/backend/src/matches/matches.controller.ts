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
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : undefined;
    const match = await this.matches.create(body.hostId, body.guestId, scheduledAt, body.courtId);

    if (body.message && body.guestId) {
      await this.messages.sendMessage(body.hostId, body.guestId, body.message, match.id);
    }

    return match;
  }

  @Post(':id/accept')
  async accept(@Param('id') id: string, @Body() body: { guestId: string }): Promise<Match> {
    return await this.matches.accept(id, body.guestId);
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

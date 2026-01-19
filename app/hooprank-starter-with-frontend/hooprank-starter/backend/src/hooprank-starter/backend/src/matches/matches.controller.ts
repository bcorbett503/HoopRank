import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MatchesService } from './matches.service';
import type { Match } from './matches.service';

@Controller('api/v1/matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Post()
  create(@Body() body: { hostId: string; guestId?: string }): Match {
    return this.matches.create(body.hostId, body.guestId);
  }

  @Post(':id/accept')
  accept(@Param('id') id: string, @Body() body: { guestId: string }): Match {
    return this.matches.accept(id, body.guestId);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @Body() body: { winner: string }): Match {
    return this.matches.complete(id, body.winner);
  }

  @Get(':id')
  get(@Param('id') id: string): Match | { error: string } {
    return this.matches.get(id) ?? { error: 'not found' };
  }
}

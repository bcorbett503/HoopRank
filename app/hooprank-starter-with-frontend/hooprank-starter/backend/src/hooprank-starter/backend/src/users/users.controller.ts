import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(':id')
  get(@Param('id') id: string) {
    const u = this.users.get(id);
    if (!u) return { error: 'not found' };
    return u;
  }
}

import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { User } from './user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post('auth')
  @UseGuards(AuthGuard)
  async authenticate(@Request() req) {
    // req.user is set by AuthGuard from Firebase token
    const { uid, email } = req.user;
    return this.usersService.findOrCreate(uid, email);
  }

  @Post('seed')
  async seed() {
    return this.usersService.seed();
  }

  @Get()
  findAll() {
    return this.usersService.getAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post(':id/profile')
  @UseGuards(AuthGuard)
  updateProfile(@Param('id') id: string, @Body() data: Partial<User>) {
    return this.usersService.updateProfile(id, data);
  }

  @Post(':id/friends/:friendId')
  @UseGuards(AuthGuard)
  addFriend(@Param('id') id: string, @Param('friendId') friendId: string) {
    return this.usersService.addFriend(id, friendId);
  }

  @Post(':id/friends/:friendId/remove') // Using POST for remove to avoid DELETE body issues if any, but DELETE is cleaner REST. Let's stick to DELETE if possible, or POST for simplicity.
  @UseGuards(AuthGuard)
  removeFriend(@Param('id') id: string, @Param('friendId') friendId: string) {
    return this.usersService.removeFriend(id, friendId);
  }

  @Get(':id/friends')
  getFriends(@Param('id') id: string) {
    return this.usersService.getFriends(id);
  }

  @Get(':id/matches')
  getMatches(@Param('id') id: string) {
    return this.usersService.getMatches(id);
  }
}

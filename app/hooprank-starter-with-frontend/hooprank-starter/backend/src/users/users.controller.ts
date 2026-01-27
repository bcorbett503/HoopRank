import { Controller, Get, Post, Put, Delete, Body, Param, Headers, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { User } from './user.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) { }

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

  @Get('me')
  async getMe(@Headers('x-user-id') userId: string) {
    return this.usersService.findOne(userId);
  }

  @Get('me/follows')
  async getFollows(@Headers('x-user-id') userId: string) {
    if (!userId) {
      return { courts: [], players: [] };
    }
    return this.usersService.getFollows(userId);
  }

  @Get('me/follows/activity')
  async getFollowedActivity(@Headers('x-user-id') userId: string) {
    if (!userId) {
      return { courtActivity: [], playerActivity: [] };
    }
    return this.usersService.getFollowedActivity(userId);
  }

  @Post('me/follows/courts')
  async followCourt(
    @Headers('x-user-id') userId: string,
    @Body() body: { courtId: string; alertsEnabled?: boolean },
  ) {
    if (!userId) {
      return { success: false, error: 'User ID required' };
    }
    await this.usersService.followCourt(userId, body.courtId);
    // If alerts requested, also enable alerts
    if (body.alertsEnabled) {
      await this.notificationsService.enableCourtAlert(userId, body.courtId);
    }
    return { success: true };
  }

  @Delete('me/follows/courts/:courtId')
  async unfollowCourt(
    @Headers('x-user-id') userId: string,
    @Param('courtId') courtId: string,
  ) {
    if (!userId) {
      return { success: false, error: 'User ID required' };
    }
    await this.usersService.unfollowCourt(userId, courtId);
    // Also disable alerts when unfollowing
    await this.notificationsService.disableCourtAlert(userId, courtId);
    return { success: true };
  }

  @Put('me/follows/courts/:courtId/alerts')
  async setCourtAlert(
    @Headers('x-user-id') userId: string,
    @Param('courtId') courtId: string,
    @Body() body: { enabled: boolean },
  ) {
    if (!userId) {
      return { success: false, error: 'User ID required' };
    }

    if (body.enabled) {
      await this.notificationsService.enableCourtAlert(userId, courtId);
    } else {
      await this.notificationsService.disableCourtAlert(userId, courtId);
    }
    return { success: true };
  }

  @Post('me/follows/players')
  async followPlayer(
    @Headers('x-user-id') userId: string,
    @Body() body: { playerId: string },
  ) {
    if (!userId || !body.playerId) {
      return { success: false, error: 'User ID and Player ID required' };
    }
    await this.usersService.followPlayer(userId, body.playerId);
    return { success: true };
  }

  @Delete('me/follows/players/:playerId')
  async unfollowPlayer(
    @Headers('x-user-id') userId: string,
    @Param('playerId') playerId: string,
  ) {
    if (!userId || !playerId) {
      return { success: false, error: 'User ID and Player ID required' };
    }
    await this.usersService.unfollowPlayer(userId, playerId);
    return { success: true };
  }

  @Post('me/fcm-token')
  async saveFcmToken(
    @Headers('x-user-id') userId: string,
    @Body() body: { token: string },
  ) {
    if (!userId) {
      return { success: false, error: 'User ID required' };
    }
    await this.notificationsService.saveFcmToken(userId, body.token);
    return { success: true };
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

  @Post(':id/friends/:friendId/remove')
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

import { Controller, Get, Post, Put, Body, Param, Headers, UseGuards, Request } from '@nestjs/common';
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
    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      return { courts: [], players: [] };
    }
    const courtAlerts = await this.notificationsService.getUserCourtAlerts(userIdNum);
    // For now, return alerts as the followed courts with alerts enabled
    return {
      courts: courtAlerts.map(courtId => ({ courtId, alertsEnabled: true })),
      players: [],
    };
  }

  @Put('me/follows/courts/:courtId/alerts')
  async setCourtAlert(
    @Headers('x-user-id') userId: string,
    @Param('courtId') courtId: string,
    @Body() body: { enabled: boolean },
  ) {
    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      return { success: false, error: 'Invalid user ID' };
    }

    if (body.enabled) {
      await this.notificationsService.enableCourtAlert(userIdNum, courtId);
    } else {
      await this.notificationsService.disableCourtAlert(userIdNum, courtId);
    }
    return { success: true };
  }

  @Post('me/fcm-token')
  async saveFcmToken(
    @Headers('x-user-id') userId: string,
    @Body() body: { token: string },
  ) {
    const userIdNum = parseInt(userId, 10);
    if (isNaN(userIdNum)) {
      return { success: false, error: 'Invalid user ID' };
    }
    await this.notificationsService.saveFcmToken(userIdNum, body.token);
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


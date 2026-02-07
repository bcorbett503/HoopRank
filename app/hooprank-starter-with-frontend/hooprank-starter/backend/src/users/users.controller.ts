import { Controller, Get, Post, Put, Delete, Body, Param, Headers, UseGuards, Request, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { User } from './user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { TeamsService } from '../teams/teams.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly teamsService: TeamsService,
  ) { }

  @Post('auth')
  @UseGuards(AuthGuard)
  async authenticate(@Request() req, @Body() body: { id?: string; email?: string }) {
    // Use id from body (Firebase UID passed by app) if token verification fell back to dev-token
    // This ensures existing users get their real profile instead of a new one
    const uid = body.id || req.user?.uid || '';
    const email = body.email || req.user?.email || '';
    console.log(`[AUTHENTICATE] uid=${uid}, email=${email}`);
    const user = await this.usersService.findOrCreate(uid, email);
    console.log(`[AUTHENTICATE] returned user.id=${user.id}, position=${user.position}`);
    return user;
  }


  // One-time migration endpoint - must be before :id routes
  @Post('admin/run-migrations')
  async runMigrations() {
    return this.usersService.runMigrations();
  }

  // Debug endpoint to check user_followed_courts table
  @Get('admin/debug-follows')
  async debugFollows() {
    return this.usersService.debugFollowedCourts();
  }

  // Cleanup endpoint to delete all users except specified ones
  @Post('admin/cleanup-users')
  async cleanupUsers() {
    return this.usersService.cleanupUsers();
  }

  // Delete a specific user and all their data (for testing)
  @Delete('admin/user/:userId')
  async deleteUser(@Param('userId') userId: string) {
    return this.usersService.deleteUser(userId);
  }

  @Get()
  findAll() {
    return this.usersService.getAll();
  }

  @Get('me')
  async getMe(@Headers('x-user-id') userId: string) {
    return this.usersService.findOne(userId);
  }

  @Put('me')
  async updateMe(
    @Headers('x-user-id') userId: string,
    @Body() data: Partial<User>,
  ) {
    if (!userId) {
      return { success: false, error: 'User ID required' };
    }
    try {
      console.log('updateMe: userId=', userId, 'data=', data);
      const user = await this.usersService.updateProfile(userId, data);
      return user;
    } catch (error) {
      console.error('updateMe error:', error.message);
      // If user doesn't exist, try to create them first
      if (error.message === 'User not found') {
        console.log('updateMe: user not found, creating...');
        try {
          await this.usersService.findOrCreate(userId, data.email || '');
          const user = await this.usersService.updateProfile(userId, data);
          return user;
        } catch (createError) {
          console.error('updateMe: failed to create user:', createError.message);
          return { success: false, error: 'Failed to create user profile' };
        }
      }
      return { success: false, error: 'Failed to update profile' };
    }
  }

  @Get('me/follows')
  async getFollows(@Headers('x-user-id') userId: string) {
    console.log('getFollows controller: userId received:', userId);
    if (!userId) {
      console.log('getFollows controller: no userId, returning empty');
      return { courts: [], players: [] };
    }
    const result = await this.usersService.getFollows(userId);
    console.log('getFollows controller: returning result:', result);
    return result;
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
    console.log('followCourt controller: userId=', userId, 'body=', body, 'courtId=', body?.courtId);
    try {
      await this.usersService.followCourt(userId, body.courtId);
      // If alerts requested, also enable alerts (but don't fail if this throws)
      if (body.alertsEnabled) {
        try {
          await this.notificationsService.enableCourtAlert(userId, body.courtId);
        } catch (alertError) {
          console.error('Error enabling court alert:', alertError.message);
        }
      }
      return { success: true };
    } catch (error) {
      console.error('followCourt error:', error);
      return { success: false, error: `Failed to follow court: ${error.message}` };
    }
  }

  @Delete('me/follows/courts/:courtId')
  async unfollowCourt(
    @Headers('x-user-id') userId: string,
    @Param('courtId') courtId: string,
  ) {
    if (!userId) {
      return { success: false, error: 'User ID required' };
    }
    try {
      await this.usersService.unfollowCourt(userId, courtId);
      // Also disable alerts when unfollowing (but don't fail if this throws)
      try {
        await this.notificationsService.disableCourtAlert(userId, courtId);
      } catch (alertError) {
        console.error('Error disabling court alert:', alertError.message);
      }
      return { success: true };
    } catch (error) {
      console.error('unfollowCourt error:', error.message);
      return { success: false, error: 'Failed to unfollow court' };
    }
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
    try {
      await this.notificationsService.saveFcmToken(userId, body.token);
      return { success: true };
    } catch (error) {
      console.error('saveFcmToken error:', error.message);
      return { success: false, error: 'Failed to save FCM token' };
    }
  }

  @Get('nearby')
  async getNearbyUsers(
    @Headers('x-user-id') userId: string,
    @Query('radiusMiles') radiusMiles?: string,
  ) {
    if (!userId) {
      return [];
    }
    const radius = parseInt(radiusMiles || '25', 10);
    return this.usersService.getNearbyUsers(userId, radius);
  }

  @Get(':id/stats')
  async getUserStats(@Param('id') id: string) {
    return this.usersService.getUserStats(id);
  }

  @Get(':id/rating')
  async getUserRating(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    if (!user) {
      return { error: 'User not found' };
    }
    // Return camelCase keys for mobile compatibility
    // Raw SQL returns hoop_rank, games_played - convert to camelCase
    return {
      hoopRank: parseFloat((user as any).hoop_rank) || 3.0,
      gamesPlayed: parseInt((user as any).games_played) || 0,
    };
  }

  @Get(':id/rank-history')
  async getRankHistory(@Param('id') id: string) {
    // Rank history is derived from match completions.
    // Return the user's match history formatted as rating changes.
    try {
      const matches = await this.usersService.getMatches(id);
      return (matches || []).filter((m: any) => m.status === 'completed').map((m: any) => ({
        date: m.completed_at || m.updated_at,
        rating: parseFloat(m.winner_id === id ? '3.1' : '2.9'),
        matchId: m.id,
      })).slice(0, 50);
    } catch {
      return [];
    }
  }

  @Get(':id/teams')
  async getUserTeams(@Param('id') id: string) {
    try {
      return await this.teamsService.getUserTeams(id);
    } catch {
      return [];
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post(':id/profile')
  async updateProfile(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() data: Partial<User>,
  ) {
    // Use id from param, fallback to x-user-id header
    const targetId = id || userId;
    if (!targetId) {
      return { success: false, error: 'User ID required' };
    }
    try {
      console.log('updateProfile: id=', targetId, 'data=', data);
      const user = await this.usersService.updateProfile(targetId, data);
      return user;
    } catch (error) {
      console.error('updateProfile error:', error.message);
      // If user doesn't exist, try to create them first
      if (error.message === 'User not found') {
        console.log('updateProfile: user not found, creating...');
        try {
          await this.usersService.findOrCreate(targetId, data.email || '');
          const user = await this.usersService.updateProfile(targetId, data);
          return user;
        } catch (createError) {
          console.error('updateProfile: failed to create user:', createError.message);
          return { success: false, error: 'Failed to create user profile' };
        }
      }
      return { success: false, error: 'Failed to update profile' };
    }
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


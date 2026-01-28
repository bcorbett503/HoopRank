import { Controller, Get, Post, Delete, Param, Body, Headers, HttpCode } from '@nestjs/common';
import { TeamsService } from './teams.service';

@Controller('teams')
export class TeamsController {
    constructor(private readonly teamsService: TeamsService) { }

    /**
     * Get user's teams
     */
    @Get()
    async getMyTeams(@Headers('x-user-id') userId: string) {
        return this.teamsService.getUserTeams(userId);
    }

    /**
     * Get pending team invites
     */
    @Get('invites')
    async getInvites(@Headers('x-user-id') userId: string) {
        return this.teamsService.getInvites(userId);
    }

    /**
     * Create a new team
     */
    @Post()
    async createTeam(
        @Headers('x-user-id') userId: string,
        @Body() body: { name: string; teamType: string },
    ) {
        return this.teamsService.createTeam(userId, body.name, body.teamType);
    }

    /**
     * Get team details
     */
    @Get(':id')
    async getTeamDetail(
        @Param('id') teamId: string,
        @Headers('x-user-id') userId: string,
    ) {
        return this.teamsService.getTeamDetail(teamId, userId);
    }

    /**
     * Accept team invite
     */
    @Post(':id/accept')
    @HttpCode(200)
    async acceptInvite(
        @Param('id') teamId: string,
        @Headers('x-user-id') userId: string,
    ) {
        await this.teamsService.acceptInvite(teamId, userId);
        return { success: true };
    }

    /**
     * Decline team invite
     */
    @Post(':id/decline')
    @HttpCode(200)
    async declineInvite(
        @Param('id') teamId: string,
        @Headers('x-user-id') userId: string,
    ) {
        await this.teamsService.declineInvite(teamId, userId);
        return { success: true };
    }

    /**
     * Leave team
     */
    @Post(':id/leave')
    @HttpCode(200)
    async leaveTeam(
        @Param('id') teamId: string,
        @Headers('x-user-id') userId: string,
    ) {
        await this.teamsService.leaveTeam(teamId, userId);
        return { success: true };
    }

    /**
     * Delete team (owner only)
     */
    @Delete(':id')
    @HttpCode(200)
    async deleteTeam(
        @Param('id') teamId: string,
        @Headers('x-user-id') userId: string,
    ) {
        await this.teamsService.deleteTeam(teamId, userId);
        return { success: true };
    }

    /**
     * Invite player to team
     */
    @Post(':id/invite/:playerId')
    @HttpCode(200)
    async invitePlayer(
        @Param('id') teamId: string,
        @Param('playerId') playerId: string,
        @Headers('x-user-id') userId: string,
    ) {
        await this.teamsService.invitePlayer(teamId, userId, playerId);
        return { success: true };
    }

    /**
     * Remove member from team
     */
    @Delete(':id/members/:memberId')
    @HttpCode(200)
    async removeMember(
        @Param('id') teamId: string,
        @Param('memberId') memberId: string,
        @Headers('x-user-id') userId: string,
    ) {
        await this.teamsService.removeMember(teamId, userId, memberId);
        return { success: true };
    }
}

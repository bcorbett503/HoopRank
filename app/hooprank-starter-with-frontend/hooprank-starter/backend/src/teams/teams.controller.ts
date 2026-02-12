import { Controller, Get, Post, Patch, Delete, Param, Body, Headers, HttpCode } from '@nestjs/common';
import { TeamsService } from './teams.service';

@Controller('teams')
export class TeamsController {
    constructor(private readonly teamsService: TeamsService) { }

    /**
     * Get user's teams
     */
    @Get()
    async getMyTeams(@Headers('x-user-id') userId: string) {
        const teams = await this.teamsService.getUserTeams(userId);
        // Add snake_case aliases for iOS Team.swift
        return Array.isArray(teams) ? teams.map((t: any) => ({
            ...t,
            team_type: t.teamType ?? t.team_type,
            logo_url: t.logoUrl ?? t.logo_url ?? null,
            home_court_id: t.homeCourtId ?? t.home_court_id ?? null,
        })) : teams;
    }

    /**
     * Get user's teams (explicit /mine route to avoid :id conflict)
     */
    @Get('mine')
    async getMyTeamsExplicit(@Headers('x-user-id') userId: string) {
        return this.teamsService.getUserTeams(userId);
    }

    /**
     * Get user's teams (explicit /my route alias)
     */
    @Get('my')
    async getMyTeamsMy(@Headers('x-user-id') userId: string) {
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
     * Create a new team — accepts both teamType and team_type for compatibility
     */
    @Post()
    async createTeam(
        @Headers('x-user-id') userId: string,
        @Body() body: { name: string; teamType?: string; team_type?: string; ageGroup?: string; gender?: string; skillLevel?: string; homeCourtId?: string; city?: string; description?: string },
    ) {
        const teamType = body.teamType || body.team_type || '3v3';
        return this.teamsService.createTeam(userId, body.name, teamType, body.ageGroup, body.gender, body.skillLevel, body.homeCourtId, body.city, body.description);
    }

    /**
     * Get all team challenges for the current user (across all their teams)
     * Must be before :id route to avoid NestJS parsing 'challenges' as a team ID
     */
    @Get('challenges')
    async getAllUserTeamChallenges(@Headers('x-user-id') userId: string) {
        if (!userId) return [];
        return this.teamsService.getAllUserTeamChallenges(userId);
    }

    /**
     * Get all upcoming events across all of the user's teams (unified schedule)
     * Must be before :id route to avoid NestJS parsing 'all-events' as a team ID
     */
    @Get('all-events')
    async getAllTeamEvents(@Headers('x-user-id') userId: string) {
        if (!userId) return [];
        return this.teamsService.getAllTeamEvents(userId);
    }

    /**
     * Get pending team score confirmations/amendments for the current user
     * Must be before :id route
     */
    @Get('pending-scores')
    async getPendingTeamScores(@Headers('x-user-id') userId: string) {
        if (!userId) return [];
        return this.teamsService.getPendingTeamScores(userId);
    }

    /**
     * Get teams for a specific user (mobile path: GET /teams/user/:userId)
     */
    @Get('user/:userId')
    async getUserTeams(
        @Param('userId') targetUserId: string,
    ) {
        const teams = await this.teamsService.getUserTeams(targetUserId);
        return { teams };
    }

    /**
     * Get team details
     */
    @Get(':id')
    async getTeamDetail(
        @Param('id') teamId: string,
        @Headers('x-user-id') userId: string,
    ) {
        const detail = await this.teamsService.getTeamDetail(teamId, userId);
        if (!detail) return detail;
        const d = detail as any;
        // Add both camelCase and snake_case for cross-client compat
        return {
            ...d,
            team_type: d.teamType ?? d.team_type,
            logo_url: d.logoUrl ?? d.logo_url ?? null,
            home_court_id: d.homeCourtId ?? d.home_court_id ?? null,
            // Ensure members have team_id
            members: Array.isArray(d.members) ? d.members.map((m: any) => ({
                ...m,
                team_id: m.team_id ?? m.teamId ?? teamId,
            })) : d.members,
        };
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
     * Respond to team invite (accept/decline)
     * This endpoint matches the frontend's expected API
     */
    @Post(':id/respond')
    @HttpCode(200)
    async respondToInvite(
        @Param('id') teamId: string,
        @Headers('x-user-id') userId: string,
        @Body() body: { accept: boolean },
    ) {
        if (body.accept) {
            await this.teamsService.acceptInvite(teamId, userId);
        } else {
            await this.teamsService.declineInvite(teamId, userId);
        }
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
     * Update team details (owner only)
     */
    @Patch(':id')
    async updateTeam(
        @Param('id') teamId: string,
        @Headers('x-user-id') userId: string,
        @Body() body: {
            name?: string;
            description?: string;
            city?: string;
            ageGroup?: string;
            gender?: string;
            skillLevel?: string;
            homeCourtId?: string;
        },
    ) {
        return this.teamsService.updateTeam(teamId, userId, body);
    }

    /**
     * Invite player to team (path-based)
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
     * Invite player to team (body-based alias)
     * Accepts { playerId: string } or { userId: string } in the request body.
     */
    @Post(':id/invite')
    @HttpCode(200)
    async invitePlayerByBody(
        @Param('id') teamId: string,
        @Headers('x-user-id') userId: string,
        @Body() body: { playerId?: string; userId?: string },
    ) {
        const targetId = body.playerId || body.userId;
        if (!targetId) {
            return { success: false, error: 'playerId or userId is required' };
        }
        await this.teamsService.invitePlayer(teamId, userId, targetId);
        return { success: true };
    }

    /**
     * Get team members (alias returning detail.members)
     */
    @Get(':id/members')
    async getTeamMembers(
        @Param('id') teamId: string,
        @Headers('x-user-id') userId: string,
    ) {
        const detail = await this.teamsService.getTeamDetail(teamId, userId);
        const members = (detail as any)?.members || [];
        // Ensure each member has team_id
        return members.map((m: any) => ({
            ...m,
            team_id: m.team_id ?? m.teamId ?? teamId,
        }));
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

    /**
     * Get team chat messages
     */
    @Get(':id/messages')
    async getTeamMessages(
        @Param('id') teamId: string,
        @Headers('x-user-id') userId: string,
    ) {
        return this.teamsService.getTeamMessages(teamId, userId);
    }

    /**
     * Send message to team chat
     */
    @Post(':id/messages')
    @HttpCode(201)
    async sendTeamMessage(
        @Param('id') teamId: string,
        @Headers('x-user-id') userId: string,
        @Body() body: { content: string },
    ) {
        return this.teamsService.sendTeamMessage(teamId, userId, body.content);
    }

    // ====================
    // TEAM CHALLENGES
    // ====================

    /**
     * Challenge another team
     */
    @Post(':id/challenge/:opponentTeamId')
    @HttpCode(201)
    async challengeTeam(
        @Param('id') teamId: string,
        @Param('opponentTeamId') opponentTeamId: string,
        @Headers('x-user-id') userId: string,
        @Body() body: { message?: string },
    ) {
        return this.teamsService.createTeamChallenge(teamId, opponentTeamId, userId, body.message);
    }

    /**
     * Get team's challenges (incoming and outgoing)
     */
    @Get(':id/challenges')
    async getTeamChallenges(
        @Param('id') teamId: string,
        @Headers('x-user-id') userId: string,
    ) {
        return this.teamsService.getTeamChallenges(teamId, userId);
    }

    /**
     * Accept a team challenge
     */
    @Post(':id/challenges/:challengeId/accept')
    @HttpCode(200)
    async acceptTeamChallenge(
        @Param('id') teamId: string,
        @Param('challengeId') challengeId: string,
        @Headers('x-user-id') userId: string,
    ) {
        return this.teamsService.acceptTeamChallenge(challengeId, teamId, userId);
    }

    /**
     * Decline a team challenge
     */
    @Post(':id/challenges/:challengeId/decline')
    @HttpCode(200)
    async declineTeamChallenge(
        @Param('id') teamId: string,
        @Param('challengeId') challengeId: string,
        @Headers('x-user-id') userId: string,
    ) {
        await this.teamsService.declineTeamChallenge(challengeId, teamId, userId);
        return { success: true };
    }

    /**
     * Cancel a team challenge
     */
    @Delete(':id/challenges/:challengeId')
    @HttpCode(200)
    async cancelTeamChallenge(
        @Param('id') teamId: string,
        @Param('challengeId') challengeId: string,
        @Headers('x-user-id') userId: string,
    ) {
        await this.teamsService.cancelTeamChallenge(challengeId, teamId, userId);
        return { success: true };
    }

    /**
     * Submit score for a team match
     */
    @Post(':id/matches/:matchId/score')
    @HttpCode(200)
    async submitTeamMatchScore(
        @Param('id') teamId: string,
        @Param('matchId') matchId: string,
        @Headers('x-user-id') userId: string,
        @Body() body: { me: number; opponent: number },
    ) {
        return this.teamsService.submitTeamMatchScore(matchId, teamId, userId, body.me, body.opponent);
    }

    /**
     * Confirm opponent's submitted score
     */
    @Post(':id/matches/:matchId/confirm')
    @HttpCode(200)
    async confirmTeamMatchScore(
        @Param('id') teamId: string,
        @Param('matchId') matchId: string,
        @Headers('x-user-id') userId: string,
    ) {
        return this.teamsService.confirmTeamMatchScore(matchId, teamId, userId);
    }

    /**
     * Amend opponent's submitted score
     */
    @Post(':id/matches/:matchId/amend')
    @HttpCode(200)
    async amendTeamMatchScore(
        @Param('id') teamId: string,
        @Param('matchId') matchId: string,
        @Headers('x-user-id') userId: string,
        @Body() body: { myScore: number; opponentScore: number },
    ) {
        return this.teamsService.amendTeamMatchScore(matchId, teamId, userId, body.myScore, body.opponentScore);
    }

    /**
     * Accept an amendment proposed by opponent
     */
    @Post(':id/matches/:matchId/confirm-amendment')
    @HttpCode(200)
    async confirmAmendment(
        @Param('id') teamId: string,
        @Param('matchId') matchId: string,
        @Headers('x-user-id') userId: string,
    ) {
        return this.teamsService.confirmAmendment(matchId, teamId, userId);
    }

    /**
     * Reject an amendment proposed by opponent
     */
    @Post(':id/matches/:matchId/reject-amendment')
    @HttpCode(200)
    async rejectAmendment(
        @Param('id') teamId: string,
        @Param('matchId') matchId: string,
        @Headers('x-user-id') userId: string,
    ) {
        return this.teamsService.rejectAmendment(matchId, teamId, userId);
    }

    // ====================
    // TEAM EVENTS (Practices & Games)
    // ====================

    /**
     * Create a team event (practice or game)
     */
    @Post(':id/events')
    @HttpCode(201)
    async createTeamEvent(
        @Param('id') teamId: string,
        @Headers('x-user-id') userId: string,
        @Body() body: {
            type: string;
            title: string;
            eventDate: string;
            endDate?: string;
            locationName?: string;
            courtId?: string;
            opponentTeamId?: string;
            opponentTeamName?: string;
            recurrenceRule?: string;
            notes?: string;
        },
    ) {
        return this.teamsService.createTeamEvent(teamId, userId, body);
    }

    /**
     * Get upcoming events for a team
     */
    @Get(':id/events')
    async getTeamEvents(
        @Param('id') teamId: string,
        @Headers('x-user-id') userId: string,
    ) {
        return this.teamsService.getTeamEvents(teamId, userId);
    }

    /**
     * Toggle attendance for a team event (IN / OUT)
     */
    @Post(':id/events/:eventId/attendance')
    @HttpCode(200)
    async toggleAttendance(
        @Param('id') teamId: string,
        @Param('eventId') eventId: string,
        @Headers('x-user-id') userId: string,
        @Body() body: { status: string },
    ) {
        return this.teamsService.toggleAttendance(teamId, eventId, userId, body.status);
    }

    /**
     * Delete a team event
     */
    @Delete(':id/events/:eventId')
    @HttpCode(200)
    async deleteTeamEvent(
        @Param('id') teamId: string,
        @Param('eventId') eventId: string,
        @Headers('x-user-id') userId: string,
    ) {
        await this.teamsService.deleteTeamEvent(teamId, eventId, userId);
        return { success: true };
    }

    /**
     * Start a match from a scheduled game event
     */
    @Post(':id/events/:eventId/start-match')
    @HttpCode(200)
    async startMatchFromEvent(
        @Param('id') teamId: string,
        @Param('eventId') eventId: string,
        @Headers('x-user-id') userId: string,
    ) {
        return this.teamsService.startMatchFromEvent(teamId, eventId, userId);
    }
}

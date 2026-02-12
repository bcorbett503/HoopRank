import { Controller, Get, Post, Put, Delete, Param, Body, Headers, HttpCode } from '@nestjs/common';
import { Public } from './auth/public.decorator';

/**
 * Root-level /me controller — provides shortcuts without the /users prefix.
 * iOS client calls /me/privacy directly.
 */
@Controller('me')
export class MeController {
    @Get('privacy')
    async getPrivacy(@Headers('x-user-id') userId: string) {
        return {
            profileVisibility: 'public',
            showLocation: true,
            showActivity: true,
            allowMessages: 'everyone',
        };
    }

    @Put('privacy')
    async updatePrivacy(
        @Headers('x-user-id') userId: string,
        @Body() body: any,
    ) {
        return { success: true, ...body };
    }
}

/**
 * Stub /invites controller — placeholder for invite-by-link flow.
 * Returns proper-shaped objects matching iOS Invite / InviteAcceptResponse models.
 */
@Controller('invites')
export class InvitesController {
    @Get()
    async getInvites(@Headers('x-user-id') userId: string) {
        return [];
    }

    @Public()
    @Get(':token')
    async getInviteByToken(@Param('token') token: string) {
        // TODO(security): Keep this route public for deep links, but validate a
        // signed invite token and load from persistent storage instead of
        // returning a synthetic placeholder object.
        // Return full Invite shape expected by iOS
        return {
            id: token,
            token,
            type: 'team',
            status: 'expired',
            created_by: null,
            team_id: null,
            team_name: null,
            expires_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            message: 'Invite not found or expired',
        };
    }

    @Post()
    @HttpCode(200)
    async createInvite(
        @Headers('x-user-id') userId: string,
        @Body() body: any,
    ) {
        // TODO(product): Persist invite metadata (creator, team, expiry, status)
        // so GET/accept can return canonical data and avoid decode drift.
        // Return proper Invite shape with generated token
        const token = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return {
            id: token,
            token,
            type: body.type || 'team',
            status: 'pending',
            created_by: userId,
            team_id: body.teamId || body.team_id || null,
            team_name: null,
            invite_url: `https://hooprank.app/invite/${token}`,
            inviteUrl: `https://hooprank.app/invite/${token}`,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString(),
        };
    }

    @Post(':token/accept')
    @HttpCode(200)
    async acceptInvite(
        @Param('token') token: string,
        @Headers('x-user-id') userId: string,
    ) {
        // TODO(security): Resolve token -> invite, enforce expiry/ownership
        // checks, and return the concrete resource IDs (team_id/match_id).
        // Return InviteAcceptResponse shape
        return {
            success: true,
            token,
            team_id: null,
            team_name: null,
            message: 'Invite accepted',
        };
    }
}

/**
 * Stub /threads controller — placeholder for threaded conversations.
 * Supports GET /:id (detail) and DELETE /:id (remove).
 */
@Controller('threads')
export class ThreadsController {
    @Get(':id')
    async getThread(
        @Param('id') id: string,
        @Headers('x-user-id') userId: string,
    ) {
        return { id, messages: [], participants: [] };
    }

    @Delete(':id')
    @HttpCode(200)
    async deleteThread(
        @Param('id') id: string,
        @Headers('x-user-id') userId: string,
    ) {
        return { success: true };
    }
}

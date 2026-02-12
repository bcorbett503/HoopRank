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
 * Supports GET (list), GET /:token (public), POST (create), POST /:token/accept.
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
        return { token, status: 'not_found', message: 'Invite not found or expired' };
    }

    @Post()
    @HttpCode(200)
    async createInvite(
        @Headers('x-user-id') userId: string,
        @Body() body: any,
    ) {
        return { success: false, message: 'Invites not yet implemented' };
    }

    @Post(':token/accept')
    @HttpCode(200)
    async acceptInvite(
        @Param('token') token: string,
        @Headers('x-user-id') userId: string,
    ) {
        return { success: false, message: 'Invite not found or expired' };
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

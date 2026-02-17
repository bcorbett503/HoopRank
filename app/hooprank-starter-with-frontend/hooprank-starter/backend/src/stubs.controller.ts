import { Controller, Get, Put, Delete, Param, Body, Headers, HttpCode } from '@nestjs/common';

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

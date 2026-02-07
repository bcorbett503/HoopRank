import { Controller, Post, Body, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Upload controller handles image uploads from the mobile app.
 * The mobile sends base64-encoded image data as JSON, not multipart.
 * This endpoint stores the image data URL directly in the relevant table.
 * 
 * Supported types:
 *   - 'profile' / 'avatar': Updates user's avatar_url
 *   - 'team': Updates team's logo_url
 */
@Controller()
export class UploadController {
    constructor(private dataSource: DataSource) { }

    @Post('upload')
    async uploadImage(
        @Headers('x-user-id') userId: string,
        @Body() body: { type: string; targetId: string; imageData: string },
    ) {
        if (!userId) {
            throw new HttpException('Unauthorized: x-user-id header required', HttpStatus.UNAUTHORIZED);
        }

        const { type, targetId, imageData } = body;

        if (!type || !targetId || !imageData) {
            throw new HttpException('Missing required fields: type, targetId, imageData', HttpStatus.BAD_REQUEST);
        }

        try {
            switch (type) {
                case 'profile':
                case 'avatar': {
                    await this.dataSource.query(
                        `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`,
                        [imageData, targetId],
                    );
                    return { success: true, type, targetId, message: 'Avatar updated' };
                }

                case 'team': {
                    // Update team logo
                    await this.dataSource.query(
                        `UPDATE teams SET logo_url = $1, updated_at = NOW() WHERE id = $2`,
                        [imageData, targetId],
                    );
                    return { success: true, type, targetId, message: 'Team logo updated' };
                }

                default:
                    throw new HttpException(`Unknown upload type: ${type}`, HttpStatus.BAD_REQUEST);
            }
        } catch (error) {
            if (error instanceof HttpException) throw error;
            console.error('[Upload] Error:', error.message);
            throw new HttpException(
                `Upload failed: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}

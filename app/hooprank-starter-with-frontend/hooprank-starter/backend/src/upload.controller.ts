import { Controller, Post, Body, Headers, HttpException, HttpStatus, Inject, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';

/**
 * Upload controller handles image uploads from the mobile app.
 * The mobile sends base64-encoded image data as JSON.
 * 
 * When Firebase Storage is available, images are uploaded to Storage
 * and the download URL is stored in the database.
 * 
 * When Firebase is unavailable (dev mode), falls back to storing
 * the base64 data URL directly in the database.
 * 
 * Supported types:
 *   - 'profile' / 'avatar': Updates user's avatar_url
 *   - 'team': Updates team's logo_url
 */
@Controller()
export class UploadController {
    constructor(
        private dataSource: DataSource,
        @Optional() @Inject('FIREBASE_APP') private firebaseApp: admin.app.App | null,
    ) { }

    /**
     * Upload base64 image to Firebase Storage and return the public URL.
     * Falls back to returning the data URL if Firebase Storage is unavailable.
     */
    private async uploadToStorage(
        imageData: string,
        folder: string,
        filename: string,
    ): Promise<string> {
        // If Firebase is not initialized, fall back to base64 data URL
        if (!this.firebaseApp || !admin.apps?.length) {
            console.log('[Upload] Firebase unavailable, storing base64 data URL');
            return imageData;
        }

        try {
            const bucket = admin.storage().bucket();

            // Parse the data URL: data:image/png;base64,iVBOR...
            const match = imageData.match(/^data:(image\/\w+);base64,(.+)$/);
            if (!match) {
                console.log('[Upload] Could not parse data URL, storing as-is');
                return imageData;
            }

            const mimeType = match[1];
            const base64Data = match[2];
            const buffer = Buffer.from(base64Data, 'base64');
            const extension = mimeType === 'image/png' ? 'png' : 'jpg';

            const filePath = `${folder}/${filename}.${extension}`;
            const file = bucket.file(filePath);

            // Upload with public read access
            await file.save(buffer, {
                metadata: {
                    contentType: mimeType,
                    metadata: {
                        firebaseStorageDownloadTokens: uuidv4(),
                    },
                },
                public: true,
            });

            // Get the public URL
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
            console.log(`[Upload] Uploaded to Firebase Storage: ${publicUrl}`);
            return publicUrl;
        } catch (error) {
            console.error('[Upload] Firebase Storage upload failed, falling back to base64:', error.message);
            return imageData;
        }
    }

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
        if (imageData.length > 12_000_000) {
            throw new HttpException('Image payload too large', HttpStatus.PAYLOAD_TOO_LARGE);
        }
        if (!imageData.startsWith('data:image/png;base64,') && !imageData.startsWith('data:image/jpeg;base64,')) {
            throw new HttpException('Unsupported image type', HttpStatus.BAD_REQUEST);
        }

        try {
            switch (type) {
                case 'profile':
                case 'avatar': {
                    if (targetId !== userId) {
                        throw new HttpException('Forbidden: cannot update another user avatar', HttpStatus.FORBIDDEN);
                    }
                    const url = await this.uploadToStorage(
                        imageData,
                        'avatars',
                        `${userId}_${Date.now()}`,
                    );
                    await this.dataSource.query(
                        `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`,
                        [url, targetId],
                    );
                    return { success: true, type, targetId, url, message: 'Avatar updated' };
                }

                case 'team': {
                    // Team logos can only be changed by owners or active members.
                    const membership = await this.dataSource.query(`
                        SELECT 1
                        FROM team_members tm
                        WHERE tm.team_id::TEXT = $1::TEXT
                          AND tm.user_id::TEXT = $2::TEXT
                          AND tm.status = 'active'
                        LIMIT 1
                    `, [targetId, userId]);
                    const ownership = await this.dataSource.query(`
                        SELECT 1
                        FROM teams t
                        WHERE t.id::TEXT = $1::TEXT
                          AND t.owner_id::TEXT = $2::TEXT
                        LIMIT 1
                    `, [targetId, userId]);
                    if (membership.length === 0 && ownership.length === 0) {
                        throw new HttpException('Forbidden: team access denied', HttpStatus.FORBIDDEN);
                    }
                    const url = await this.uploadToStorage(
                        imageData,
                        'team-logos',
                        `${targetId}_${Date.now()}`,
                    );
                    await this.dataSource.query(
                        `UPDATE teams SET logo_url = $1, updated_at = NOW() WHERE id = $2`,
                        [url, targetId],
                    );
                    return { success: true, type, targetId, url, message: 'Team logo updated' };
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

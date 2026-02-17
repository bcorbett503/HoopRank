import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

/**
 * DTO for POST /statuses — create a new status post.
 */
export class CreateStatusDto {
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    content: string = '';

    @IsOptional()
    @IsString()
    imageUrl?: string;

    @IsOptional()
    @IsString()
    scheduledAt?: string;

    @IsOptional()
    isRecurring?: boolean;

    @IsOptional()
    @IsString()
    courtId?: string;

    @IsOptional()
    @IsString()
    videoUrl?: string;

    @IsOptional()
    @IsString()
    videoThumbnailUrl?: string;

    @IsOptional()
    videoDurationMs?: number;

    @IsOptional()
    @IsString()
    gameMode?: string;

    @IsOptional()
    @IsString()
    courtType?: string;

    @IsOptional()
    @IsString()
    ageRange?: string;

    @IsOptional()
    @IsString()
    tagMode?: string;

    @IsOptional()
    taggedPlayerIds?: string[];
}

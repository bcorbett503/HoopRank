import { IsISO8601, IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * DTO for POST /challenges — create a 1v1 challenge.
 */
export class CreateChallengeDto {
    @IsString()
    @IsNotEmpty()
    toUserId: string;

    @IsOptional()
    @IsString()
    message?: string;

    @IsOptional()
    @IsString()
    courtId?: string;

    @IsOptional()
    @IsISO8601()
    scheduledAt?: string;
}

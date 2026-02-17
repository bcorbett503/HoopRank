import { IsInt, Min, IsOptional, IsString } from 'class-validator';

/**
 * DTO for POST /api/v1/matches/:id/score — submit match score.
 */
export class SubmitScoreDto {
    @IsInt()
    @Min(0)
    me: number;

    @IsInt()
    @Min(0)
    opponent: number;

    @IsOptional()
    @IsString()
    courtId?: string;
}

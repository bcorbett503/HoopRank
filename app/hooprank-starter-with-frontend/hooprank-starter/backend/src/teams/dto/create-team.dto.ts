import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

/**
 * DTO for POST /teams — create a new team.
 * Accepts both teamType (camelCase) and team_type (snake_case) for iOS compat.
 */
export class CreateTeamDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    @IsIn(['3v3', '5v5'])
    teamType?: string;

    @IsOptional()
    @IsString()
    @IsIn(['3v3', '5v5'])
    team_type?: string;

    @IsOptional()
    @IsString()
    ageGroup?: string;

    @IsOptional()
    @IsString()
    gender?: string;

    @IsOptional()
    @IsString()
    skillLevel?: string;

    @IsOptional()
    @IsString()
    homeCourtId?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    description?: string;
}

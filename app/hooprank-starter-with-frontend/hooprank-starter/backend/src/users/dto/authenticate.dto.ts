import { IsString, IsOptional, IsEmail } from 'class-validator';

/**
 * DTO for POST /users/auth — Firebase authentication bootstrap.
 */
export class AuthenticateDto {
    @IsString()
    id: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    photoUrl?: string;

    @IsOptional()
    @IsString()
    provider?: string;

    @IsOptional()
    @IsString()
    firebaseToken?: string;

    @IsOptional()
    @IsString()
    idToken?: string;
}

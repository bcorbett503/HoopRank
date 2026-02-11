import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as admin from 'firebase-admin';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly configService: ConfigService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);
        const allowInsecureAuth = this.configService.get<string>('ALLOW_INSECURE_AUTH') === 'true';

        if (!token) {
            // Explicitly opt-in dev fallback only; never enabled by default.
            if (allowInsecureAuth) {
                const fallbackUid = request.headers['x-user-id'] || request.body?.id;
                if (!fallbackUid) {
                    throw new UnauthorizedException('Missing authentication token');
                }
                request.headers['x-user-id'] = String(fallbackUid);
                request['user'] = { uid: fallbackUid, email: request.body?.email || '' };
                return this.enforceAdminForSensitiveRoutes(request, String(fallbackUid));
            }
            throw new UnauthorizedException('Missing authentication token');
        }

        if (admin.apps.length === 0) {
            // Fail closed in secure mode when Firebase is unavailable.
            if (!allowInsecureAuth) {
                throw new UnauthorizedException('Authentication service unavailable');
            }
            const fallbackUid = request.headers['x-user-id'] || request.body?.id;
            if (!fallbackUid) {
                throw new UnauthorizedException('Authentication service unavailable');
            }
            request.headers['x-user-id'] = String(fallbackUid);
            request['user'] = { uid: fallbackUid, email: request.body?.email || '' };
            return this.enforceAdminForSensitiveRoutes(request, String(fallbackUid));
        }

        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            const uid = decodedToken.uid;

            // Never trust caller-supplied user identifiers that do not match token subject.
            const headerUid = this.normalizeHeaderValue(request.headers['x-user-id']);
            if (headerUid && headerUid !== uid) {
                throw new UnauthorizedException('x-user-id does not match authenticated user');
            }
            if (!headerUid) {
                request.headers['x-user-id'] = uid;
            }

            request['user'] = decodedToken;
            return this.enforceAdminForSensitiveRoutes(request, uid);
        } catch (error) {
            if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
                throw error;
            }
            throw new UnauthorizedException('Invalid authentication token');
        }
    }

    private extractTokenFromHeader(request: any): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }

    private normalizeHeaderValue(value: unknown): string | undefined {
        if (!value) return undefined;
        if (Array.isArray(value)) return value[0] ? String(value[0]) : undefined;
        return String(value);
    }

    private enforceAdminForSensitiveRoutes(request: any, uid: string): boolean {
        const rawPath = String(request.path || request.originalUrl || '').toLowerCase();
        const sensitivePrefixes = ['admin', 'debug', 'migrate', 'seed', 'cleanup'];
        const segments = rawPath.split('/').filter(Boolean);
        const isSensitive = segments.some((segment) =>
            sensitivePrefixes.some((prefix) => segment === prefix || segment.startsWith(`${prefix}-`)),
        );

        if (!isSensitive) {
            return true;
        }

        const adminIdsRaw = this.configService.get<string>('ADMIN_USER_IDS') || '';
        const adminIds = adminIdsRaw
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id.length > 0);
        const isAdminUser = adminIds.includes(uid);

        const configuredSecret = this.configService.get<string>('ADMIN_SECRET') || '';
        const providedSecret = this.normalizeHeaderValue(request.headers['x-admin-secret']) || '';
        const hasValidSecret = configuredSecret.length > 0 && providedSecret === configuredSecret;

        if (!isAdminUser && !hasValidSecret) {
            throw new ForbiddenException('Admin privileges required');
        }
        return true;
    }
}

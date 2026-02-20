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
import { IS_ADMIN_KEY } from './admin.decorator';

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

        const configuredSecret = this.configService.get<string>('ADMIN_SECRET') || '';
        const providedSecret = this.normalizeHeaderValue(request.headers['x-admin-secret']) || '';
        const hasValidSecret = configuredSecret.length > 0 && providedSecret === configuredSecret;

        if (!token) {
            // Bypass Bearer token requirement if a valid ADMIN_SECRET is provided
            if (hasValidSecret) {
                const fallbackUid = request.headers['x-user-id'] || request.body?.id || 'admin-user';
                request.headers['x-user-id'] = String(fallbackUid);
                request['user'] = { uid: fallbackUid, email: request.body?.email || '' };
                return true; // Fast-path success for admin secret
            }

            // No Bearer token — reject unless dev-mode is explicitly enabled.
            // The mobile app always sends a Firebase ID token; there is no
            // legitimate production scenario where x-user-id alone is sufficient.
            if (allowInsecureAuth) {
                const fallbackUid = request.body?.id;
                if (!fallbackUid) {
                    throw new UnauthorizedException('Missing authentication token');
                }
                request.headers['x-user-id'] = String(fallbackUid);
                request['user'] = { uid: fallbackUid, email: request.body?.email || '' };
                return this.enforceAdminForSensitiveRoutes(request, String(fallbackUid), context);
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
            return this.enforceAdminForSensitiveRoutes(request, String(fallbackUid), context);
        }

        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            const uid = decodedToken.uid;

            // Never trust caller-supplied user identifiers that do not match token subject.
            const headerUid = this.normalizeHeaderValue(request.headers['x-user-id']);
            const allowHeaderNormalization = this.configService.get<string>('ALLOW_HEADER_NORMALIZATION') === 'true';
            if (headerUid && headerUid !== uid) {
                if (allowHeaderNormalization) {
                    // Compatibility mode: normalize to token uid and audit-log the mismatch.
                    console.warn(`[AUTH_AUDIT] x-user-id mismatch: header=${headerUid} token=${uid} path=${request.path} — normalized to token uid`);
                    request.headers['x-user-id'] = uid;
                } else {
                    throw new UnauthorizedException('x-user-id does not match authenticated user');
                }
            }
            if (!headerUid) {
                request.headers['x-user-id'] = uid;
            }

            request['user'] = decodedToken;
            return this.enforceAdminForSensitiveRoutes(request, uid, context);
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

    private enforceAdminForSensitiveRoutes(request: any, uid: string, context?: ExecutionContext): boolean {
        // Primary: check explicit @AdminOnly decorator metadata.
        let isAdminRoute = false;
        if (context) {
            isAdminRoute = this.reflector.getAllAndOverride<boolean>(IS_ADMIN_KEY, [
                context.getHandler(),
                context.getClass(),
            ]) ?? false;
        }

        // Fallback: path-prefix detection as a safety net for routes that may
        // not yet carry explicit metadata.
        const rawPath = String(request.path || request.originalUrl || '').toLowerCase();
        const sensitivePrefixes = ['admin', 'debug', 'migrate', 'seed', 'cleanup'];
        const segments = rawPath.split('/').filter(Boolean);
        const isSensitive = isAdminRoute || segments.some((segment) =>
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

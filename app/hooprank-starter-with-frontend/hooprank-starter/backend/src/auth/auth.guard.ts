import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class AuthGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);
        console.log(`[AuthGuard] Checking token: ${token ? 'Found' : 'Missing'}`);

        if (!token) {
            throw new UnauthorizedException();
        }

        // Allow dev token for testing
        if (token === 'dev-token') {
            request['user'] = { uid: 'dev-user-id', email: 'dev@example.com' };
            return true;
        }

        try {
            // Check if Firebase is initialized
            if (admin.apps.length === 0) {
                console.log('[AuthGuard] Firebase not initialized - allowing request with x-user-id or body.id');
                // Allow request to proceed - controller will use body.id
                request['user'] = { uid: request.body?.id || request.headers['x-user-id'], email: '' };
                return true;
            }

            const decodedToken = await admin.auth().verifyIdToken(token);
            request['user'] = decodedToken;
            return true;
        } catch (error) {
            console.log('[AuthGuard] Token verification failed:', error.message);
            // If Firebase verification fails but we have a user id, allow the request
            const fallbackUid = request.body?.id || request.headers['x-user-id'];
            if (fallbackUid) {
                console.log('[AuthGuard] Falling back to uid from request:', fallbackUid);
                request['user'] = { uid: fallbackUid, email: request.body?.email || '' };
                return true;
            }
            throw new UnauthorizedException();
        }
    }

    private extractTokenFromHeader(request: any): string | undefined {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }
}

import { CanActivate, ExecutionContext, Injectable, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from './subscription.service';

export const IS_PREMIUM_KEY = 'isPremium';

/**
 * Decorator to mark an endpoint as premium-only.
 * Usage: @Premium() on any controller method.
 *
 * Currently feature-flagged OFF — all requests pass through.
 * Set ENFORCE_PREMIUM=true in env to activate.
 */
export const Premium = () => SetMetadata(IS_PREMIUM_KEY, true);

@Injectable()
export class PremiumGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly subscriptionService: SubscriptionService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPremium = this.reflector.getAllAndOverride<boolean>(IS_PREMIUM_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!isPremium) return true;

        // Feature flag: disable premium gating until payment integration
        const enforced = process.env.ENFORCE_PREMIUM === 'true';
        if (!enforced) return true;

        const request = context.switchToHttp().getRequest();
        const userId = request.headers['x-user-id'];
        if (!userId) throw new ForbiddenException('Authentication required');

        const isSubscriber = await this.subscriptionService.isSubscriber(userId);
        if (!isSubscriber) {
            throw new ForbiddenException('Premium subscription required for this feature');
        }

        return true;
    }
}

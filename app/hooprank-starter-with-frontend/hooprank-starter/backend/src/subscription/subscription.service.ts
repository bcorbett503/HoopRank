import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Subscription service — determines user tier and feature limits.
 * Currently returns free-tier defaults for all users.
 * Will be connected to payment provider (Stripe/RevenueCat) in a future sprint.
 */
@Injectable()
export class SubscriptionService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepo: Repository<User>,
    ) { }

    /**
     * Check if a user has an active paid subscription.
     */
    async isSubscriber(userId: string): Promise<boolean> {
        const user = await this.usersRepo.findOne({ where: { id: userId } });
        if (!user) return false;
        if (user.subscriptionTier === 'free') return false;
        if (user.subscriptionExpiresAt && user.subscriptionExpiresAt < new Date()) return false;
        return true;
    }

    /**
     * Get tier-specific feature limits for a user.
     */
    async getSubscriptionLimits(userId: string): Promise<{
        tier: string;
        maxTeams: number;
        canCreatePrivateRuns: boolean;
        adFree: boolean;
    }> {
        const user = await this.usersRepo.findOne({ where: { id: userId } });
        const tier = user?.subscriptionTier || 'free';

        const limits = {
            free: { tier: 'free', maxTeams: 3, canCreatePrivateRuns: false, adFree: false },
            pro: { tier: 'pro', maxTeams: 10, canCreatePrivateRuns: true, adFree: true },
            elite: { tier: 'elite', maxTeams: 25, canCreatePrivateRuns: true, adFree: true },
        };

        return limits[tier] || limits.free;
    }
}

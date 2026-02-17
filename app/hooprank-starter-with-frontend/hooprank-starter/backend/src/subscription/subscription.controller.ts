import { Controller, Get, Headers } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';

/**
 * Subscription endpoints — placeholder for future payment integration.
 * Currently returns free-tier data for all users.
 */
@Controller('subscription')
export class SubscriptionController {
    constructor(private readonly subscriptionService: SubscriptionService) { }

    /**
     * GET /subscription/status — returns the user's current subscription tier and limits.
     * The mobile app reads this to determine feature availability.
     */
    @Get('status')
    async getStatus(@Headers('x-user-id') userId: string) {
        if (!userId) {
            return { tier: 'free', maxTeams: 3, canCreatePrivateRuns: false, adFree: false };
        }
        const limits = await this.subscriptionService.getSubscriptionLimits(userId);
        const isSubscriber = await this.subscriptionService.isSubscriber(userId);
        return { ...limits, isSubscriber };
    }
}

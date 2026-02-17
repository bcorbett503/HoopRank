import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { PremiumGuard } from './premium.guard';

@Module({
    imports: [TypeOrmModule.forFeature([User])],
    controllers: [SubscriptionController],
    providers: [SubscriptionService, PremiumGuard],
    exports: [SubscriptionService, PremiumGuard],
})
export class SubscriptionModule { }

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatusesController } from './statuses.controller';
import { StatusesService } from './statuses.service';
import { PlayerStatus, StatusLike, StatusComment, EventAttendee, UserFollowedCourt, UserFollowedPlayer, CheckIn } from './status.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([PlayerStatus, StatusLike, StatusComment, EventAttendee, UserFollowedCourt, UserFollowedPlayer, CheckIn]),
        NotificationsModule,
        forwardRef(() => UsersModule),
    ],
    controllers: [StatusesController],
    providers: [StatusesService],
    exports: [StatusesService],
})
export class StatusesModule { }



import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatusesController } from './statuses.controller';
import { StatusesService } from './statuses.service';
import { PlayerStatus, StatusLike, StatusComment, EventAttendee, UserFollowedCourt, UserFollowedPlayer, CheckIn } from './status.entity';

@Module({
    imports: [TypeOrmModule.forFeature([PlayerStatus, StatusLike, StatusComment, EventAttendee, UserFollowedCourt, UserFollowedPlayer, CheckIn])],
    controllers: [StatusesController],
    providers: [StatusesService],
    exports: [StatusesService],
})
export class StatusesModule { }

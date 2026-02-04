import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourtsController } from './courts.controller';
import { CourtsService } from './courts.service';
import { MatchesModule } from '../matches/matches.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Court } from './court.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Court]),
        MatchesModule,
        UsersModule,
        NotificationsModule,
    ],
    controllers: [CourtsController],
    providers: [CourtsService],
    exports: [CourtsService],
})
export class CourtsModule { }

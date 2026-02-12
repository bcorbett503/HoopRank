import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesService } from './matches.service';
import { MatchesController, MatchesAliasController } from './matches.controller';
import { UsersModule } from '../users/users.module';
import { MessagesModule } from '../messages/messages.module';
import { Match } from './match.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Match]),
    UsersModule,
    MessagesModule,
    NotificationsModule,
  ],
  controllers: [MatchesController, MatchesAliasController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule { }

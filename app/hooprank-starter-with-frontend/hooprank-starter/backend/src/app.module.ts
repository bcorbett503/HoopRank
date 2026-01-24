import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MatchesModule } from './matches/matches.module';
import { UsersModule } from './users/users.module';
import { CourtsModule } from './courts/courts.module';
import { User } from './users/user.entity';
import { Court } from './courts/court.entity';
import { Match } from './matches/match.entity';
import { Message } from './messages/message.entity';
import { FirebaseModule } from './auth/firebase.module';
import { MessagesModule } from './messages/messages.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'hooprank.db',
      entities: [User, Court, Match, Message],
      synchronize: true, // Auto-create tables (dev only)
    }),
    MatchesModule,
    UsersModule,
    CourtsModule,
    MessagesModule,
    FirebaseModule,
    NotificationsModule,
  ],
})
export class AppModule { }

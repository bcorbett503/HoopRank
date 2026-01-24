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
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');

        if (databaseUrl) {
          // Production: Use PostgreSQL
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [User, Court, Match, Message],
            synchronize: false, // Don't auto-sync in production
            ssl: false, // Railway internal connection doesn't need SSL
          };
        } else {
          // Development: Use SQLite
          return {
            type: 'better-sqlite3',
            database: 'hooprank.db',
            entities: [User, Court, Match, Message],
            synchronize: true,
          } as any;
        }
      },
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


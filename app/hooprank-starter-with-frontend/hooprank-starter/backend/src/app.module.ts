import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MatchesModule } from './matches/matches.module';
import { UsersModule } from './users/users.module';
import { CourtsModule } from './courts/courts.module';
import { StatusesModule } from './statuses/statuses.module';
import { TeamsModule } from './teams/teams.module';
import { User } from './users/user.entity';
import { Court } from './courts/court.entity';
import { Match } from './matches/match.entity';
import { Message } from './messages/message.entity';
import { Team, TeamMember, TeamMessage } from './teams/team.entity';
import { PlayerStatus, StatusLike, StatusComment, EventAttendee, UserFollowedCourt, UserFollowedPlayer, CheckIn } from './statuses/status.entity';
import { FirebaseModule } from './auth/firebase.module';
import { MessagesModule } from './messages/messages.module';
import { ChallengesModule } from './challenges/challenges.module';
import { Challenge } from './challenges/challenge.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { ActivityModule } from './activity/activity.module';
import { RankingsModule } from './rankings/rankings.module';
import { RunsModule } from './runs/runs.module';
import { HealthController } from './health.controller';
import { SnakeNamingStrategy } from './snake-naming.strategy';

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
          // Production: Use PostgreSQL with snake_case naming
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [User, Court, Match, Message, Challenge, Team, TeamMember, TeamMessage, PlayerStatus, StatusLike, StatusComment, EventAttendee, UserFollowedCourt, UserFollowedPlayer, CheckIn],
            synchronize: false, // Disabled for production - use migrations instead
            ssl: false, // Railway internal connection doesn't need SSL
            namingStrategy: new SnakeNamingStrategy(),
          };
        } else {
          // Development: Use SQLite
          return {
            type: 'better-sqlite3',
            database: 'hooprank.db',
            entities: [User, Court, Match, Message, Challenge, Team, TeamMember, TeamMessage, PlayerStatus, StatusLike, StatusComment, EventAttendee, UserFollowedCourt, UserFollowedPlayer, CheckIn],
            synchronize: true,
          } as any;
        }
      },
    }),
    MatchesModule,
    UsersModule,
    CourtsModule,
    StatusesModule,
    TeamsModule,
    MessagesModule,
    ChallengesModule,
    FirebaseModule,
    NotificationsModule,
    ActivityModule,
    RankingsModule,
    RunsModule,
  ],
  controllers: [HealthController],
})
export class AppModule { }


import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { MatchesModule } from './matches/matches.module';

@Module({
  imports: [UsersModule, MatchesModule],
})
export class AppModule {}

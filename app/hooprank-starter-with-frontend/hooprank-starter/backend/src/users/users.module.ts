import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { TeamsModule } from '../teams/teams.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), NotificationsModule, forwardRef(() => TeamsModule)],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule { }


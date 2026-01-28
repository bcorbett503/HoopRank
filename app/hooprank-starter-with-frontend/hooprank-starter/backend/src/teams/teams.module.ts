import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team, TeamMember, TeamMessage } from './team.entity';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { User } from '../users/user.entity';
import { MessagesModule } from '../messages/messages.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Team, TeamMember, TeamMessage, User]),
        forwardRef(() => MessagesModule),
        NotificationsModule,
    ],
    controllers: [TeamsController],
    providers: [TeamsService],
    exports: [TeamsService],
})
export class TeamsModule { }

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team, TeamMember } from './team.entity';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { User } from '../users/user.entity';
import { MessagesModule } from '../messages/messages.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Team, TeamMember, User]),
        forwardRef(() => MessagesModule),
    ],
    controllers: [TeamsController],
    providers: [TeamsService],
    exports: [TeamsService],
})
export class TeamsModule { }

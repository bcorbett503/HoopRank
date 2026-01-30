import { Module, forwardRef } from '@nestjs/common';
import { ChallengesController } from './challenges.controller';
import { MessagesModule } from '../messages/messages.module';

@Module({
    imports: [forwardRef(() => MessagesModule)],
    controllers: [ChallengesController],
    providers: [],
    exports: [],
})
export class ChallengesModule { }

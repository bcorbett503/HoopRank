import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';
import { Challenge } from './challenge.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Challenge])],
    controllers: [ChallengesController],
    providers: [ChallengesService],
    exports: [ChallengesService],
})
export class ChallengesModule { }

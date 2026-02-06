import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { ScheduledRun, RunAttendee } from './scheduled-run.entity';

@Module({
    imports: [TypeOrmModule.forFeature([ScheduledRun, RunAttendee])],
    controllers: [RunsController],
    providers: [RunsService],
    exports: [RunsService],
})
export class RunsModule { }

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { User } from '../users/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([User])],
    providers: [NotificationsService],
    exports: [NotificationsService],
})
export class NotificationsModule { }

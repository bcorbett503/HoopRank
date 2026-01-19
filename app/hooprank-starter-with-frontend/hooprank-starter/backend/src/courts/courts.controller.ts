import { Controller, Get, Param } from '@nestjs/common';
import { CourtsService } from './courts.service';
import { Court } from './court.entity';

@Controller('courts')
export class CourtsController {
    constructor(private readonly courtsService: CourtsService) { }

    @Get()
    async findAll(): Promise<Court[]> {
        return this.courtsService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: string): Promise<Court | undefined> {
        return this.courtsService.findById(id);
    }
}

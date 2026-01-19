import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Court } from './court.entity';
import { MatchesService } from '../matches/matches.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class CourtsService implements OnModuleInit {
    constructor(
        @InjectRepository(Court)
        private courtsRepository: Repository<Court>,
        private readonly matchesService: MatchesService,
        private readonly usersService: UsersService
    ) { }

    async onModuleInit() {
        await this.seedCourts();
    }

    private async seedCourts() {
        const count = await this.courtsRepository.count();
        if (count > 0) return;

        try {
            const dataPath = path.join(__dirname, '..', 'courts-us-popular.json');
            const rawData = fs.readFileSync(dataPath, 'utf8');
            const json = JSON.parse(rawData);

            const courts = json.map((item: any) => {
                return this.courtsRepository.create({
                    name: item.name || 'Unknown Court',
                    lat: item.lat,
                    lng: item.lng,
                    address: item.city || item.address,
                });
            });

            await this.courtsRepository.save(courts);
            console.log(`Seeded ${courts.length} courts`);
        } catch (error) {
            console.error('Error seeding courts:', error);
        }
    }

    async findAll(): Promise<Court[]> {
        const courts = await this.courtsRepository.find();
        // TODO: optimize king calculation to not be N+1
        return Promise.all(courts.map(async c => ({
            ...c,
            king: await this.calculateKing(c.id)
        })));
    }

    async findById(id: string): Promise<Court | undefined> {
        const court = await this.courtsRepository.findOne({ where: { id } });
        if (!court) return undefined;
        return { ...court, king: await this.calculateKing(id) } as any;
    }

    private async calculateKing(courtId: string): Promise<string | undefined> {
        // This logic needs to be updated to use DB queries instead of in-memory filtering
        // For now, let's keep it simple or skip it until MatchesService is fully updated
        // to support querying by court.

        // Temporary: return undefined to avoid breaking
        return undefined;
    }
}

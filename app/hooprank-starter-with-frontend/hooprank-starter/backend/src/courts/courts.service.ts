import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
        private readonly usersService: UsersService,
        private dataSource: DataSource,
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

    // ==================== CHECK-IN METHODS ====================

    async checkIn(userId: number, courtId: string): Promise<any> {
        // First check-out from any existing check-ins at other courts
        await this.dataSource.query(`
            UPDATE court_check_ins 
            SET checked_out_at = NOW() 
            WHERE user_id = $1 AND checked_out_at IS NULL
        `, [userId]);

        // Create new check-in
        const result = await this.dataSource.query(`
            INSERT INTO court_check_ins (user_id, court_id, checked_in_at)
            VALUES ($1, $2, NOW())
            RETURNING id, checked_in_at as "checkedInAt"
        `, [userId, courtId]);

        return result[0];
    }

    async checkOut(userId: number, courtId: string): Promise<void> {
        await this.dataSource.query(`
            UPDATE court_check_ins 
            SET checked_out_at = NOW() 
            WHERE user_id = $1 AND court_id = $2 AND checked_out_at IS NULL
        `, [userId, courtId]);
    }

    async getCourtActivity(courtId: string, hoursBack: number = 24): Promise<any[]> {
        const result = await this.dataSource.query(`
            SELECT 
                ci.id,
                ci.user_id as "userId",
                u.display_name as "userName",
                u.avatar_url as "userPhotoUrl",
                ci.checked_in_at as "checkedInAt",
                ci.checked_out_at as "checkedOutAt"
            FROM court_check_ins ci
            JOIN users u ON ci.user_id = u.id
            WHERE ci.court_id = $1 
              AND ci.checked_in_at > NOW() - INTERVAL '${hoursBack} hours'
            ORDER BY ci.checked_in_at DESC
            LIMIT 50
        `, [courtId]);

        return result;
    }

    async getActiveCheckIns(courtId: string): Promise<any[]> {
        const result = await this.dataSource.query(`
            SELECT 
                ci.id,
                ci.user_id as "userId",
                u.display_name as "userName",
                u.avatar_url as "userPhotoUrl",
                ci.checked_in_at as "checkedInAt"
            FROM court_check_ins ci
            JOIN users u ON ci.user_id = u.id
            WHERE ci.court_id = $1 AND ci.checked_out_at IS NULL
            ORDER BY ci.checked_in_at DESC
        `, [courtId]);

        return result;
    }
}

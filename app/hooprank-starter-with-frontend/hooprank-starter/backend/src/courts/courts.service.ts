import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Court } from './court.entity';
import { MatchesService } from '../matches/matches.service';
import { UsersService } from '../users/users.service';
import { DbDialect } from '../common/db-utils';

@Injectable()
export class CourtsService {
    private dialect: DbDialect;

    constructor(
        @InjectRepository(Court)
        private courtsRepository: Repository<Court>,
        private readonly matchesService: MatchesService,
        private readonly usersService: UsersService,
        private dataSource: DataSource,
    ) {
        this.dialect = new DbDialect(dataSource);
    }

    // Note: Courts are seeded via scripts/seed-courts.ts
    // Run: npx ts-node scripts/seed-courts.ts
    // For production: DATABASE_URL="..." npx ts-node scripts/seed-courts.ts

    async findAll(): Promise<Court[]> {
        const courts = await this.courtsRepository.find({
            order: { name: 'ASC' }
        });
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

    async searchByLocation(lat: number, lng: number, radiusMiles: number = 25): Promise<Court[]> {
        // Simple distance calculation using Haversine approximation
        // 1 degree of latitude ≈ 69 miles
        const latDelta = radiusMiles / 69;
        const lngDelta = radiusMiles / (69 * Math.cos(lat * Math.PI / 180));

        return this.courtsRepository.createQueryBuilder('court')
            .where('court.lat BETWEEN :latMin AND :latMax', {
                latMin: lat - latDelta,
                latMax: lat + latDelta
            })
            .andWhere('court.lng BETWEEN :lngMin AND :lngMax', {
                lngMin: lng - lngDelta,
                lngMax: lng + lngDelta
            })
            .orderBy('court.score', 'DESC', 'NULLS LAST')
            .limit(100)
            .getMany();
    }

    private async calculateKing(courtId: string): Promise<string | undefined> {
        // This logic needs to be updated to use DB queries instead of in-memory filtering
        // For now, return undefined to avoid breaking
        return undefined;
    }

    // ==================== CHECK-IN METHODS ====================

    async checkIn(userId: string, courtId: string): Promise<any> {
        const d = this.dialect.reset();

        // First check-out from any existing check-ins at other courts
        await this.dataSource.query(`
            UPDATE check_ins 
            SET checked_out_at = ${d.now()} 
            WHERE ${d.cast('user_id', 'TEXT')} = ${d.param()} AND checked_out_at IS NULL
        `, [userId]);

        // Create new check-in
        const insertQuery = d.isPostgres
            ? `INSERT INTO check_ins (user_id, court_id, checked_in_at)
               VALUES ($1, $2, NOW())
               RETURNING id, checked_in_at as "checkedInAt"`
            : `INSERT INTO check_ins (user_id, court_id, checked_in_at)
               VALUES (?, ?, datetime('now'))`;

        const result = await this.dataSource.query(insertQuery, [userId, courtId]);

        if (!d.isPostgres) {
            // SQLite doesn't support RETURNING, fetch the inserted record
            const inserted = await this.dataSource.query(
                `SELECT id, checked_in_at as "checkedInAt" FROM check_ins 
                 WHERE user_id = ? AND court_id = ? ORDER BY id DESC LIMIT 1`,
                [userId, courtId]
            );
            return inserted[0];
        }

        return result[0];
    }

    async checkOut(userId: string, courtId: string): Promise<void> {
        const d = this.dialect.reset();
        await this.dataSource.query(`
            UPDATE check_ins 
            SET checked_out_at = ${d.now()} 
            WHERE ${d.cast('user_id', 'TEXT')} = ${d.param()} 
            AND ${d.cast('court_id', 'TEXT')} = ${d.param()} 
            AND checked_out_at IS NULL
        `, [userId, courtId]);
    }

    async getCourtActivity(courtId: string, hoursBack: number = 24): Promise<any[]> {
        const d = this.dialect.reset();
        const query = `
            SELECT 
                ci.id,
                ci.user_id as "userId",
                u.name as "userName",
                u."photoUrl" as "userPhotoUrl",
                ci.checked_in_at as "checkedInAt",
                ci.checked_out_at as "checkedOutAt"
            FROM check_ins ci
            LEFT JOIN users u ON ${d.cast('ci.user_id', 'TEXT')} = ${d.cast('u.id', 'TEXT')}
            WHERE ${d.cast('ci.court_id', 'TEXT')} = ${d.param()} 
              AND ci.checked_in_at > ${d.interval(Math.ceil(hoursBack / 24))}
            ORDER BY ci.checked_in_at DESC
            LIMIT 50
        `;
        return this.dataSource.query(query, [courtId]);
    }

    async getActiveCheckIns(courtId: string): Promise<any[]> {
        const d = this.dialect.reset();
        const query = `
            SELECT 
                ci.id,
                ci.user_id as "userId",
                u.name as "userName",
                u."photoUrl" as "userPhotoUrl",
                ci.checked_in_at as "checkedInAt"
            FROM check_ins ci
            LEFT JOIN users u ON ${d.cast('ci.user_id', 'TEXT')} = ${d.cast('u.id', 'TEXT')}
            WHERE ${d.cast('ci.court_id', 'TEXT')} = ${d.param()} AND ci.checked_out_at IS NULL
            ORDER BY ci.checked_in_at DESC
        `;
        return this.dataSource.query(query, [courtId]);
    }

    // ==================== COURT STATS ====================

    async getCourtStats(courtId: string): Promise<any> {
        const d = this.dialect.reset();

        const checkInCount = await this.dataSource.query(`
            SELECT COUNT(*) as count FROM check_ins 
            WHERE ${d.cast('court_id', 'TEXT')} = ${d.param()}
            AND checked_in_at > ${d.interval(30)}
        `, [courtId]);

        const matchCount = await this.dataSource.query(`
            SELECT COUNT(*) as count FROM matches 
            WHERE ${d.cast('"courtId"', 'TEXT')} = ${d.param()}
        `, [courtId]);

        return {
            checkInsLast30Days: parseInt(checkInCount[0]?.count || '0', 10),
            totalMatches: parseInt(matchCount[0]?.count || '0', 10),
        };
    }
}

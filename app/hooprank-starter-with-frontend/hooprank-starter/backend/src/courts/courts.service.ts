import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Court } from './court.entity';
import { MatchesService } from '../matches/matches.service';
import { UsersService } from '../users/users.service';
import { DbDialect } from '../common/db-utils';

@Injectable()
export class CourtsService implements OnModuleInit {
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

    async onModuleInit() {
        // Auto-create venue_type and address columns if missing (production has synchronize: false)
        if (this.dialect.isPostgres) {
            try {
                await this.dataSource.query(`ALTER TABLE courts ADD COLUMN IF NOT EXISTS venue_type TEXT`);
                await this.dataSource.query(`ALTER TABLE courts ADD COLUMN IF NOT EXISTS address TEXT`);
                console.log('[CourtsService] venue_type + address columns ensured');
            } catch (e) {
                console.error('[CourtsService] Failed to add columns:', e.message);
            }
        }
    }

    // Note: Courts are seeded via scripts/seed-courts.ts
    // Run: npx ts-node scripts/seed-courts.ts
    // For production: DATABASE_URL="..." npx ts-node scripts/seed-courts.ts

    async findAll(): Promise<Court[]> {
        // Use raw query to extract lat/lng from PostGIS geog column for production
        if (this.dialect.isPostgres) {
            const courts = await this.dataSource.query(`
                SELECT 
                    id, name, city, indoor, rims, source, signature, access, venue_type, address,
                    ST_Y(geog::geometry) as lat,
                    ST_X(geog::geometry) as lng
                FROM courts
                ORDER BY name ASC
            `);
            return courts;
        }

        // SQLite fallback for local development
        const courts = await this.courtsRepository.find({
            order: { name: 'ASC' }
        });
        return courts;
    }

    async findById(id: string): Promise<Court | undefined> {
        if (this.dialect.isPostgres) {
            const results = await this.dataSource.query(`
                SELECT 
                    id, name, city, indoor, rims, source, signature, access, venue_type, address,
                    ST_Y(geog::geometry) as lat,
                    ST_X(geog::geometry) as lng
                FROM courts
                WHERE id = $1
            `, [id]);
            if (results.length === 0) return undefined;
            return { ...results[0], king: await this.calculateKing(id) } as any;
        }

        const court = await this.courtsRepository.findOne({ where: { id } });
        if (!court) return undefined;
        return { ...court, king: await this.calculateKing(id) } as any;
    }

    async searchByLocation(minLat: number, maxLat: number, minLng: number, maxLng: number): Promise<Court[]> {
        if (this.dialect.isPostgres) {
            // Use PostGIS spatial query for production
            const courts = await this.dataSource.query(`
                SELECT 
                    id, name, city, indoor, rims, source, signature, access, venue_type, address,
                    ST_Y(geog::geometry) as lat,
                    ST_X(geog::geometry) as lng,
                    (SELECT COUNT(*) FROM user_court_alerts WHERE court_id = courts.id::text) as follower_count
                FROM courts
                WHERE geog && ST_MakeEnvelope($1, $2, $3, $4, 4326)
                ORDER BY name ASC
                LIMIT 100
            `, [minLng, minLat, maxLng, maxLat]);
            return courts;
        }


        // SQLite fallback - use simple bounding box
        return this.courtsRepository.createQueryBuilder('court')
            .where('court.lat BETWEEN :latMin AND :latMax', {
                latMin: minLat,
                latMax: maxLat
            })
            .andWhere('court.lng BETWEEN :lngMin AND :lngMax', {
                lngMin: minLng,
                lngMax: maxLng
            })
            .orderBy('court.name', 'ASC')
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
                u.avatar_url as "userPhotoUrl",
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
                u.avatar_url as "userPhotoUrl",
                ci.checked_in_at as "checkedInAt"
            FROM check_ins ci
            LEFT JOIN users u ON ${d.cast('ci.user_id', 'TEXT')} = ${d.cast('u.id', 'TEXT')}
            WHERE ${d.cast('ci.court_id', 'TEXT')} = ${d.param()} AND ci.checked_out_at IS NULL
            ORDER BY ci.checked_in_at DESC
        `;
        return this.dataSource.query(query, [courtId]);
    }

    // ==================== FOLLOWER COUNTS ====================

    async getFollowerCounts(): Promise<{ courtId: string; count: number }[]> {
        const d = this.dialect.reset();
        const query = d.isPostgres
            ? `SELECT court_id as "courtId", COUNT(*) as count FROM user_court_alerts GROUP BY court_id`
            : `SELECT court_id as "courtId", COUNT(*) as count FROM user_court_alerts GROUP BY court_id`;

        const results = await this.dataSource.query(query);
        return results.map((r: any) => ({
            courtId: r.courtId,
            count: parseInt(r.count, 10),
        }));
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
            WHERE ${d.cast('court_id', 'TEXT')} = ${d.param()}
        `, [courtId]);

        return {
            checkInsLast30Days: parseInt(checkInCount[0]?.count || '0', 10),
            totalMatches: parseInt(matchCount[0]?.count || '0', 10),
        };
    }

    // ==================== COURT CREATION ====================

    async createCourt(data: {
        id: string;
        name: string;
        city: string;
        lat: number;
        lng: number;
        indoor?: boolean;
        rims?: number;
        access?: string;
        venue_type?: string;
        address?: string;
    }): Promise<any> {
        try {
            if (this.dialect.isPostgres) {
                const result = await this.dataSource.query(`
                    INSERT INTO courts (id, name, city, indoor, rims, access, venue_type, address, source, geog)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'curated', ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        city = EXCLUDED.city,
                        indoor = EXCLUDED.indoor,
                        access = EXCLUDED.access,
                        venue_type = EXCLUDED.venue_type,
                        address = EXCLUDED.address,
                        geog = EXCLUDED.geog,
                        source = EXCLUDED.source
                    RETURNING id, name, city, access, venue_type, address
                `, [data.id, data.name, data.city, data.indoor ?? false, data.rims ?? 2, data.access ?? 'public', data.venue_type ?? null, data.address ?? null, data.lng, data.lat]);

                return { success: true, court: result[0] };
            }

            // SQLite fallback
            await this.dataSource.query(`
                INSERT INTO courts (id, name, city, indoor, rims, lat, lng, venue_type, address, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'user')
            `, [data.id, data.name, data.city, data.indoor ?? false, data.rims ?? 2, data.lat, data.lng, data.venue_type ?? null, data.address ?? null]);

            return { success: true, court: data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

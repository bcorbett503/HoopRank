import { Controller, Get, Post, Query } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Rankings controller - provides player/team leaderboards
 * Used by the Rankings screen in the mobile app
 */
@Controller('rankings')
export class RankingsController {
    constructor(private readonly dataSource: DataSource) { }

    @Get()
    async getRankings(
        @Query('mode') mode: string = '1v1',
        @Query('scope') scope: string = 'global',
        @Query('ageGroup') ageGroup?: string,
        @Query('gender') gender?: string,
    ) {
        console.log('getRankings: mode=', mode, 'scope=', scope, 'ageGroup=', ageGroup, 'gender=', gender);

        try {
            // For 3v3 or 5v5, return teams
            if (mode === '3v3' || mode === '5v5') {
                let query = `
                    SELECT 
                        t.id,
                        t.name,
                        t.team_type as "teamType",
                        t.age_group as "ageGroup",
                        t.gender,
                        t.logo_url as "logoUrl",
                        COALESCE(t.rating, 3.0) as "rating",
                        COALESCE(t.wins, 0) as "wins",
                        COALESCE(t.losses, 0) as "losses",
                        (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id AND tm.status = 'active') as "memberCount"
                    FROM teams t
                    WHERE t.team_type = $1
                `;
                const params: any[] = [mode];
                let paramIndex = 2;

                if (ageGroup) {
                    query += ` AND t.age_group = $${paramIndex}`;
                    params.push(ageGroup);
                    paramIndex++;
                }
                if (gender) {
                    query += ` AND t.gender = $${paramIndex}`;
                    params.push(gender);
                    paramIndex++;
                }

                query += ` ORDER BY COALESCE(t.rating, 3.0) DESC LIMIT 100`;

                const teams = await this.dataSource.query(query, params);
                console.log('getRankings: found', teams.length, 'teams for mode', mode);
                return teams;
            }

            // For 1v1, return individual players
            // Production database uses 'name' and 'hoop_rank' columns
            // First, check if age column exists
            let hasAgeColumn = false;
            try {
                const colCheck = await this.dataSource.query(`
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'users' AND column_name = 'age'
                `);
                hasAgeColumn = colCheck.length > 0;
            } catch (e) {
                console.log('Could not check for age column:', e.message);
            }

            const ageSelect = hasAgeColumn ? ', age' : ', NULL as age';
            const players = await this.dataSource.query(`
                SELECT 
                    id,
                    name,
                    avatar_url as "photoUrl",
                    hoop_rank as "rating",
                    position,
                    city
                    ${ageSelect}
                FROM users
                WHERE hoop_rank IS NOT NULL AND name IS NOT NULL
                ORDER BY hoop_rank DESC
                LIMIT 100
            `);

            console.log('getRankings: found', players.length, 'players');
            return players;
        } catch (error) {
            console.error('getRankings error:', error.message);
            return [];
        }
    }

    @Get('teams')
    async getTeamRankings() {
        try {
            const teams = await this.dataSource.query(`
                SELECT 
                    t.id,
                    t.name,
                    t.team_type as "teamType",
                    t.logo_url as "logoUrl",
                    COALESCE(t.rating, 3.0) as "rating",
                    COALESCE(t.wins, 0) as "wins",
                    COALESCE(t.losses, 0) as "losses",
                    (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id AND tm.status = 'active') as "memberCount"
                FROM teams t
                ORDER BY COALESCE(t.rating, 3.0) DESC
                LIMIT 100
            `);
            return teams;
        } catch (error) {
            console.error('getTeamRankings error:', error.message);
            return [];
        }
    }

    /**
     * Admin endpoint to run team challenges migration
     * POST /rankings/migrate-team-challenges
     */
    @Post('migrate-team-challenges')
    async migrateTeamChallenges() {
        try {
            // Create team_challenges table
            await this.dataSource.query(`
                CREATE TABLE IF NOT EXISTS team_challenges (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    from_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
                    to_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
                    message TEXT,
                    status VARCHAR(20) DEFAULT 'pending',
                    match_id UUID,
                    created_by VARCHAR(255),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );
            `);
            console.log('Created team_challenges table');

            // Add team match columns to matches table
            await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_match BOOLEAN DEFAULT false;`);
            await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS creator_team_id VARCHAR(255);`);
            await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent_team_id VARCHAR(255);`);
            await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS match_type VARCHAR(10) DEFAULT '1v1';`);
            console.log('Added team match columns');

            // Create indexes
            await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_team_challenges_from ON team_challenges(from_team_id);`);
            await this.dataSource.query(`CREATE INDEX IF NOT EXISTS idx_team_challenges_to ON team_challenges(to_team_id);`);
            console.log('Created indexes');

            return { success: true, message: 'Team challenges migration complete' };
        } catch (error) {
            console.error('Migration error:', error);
            return { success: false, error: error.message };
        }
    }
}


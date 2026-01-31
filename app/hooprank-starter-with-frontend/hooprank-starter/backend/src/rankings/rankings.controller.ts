import { Controller, Get, Query } from '@nestjs/common';
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
    ) {
        console.log('getRankings: mode=', mode, 'scope=', scope);

        try {
            // For 3v3 or 5v5, return teams
            if (mode === '3v3' || mode === '5v5') {
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
                    WHERE t.team_type = $1
                    ORDER BY COALESCE(t.rating, 3.0) DESC
                    LIMIT 100
                `, [mode]);

                console.log('getRankings: found', teams.length, 'teams for mode', mode);
                return teams;
            }

            // For 1v1, return individual players
            // Production database uses 'name' and 'hoop_rank' columns
            const players = await this.dataSource.query(`
                SELECT 
                    id,
                    name,
                    avatar_url as "photoUrl",
                    hoop_rank as "rating",
                    position,
                    city
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
}


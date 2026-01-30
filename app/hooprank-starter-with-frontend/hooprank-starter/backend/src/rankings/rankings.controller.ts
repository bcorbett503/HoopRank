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
            // For 1v1, return individual players
            // Production database uses 'rating' column for player ratings
            const players = await this.dataSource.query(`
        SELECT 
          id,
          display_name as "name",
          avatar_url as "photoUrl",
          rating,
          position,
          city
        FROM users
        WHERE rating IS NOT NULL
        ORDER BY rating DESC
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

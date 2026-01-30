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

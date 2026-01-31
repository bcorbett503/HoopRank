import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ActivityService {
    constructor(private dataSource: DataSource) { }

    async getGlobalActivity(limit: number = 10): Promise<any[]> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            try {
                // Get recent completed matches with player info
                const matchResults = await this.dataSource.query(`
                    SELECT 
                        m.id,
                        'match' as activity_type,
                        m.status,
                        m.match_type,
                        m.created_at,
                        m.winner_id,
                        c.id as court_id,
                        c.name as court_name,
                        c.city as court_city,
                        creator.id as creator_id,
                        creator.name as creator_name,
                        creator.avatar_url as creator_avatar_url,
                        creator.hoop_rank as creator_rating,
                        opponent.id as opponent_id,
                        opponent.name as opponent_name,
                        opponent.avatar_url as opponent_avatar_url,
                        opponent.hoop_rank as opponent_rating
                    FROM matches m
                    LEFT JOIN courts c ON m.court_id = c.id
                    LEFT JOIN users creator ON m.creator_id = creator.id
                    LEFT JOIN users opponent ON m.opponent_id = opponent.id
                    WHERE m.status = 'completed'
                    ORDER BY m.created_at DESC
                    LIMIT $1
                `, [limit]);

                // Get recent new player registrations
                const newPlayerResults = await this.dataSource.query(`
                    SELECT 
                        u.id,
                        'new_player' as activity_type,
                        u.name,
                        u.avatar_url,
                        u.hoop_rank,
                        u.position,
                        u.city,
                        u.created_at
                    FROM users u
                    WHERE u.name IS NOT NULL 
                      AND u.name != ''
                      AND u.name != 'New Player'
                    ORDER BY u.created_at DESC
                    LIMIT $1
                `, [limit]);

                // Combine and sort by date
                const activities: any[] = [];

                // Add match activities
                matchResults.forEach((r: any) => {
                    activities.push({
                        id: r.id,
                        type: 'match',
                        status: r.status,
                        matchType: r.match_type,
                        createdAt: r.created_at,
                        winnerId: r.winner_id,
                        court: r.court_id ? {
                            id: r.court_id,
                            name: r.court_name,
                            city: r.court_city,
                        } : null,
                        creator: {
                            id: r.creator_id,
                            name: r.creator_name,
                            photoUrl: r.creator_avatar_url,
                            rating: r.creator_rating,
                        },
                        opponent: r.opponent_id ? {
                            id: r.opponent_id,
                            name: r.opponent_name,
                            photoUrl: r.opponent_avatar_url,
                            rating: r.opponent_rating,
                        } : null,
                    });
                });

                // Add new player activities
                newPlayerResults.forEach((r: any) => {
                    activities.push({
                        id: `player_${r.id}`,
                        type: 'new_player',
                        createdAt: r.created_at,
                        player: {
                            id: r.id,
                            name: r.name,
                            photoUrl: r.avatar_url,
                            rating: r.hoop_rank || 3.0,
                            position: r.position,
                            city: r.city,
                        },
                    });
                });

                // Sort by createdAt descending and limit
                activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                return activities.slice(0, limit);

            } catch (error) {
                console.error('getGlobalActivity error:', error.message);
                return [];
            }
        }

        // SQLite fallback - return empty for now
        return [];
    }
}

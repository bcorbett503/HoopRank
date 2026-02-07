import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class ActivityService {
    constructor(private dataSource: DataSource) { }

    async getGlobalActivity(limit: number = 10): Promise<any[]> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            try {
                // Get recent completed 1v1 matches with player info
                const matchResults = await this.dataSource.query(`
                    SELECT 
                        m.id,
                        'match' as activity_type,
                        m.status,
                        m.match_type,
                        m.created_at,
                        m.winner_id,
                        m.team_match,
                        m.score_creator,
                        m.score_opponent,
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
                    WHERE m.status = 'completed' AND (m.team_match = false OR m.team_match IS NULL)
                    ORDER BY m.created_at DESC
                    LIMIT $1
                `, [limit]);

                // Get recent completed team matches
                const teamMatchResults = await this.dataSource.query(`
                    SELECT 
                        m.id,
                        'team_match' as activity_type,
                        m.status,
                        m.match_type,
                        m.created_at,
                        m.winner_id,
                        m.team_match,
                        m.score_creator,
                        m.score_opponent,
                        c.id as court_id,
                        c.name as court_name,
                        c.city as court_city,
                        ct.id as creator_team_id,
                        ct.name as creator_team_name,
                        ct.rating as creator_team_rating,
                        ot.id as opponent_team_id,
                        ot.name as opponent_team_name,
                        ot.rating as opponent_team_rating
                    FROM matches m
                    LEFT JOIN courts c ON m.court_id = c.id
                    LEFT JOIN teams ct ON m.creator_team_id = ct.id
                    LEFT JOIN teams ot ON m.opponent_team_id = ot.id
                    WHERE m.status = 'completed' AND m.team_match = true
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

                // Add 1v1 match activities
                matchResults.forEach((r: any) => {
                    activities.push({
                        id: r.id,
                        type: 'match',
                        status: r.status,
                        matchType: r.match_type,
                        createdAt: r.created_at,
                        winnerId: r.winner_id,
                        scoreCreator: r.score_creator,
                        scoreOpponent: r.score_opponent,
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

                // Add team match activities
                teamMatchResults.forEach((r: any) => {
                    activities.push({
                        id: r.id,
                        type: 'team_match',
                        status: r.status,
                        matchType: r.match_type,
                        createdAt: r.created_at,
                        winnerId: r.winner_id,
                        scoreCreator: r.score_creator,
                        scoreOpponent: r.score_opponent,
                        isTeamMatch: true,
                        court: r.court_id ? {
                            id: r.court_id,
                            name: r.court_name,
                            city: r.court_city,
                        } : null,
                        creatorTeam: r.creator_team_id ? {
                            id: r.creator_team_id,
                            name: r.creator_team_name,
                            rating: r.creator_team_rating,
                        } : null,
                        opponentTeam: r.opponent_team_id ? {
                            id: r.opponent_team_id,
                            name: r.opponent_team_name,
                            rating: r.opponent_team_rating,
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

    /**
     * Get local activity feed — completed matches near the user's location.
     * Falls back to global activity if the user has no lat/lng coordinates.
     */
    async getLocalActivity(userId: string, limit: number = 20, radiusMiles: number = 25): Promise<any[]> {
        const isPostgres = !!process.env.DATABASE_URL;
        if (!isPostgres) return [];

        try {
            // Get user's location
            const userResult = await this.dataSource.query(
                `SELECT lat, lng FROM users WHERE id = $1`, [userId]
            );

            if (!userResult[0] || !userResult[0].lat || !userResult[0].lng) {
                // No location — fall back to global activity
                return this.getGlobalActivity(limit);
            }

            const userLat = parseFloat(userResult[0].lat);
            const userLng = parseFloat(userResult[0].lng);

            // Get recent completed matches at courts within radiusMiles
            // Haversine formula in SQL to compute distance
            const matchResults = await this.dataSource.query(`
                SELECT 
                    m.id,
                    'match' as activity_type,
                    m.status,
                    m.match_type,
                    m.created_at,
                    m.winner_id,
                    m.score_creator,
                    m.score_opponent,
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
                    opponent.hoop_rank as opponent_rating,
                    (3959 * acos(
                        cos(radians($2)) * cos(radians(CAST(c.latitude AS FLOAT)))
                        * cos(radians(CAST(c.longitude AS FLOAT)) - radians($3))
                        + sin(radians($2)) * sin(radians(CAST(c.latitude AS FLOAT)))
                    )) AS distance_miles
                FROM matches m
                JOIN courts c ON m.court_id = c.id
                LEFT JOIN users creator ON m.creator_id = creator.id
                LEFT JOIN users opponent ON m.opponent_id = opponent.id
                WHERE m.status = 'completed'
                  AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
                  AND (3959 * acos(
                        cos(radians($2)) * cos(radians(CAST(c.latitude AS FLOAT)))
                        * cos(radians(CAST(c.longitude AS FLOAT)) - radians($3))
                        + sin(radians($2)) * sin(radians(CAST(c.latitude AS FLOAT)))
                  )) <= $4
                ORDER BY m.created_at DESC
                LIMIT $1
            `, [limit, userLat, userLng, radiusMiles]);

            return matchResults.map((r: any) => ({
                id: r.id,
                type: 'match',
                status: r.status,
                matchType: r.match_type,
                createdAt: r.created_at,
                winnerId: r.winner_id,
                scoreCreator: r.score_creator,
                scoreOpponent: r.score_opponent,
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
                distanceMiles: r.distance_miles ? parseFloat(r.distance_miles).toFixed(1) : null,
            }));
        } catch (error) {
            console.error('getLocalActivity error:', error.message);
            // Fall back to global on error
            return this.getGlobalActivity(limit);
        }
    }
}


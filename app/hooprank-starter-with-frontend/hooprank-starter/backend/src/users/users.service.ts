import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private dataSource: DataSource,
  ) { }

  /**
   * Find user by auth provider ID or create a new one.
   * Production uses auth_provider + auth_token for authentication.
   */
  async findOrCreate(authToken: string, email: string): Promise<User> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      // Check if user exists by id (which is the Firebase UID)
      const existing = await this.dataSource.query(
        `SELECT * FROM users WHERE id = $1 LIMIT 1`,
        [authToken]
      );

      if (existing.length > 0) {
        return existing[0];
      }

      // Create new user with correct production column names
      // Production table has: id, email, name, avatar_url, hoop_rank, created_at, updated_at, fcm_token
      const result = await this.dataSource.query(`
        INSERT INTO users (id, email, name, hoop_rank, created_at, updated_at)
        VALUES ($1, $2, 'New Player', 3.0, NOW(), NOW())
        RETURNING *
      `, [authToken, email]);

      return result[0];
    }

    // SQLite fallback
    let user = await this.usersRepository.findOne({ where: { authToken } });
    if (!user) {
      user = this.usersRepository.create({
        id: authToken, // Use authToken as ID for consistency
        authToken,
        email,
        name: 'New Player',
        hoopRank: 3.0,
        reputation: 5.0,
      } as Partial<User>);
      await this.usersRepository.save(user);
    }
    return user;
  }

  async findOne(id: string): Promise<User | null> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      const result = await this.dataSource.query(`
        SELECT
          id,
          email,
          name,
          avatar_url,
          hoop_rank,
          position,
          city,
          games_played,
          created_at,
          updated_at
        FROM users
        WHERE id = $1
        LIMIT 1
      `, [id]);
      return result.length > 0 ? result[0] : null;
    }

    const user = await this.usersRepository.findOne({ where: { id } });
    return this.sanitizeUser(user);
  }

  async getAll(): Promise<User[]> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      // Return only public profile fields; never expose auth or notification tokens.
      return await this.dataSource.query(`
        SELECT
          id,
          name,
          avatar_url,
          hoop_rank,
          position,
          city,
          games_played,
          created_at,
          updated_at
        FROM users
        ORDER BY hoop_rank DESC
        LIMIT 100
      `);
    }

    const users = await this.usersRepository.find({
      order: { hoopRank: 'DESC' },
      take: 100,
    });
    return users.map((user) => this.sanitizeUser(user) as User);
  }

  private sanitizeUser(user: User | null): User | null {
    if (!user) return null;
    const sanitized: any = { ...(user as any) };
    delete sanitized.authToken;
    delete sanitized.fcmToken;
    delete sanitized.authProvider;
    return sanitized as User;
  }

  /**
   * Reverse geocode lat/lng to a "City, ST" string using OpenStreetMap Nominatim.
   * Returns null if lookup fails (non-blocking).
   */
  private async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'HoopRank/1.0' },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return null;
      const json = await response.json();
      const addr = json.address;
      if (!addr) return null;
      const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || '';
      const state = addr.state || '';
      // Convert state to abbreviation if US
      const stateAbbr = this.getStateAbbreviation(state) || state;
      if (city && stateAbbr) return `${city}, ${stateAbbr}`;
      if (city) return city;
      return null;
    } catch (e) {
      return null;
    }
  }

  private getStateAbbreviation(state: string): string | null {
    const stateMap: Record<string, string> = {
      'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
      'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
      'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
      'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
      'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
      'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
      'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
      'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
      'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
      'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
      'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
      'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
      'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
    };
    return stateMap[state] || null;
  }

  async updateProfile(id: string, data: Partial<any>): Promise<User> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      // If lat/lng provided without city, reverse geocode to infer city
      if (data.lat && data.lng && !data.city) {
        const lat = parseFloat(data.lat);
        const lng = parseFloat(data.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
          const city = await this.reverseGeocode(lat, lng);
          if (city) {
            data.city = city;
          }
        }
      }

      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Map camelCase to snake_case for production columns
      const columnMap: Record<string, string> = {
        name: 'name',
        displayName: 'name',
        email: 'email',
        avatarUrl: 'avatar_url',
        hoopRank: 'hoop_rank',
        rating: 'hoop_rank',
        position: 'position',
        height: 'height',
        weight: 'weight',
        city: 'city',
        fcmToken: 'fcm_token',
        lat: 'lat',
        lng: 'lng',
      };

      for (const [key, value] of Object.entries(data)) {
        const column = columnMap[key];
        if (column && value !== undefined) {
          updates.push(`${column} = $${paramIndex++}`);
          values.push(value);
        }
      }

      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        values.push(id);
        await this.dataSource.query(
          `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
          values
        );
      }

      const result = await this.dataSource.query(`SELECT * FROM users WHERE id = $1`, [id]);
      if (result.length === 0) throw new Error('User not found');
      return result[0];
    }

    // SQLite fallback  
    await this.usersRepository.update(id, data);
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new Error('User not found');
    return user;
  }

  async get(id: string): Promise<User | null> {
    return this.findOne(id);
  }

  async setRating(id: string, rating: number): Promise<void> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      await this.dataSource.query(
        `UPDATE users SET hoop_rank = $1, updated_at = NOW() WHERE id = $2`,
        [rating, id]
      );
    } else {
      await this.usersRepository.update(id, { hoopRank: rating });
    }
  }

  async addFriend(userId: string, friendId: string): Promise<void> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      await this.dataSource.query(`
        INSERT INTO friendships (user_id, friend_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id, friend_id) DO NOTHING
      `, [userId, friendId]);
    } else {
      const user = await this.usersRepository.findOne({ where: { id: userId }, relations: ['friends'] });
      const friend = await this.usersRepository.findOne({ where: { id: friendId } });
      if (user && friend) {
        user.friends = [...(user.friends || []), friend];
        await this.usersRepository.save(user);
      }
    }
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      await this.dataSource.query(
        `DELETE FROM friendships WHERE user_id = $1 AND friend_id = $2`,
        [userId, friendId]
      );
    } else {
      const user = await this.usersRepository.findOne({ where: { id: userId }, relations: ['friends'] });
      if (user) {
        user.friends = user.friends.filter(f => f.id !== friendId);
        await this.usersRepository.save(user);
      }
    }
  }

  async getFriends(userId: string): Promise<User[]> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      try {
        return await this.dataSource.query(`
          SELECT u.id, u.name, u.avatar_url, u.hoop_rank, u.position, u.city
          FROM users u
          JOIN friendships f ON f.friend_id = u.id
          WHERE f.user_id = $1
        `, [userId]);
      } catch (error) {
        console.warn(`getFriends: DB error for userId=${userId}:`, error.message);
        return [];
      }
    }

    const user = await this.usersRepository.findOne({ where: { id: userId }, relations: ['friends'] });
    return user?.friends || [];
  }

  async getMatches(userId: string): Promise<any[]> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      return await this.dataSource.query(`
        SELECT m.*,
          c.name as court_name, c.city as court_city,
          u_creator.name as creator_name, u_creator.avatar_url as creator_photo,
          u_opponent.name as opponent_name, u_opponent.avatar_url as opponent_photo
        FROM matches m
        LEFT JOIN courts c ON m.court_id = c.id
        LEFT JOIN users u_creator ON m.creator_id = u_creator.id
        LEFT JOIN users u_opponent ON m.opponent_id = u_opponent.id
        WHERE m.creator_id = $1 OR m.opponent_id = $1
        ORDER BY m.created_at DESC
        LIMIT 20
      `, [userId]);
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['createdMatches', 'opponentMatches', 'createdMatches.court', 'opponentMatches.court']
    });
    if (!user) return [];
    return [...(user.createdMatches || []), ...(user.opponentMatches || [])];
  }

  /**
   * Historical (finalized) matches only.
   * Used by profile "recent games" views so pending/contested games do not
   * appear in history before score confirmation is complete.
   */
  async getRecentGames(userId: string): Promise<any[]> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      return await this.dataSource.query(`
        SELECT m.*,
          c.name as court_name, c.city as court_city,
          u_creator.name as creator_name, u_creator.avatar_url as creator_photo,
          u_opponent.name as opponent_name, u_opponent.avatar_url as opponent_photo
        FROM matches m
        LEFT JOIN courts c ON m.court_id = c.id
        LEFT JOIN users u_creator ON m.creator_id = u_creator.id
        LEFT JOIN users u_opponent ON m.opponent_id = u_opponent.id
        WHERE (m.creator_id = $1 OR m.opponent_id = $1)
          AND m.status IN ('completed', 'ended')
        ORDER BY COALESCE(m.updated_at, m.created_at) DESC
        LIMIT 20
      `, [userId]);
    }

    const allMatches = await this.getMatches(userId);
    return (allMatches || []).filter((m: any) => {
      const status = (m?.status || '').toString().toLowerCase();
      return status === 'completed' || status === 'ended';
    });
  }

  async getUserStats(userId: string): Promise<any> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      // Count wins and losses from completed matches
      const result = await this.dataSource.query(`
        SELECT
          COUNT(*) FILTER (WHERE winner_id = $1) as wins,
          COUNT(*) FILTER (WHERE winner_id IS NOT NULL AND winner_id != $1) as losses,
          COUNT(*) as matches_played
        FROM matches
        WHERE (creator_id = $1 OR opponent_id = $1)
          AND status IN ('completed', 'ended')
      `, [userId]);

      const user = await this.dataSource.query(`SELECT hoop_rank FROM users WHERE id = $1`, [userId]);
      const hoopRank = user.length > 0 ? parseFloat(user[0].hoop_rank) || 3.0 : 3.0;

      const wins = parseInt(result[0]?.wins) || 0;
      const losses = parseInt(result[0]?.losses) || 0;
      const matchesPlayed = parseInt(result[0]?.matches_played) || 0;

      return {
        wins,
        losses,
        matchesPlayed,
        winRate: matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0,
        hoopRank,
      };
    }

    // SQLite fallback
    return { wins: 0, losses: 0, matchesPlayed: 0, winRate: 0, hoopRank: 3.0 };
  }

  /**
   * Count how many courts this user is the "King" of, defined as:
   * among all followers (hearts) of a court, the follower with the highest
   * global HoopRank (users.hoop_rank) is the King.
   *
   * This is computed on demand from user_followed_courts + users.hoop_rank.
   */
  async getKingCourtsCount(userId: string): Promise<number> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      const r = await this.dataSource.query(
        `
        WITH ranked AS (
          SELECT
            ufc.court_id,
            ufc.user_id,
            ROW_NUMBER() OVER (
              PARTITION BY ufc.court_id
              ORDER BY u.hoop_rank DESC NULLS LAST, u.id
            ) AS rn
          FROM user_followed_courts ufc
          JOIN users u ON u.id = ufc.user_id
        )
        SELECT COUNT(*)::int AS count
        FROM ranked
        WHERE rn = 1 AND user_id = $1
      `,
        [userId],
      );

      return parseInt(r?.[0]?.count, 10) || 0;
    }

    // SQLite fallback (window functions supported). "NULLS LAST" not supported,
    // so order by (is null) first, then rank desc.
    const r = await this.dataSource.query(
      `
        WITH ranked AS (
          SELECT
            ufc.court_id,
            ufc.user_id,
            ROW_NUMBER() OVER (
              PARTITION BY ufc.court_id
              ORDER BY (u.hoop_rank IS NULL) ASC, u.hoop_rank DESC, u.id
            ) AS rn
          FROM user_followed_courts ufc
          JOIN users u ON u.id = ufc.user_id
        )
        SELECT COUNT(*) AS count
        FROM ranked
        WHERE rn = 1 AND user_id = ?
      `,
      [userId],
    );

    return parseInt(r?.[0]?.count, 10) || 0;
  }

  // ==================== FOLLOW METHODS ====================

  async followCourt(userId: string, courtId: string): Promise<void> {
    const isPostgres = !!process.env.DATABASE_URL;
    try {
      if (isPostgres) {
        await this.dataSource.query(`
          INSERT INTO user_followed_courts (user_id, court_id)
          VALUES ($1, $2)
          ON CONFLICT (user_id, court_id) DO NOTHING
        `, [userId, courtId]);
      } else {
        await this.dataSource.query(`
          INSERT OR IGNORE INTO user_followed_courts (user_id, court_id)
          VALUES (?, ?)
        `, [userId, courtId]);
      }
    } catch (error) {
      console.error('followCourt service error:', error);
      throw error;
    }
  }

  async unfollowCourt(userId: string, courtId: string): Promise<void> {
    const isPostgres = !!process.env.DATABASE_URL;
    const query = isPostgres
      ? `DELETE FROM user_followed_courts WHERE user_id = $1 AND court_id = $2`
      : `DELETE FROM user_followed_courts WHERE user_id = ? AND court_id = ?`;
    await this.dataSource.query(query, [userId, courtId]);
  }

  async followPlayer(followerId: string, followedId: string): Promise<void> {
    const isPostgres = !!process.env.DATABASE_URL;
    if (isPostgres) {
      await this.dataSource.query(`
        INSERT INTO user_followed_players (follower_id, followed_id)
        VALUES ($1, $2)
        ON CONFLICT (follower_id, followed_id) DO NOTHING
      `, [followerId, followedId]);
    } else {
      await this.dataSource.query(`
        INSERT OR IGNORE INTO user_followed_players (follower_id, followed_id)
        VALUES (?, ?)
      `, [followerId, followedId]);
    }
  }

  async unfollowPlayer(followerId: string, followedId: string): Promise<void> {
    const isPostgres = !!process.env.DATABASE_URL;
    const query = isPostgres
      ? `DELETE FROM user_followed_players WHERE follower_id = $1 AND followed_id = $2`
      : `DELETE FROM user_followed_players WHERE follower_id = ? AND followed_id = ?`;
    await this.dataSource.query(query, [followerId, followedId]);
  }

  async followTeam(userId: string, teamId: string): Promise<void> {
    const isPostgres = !!process.env.DATABASE_URL;
    if (isPostgres) {
      await this.dataSource.query(`
        INSERT INTO user_followed_teams (user_id, team_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, team_id) DO NOTHING
      `, [userId, teamId]);
    } else {
      await this.dataSource.query(`
        INSERT OR IGNORE INTO user_followed_teams (user_id, team_id)
        VALUES (?, ?)
      `, [userId, teamId]);
    }
  }

  async unfollowTeam(userId: string, teamId: string): Promise<void> {
    const isPostgres = !!process.env.DATABASE_URL;
    const query = isPostgres
      ? `DELETE FROM user_followed_teams WHERE user_id = $1 AND team_id = $2`
      : `DELETE FROM user_followed_teams WHERE user_id = ? AND team_id = ?`;
    await this.dataSource.query(query, [userId, teamId]);
  }

  async getFollows(userId: string): Promise<{ courts: any[]; players: any[]; teams: any[] }> {

    // Query courts
    let courts: any[] = [];
    try {
      courts = await this.dataSource.query(
        `SELECT court_id as "courtId" FROM user_followed_courts WHERE user_id = $1`,
        [userId]
      );
    } catch (courtError) {
      console.error('getFollows courts ERROR:', courtError.message);
      return { courts: [], players: [], teams: [], courtsError: courtError.message } as any;
    }

    // Query players - separate try-catch
    let players: any[] = [];
    try {
      players = await this.dataSource.query(
        `SELECT followed_id as "playerId" FROM user_followed_players WHERE follower_id = $1`,
        [userId]
      );
    } catch (playerError) {
      console.error('getFollows players ERROR:', playerError.message);
      return { courts, players: [], teams: [], playersError: playerError.message } as any;
    }

    // Query teams - only return teams that still exist (JOIN against teams table)
    let teams: any[] = [];
    try {
      teams = await this.dataSource.query(
        `SELECT uft.team_id as "teamId", t.name as "teamName"
         FROM user_followed_teams uft
         JOIN teams t ON t.id = uft.team_id
         WHERE uft.user_id = $1`,
        [userId]
      );
    } catch (teamError) {
      console.error('getFollows teams ERROR:', teamError.message);
      // Don't fail - just return empty teams
    }

    return { courts, players, teams };
  }

  async debugFollowedCourts(): Promise<any> {
    const isPostgres = !!process.env.DATABASE_URL;
    const testUserId = '4ODZUrySRUhFDC5wVW6dCySBprD2';
    try {
      // Get all rows
      const allRows = await this.dataSource.query(
        `SELECT * FROM user_followed_courts ORDER BY created_at DESC LIMIT 20`
      );

      // Test exact getFollows query
      const courtsForUser = await this.dataSource.query(
        `SELECT court_id as "courtId" FROM user_followed_courts WHERE user_id = $1`,
        [testUserId]
      );

      return {
        success: true,
        allRowsCount: allRows.length,
        allRows,
        testUserId,
        courtsForTestUser: courtsForUser,
        isPostgres
      };
    } catch (error) {
      return { success: false, error: error.message, stack: error.stack };
    }
  }

  /**
   * Cleanup database - delete all users except Kevin, Richard, Nathan
   * Also deletes all related data from other tables
   */
  async cleanupUsers(): Promise<any> {
    const KEEP_USERS = [
      '0OW2dC3NsqexmTFTXgu57ZQfaIo2', // Kevin Corbett
      'Zc3Ey4VTslZ3VxsPtcqulmMw9e53', // Richard Corbett
      'vvxwohs5nXdstsgWlxuxfZdPbfI3', // Nathan North
    ];

    const results: string[] = [];

    try {
      // Delete related data first (foreign key constraints)
      const tables = [
        { name: 'player_statuses', userCol: 'user_id' },
        { name: 'status_likes', userCol: 'user_id' },
        { name: 'status_comments', userCol: 'user_id' },
        { name: 'event_attendees', userCol: 'user_id' },
        { name: 'user_followed_courts', userCol: 'user_id' },
        { name: 'check_ins', userCol: 'user_id' },
        { name: 'team_members', userCol: 'user_id' },
      ];

      for (const table of tables) {
        try {
          const result = await this.dataSource.query(
            `DELETE FROM ${table.name} WHERE ${table.userCol} NOT IN ($1, $2, $3)`,
            KEEP_USERS
          );
          results.push(`Deleted from ${table.name}: ${result?.[1] || 'unknown'} rows`);
        } catch (e) {
          results.push(`${table.name}: ${e.message}`);
        }
      }

      // Delete user_followed_players (has two user columns)
      try {
        await this.dataSource.query(
          `DELETE FROM user_followed_players WHERE follower_id NOT IN ($1, $2, $3) OR followed_id NOT IN ($1, $2, $3)`,
          KEEP_USERS
        );
        results.push('Deleted from user_followed_players');
      } catch (e) {
        results.push(`user_followed_players: ${e.message}`);
      }

      // Delete matches (has both creator_id and opponent_id)
      try {
        await this.dataSource.query(
          `DELETE FROM matches WHERE creator_id NOT IN ($1, $2, $3) OR opponent_id NOT IN ($1, $2, $3)`,
          KEEP_USERS
        );
        results.push('Deleted from matches');
      } catch (e) {
        results.push(`matches: ${e.message}`);
      }

      // Delete messages (has from_id and to_id)
      try {
        await this.dataSource.query(
          `DELETE FROM messages WHERE from_id NOT IN ($1, $2, $3) OR to_id NOT IN ($1, $2, $3)`,
          KEEP_USERS
        );
        results.push('Deleted from messages');
      } catch (e) {
        results.push(`messages: ${e.message}`);
      }

      // Finally delete users
      const userResult = await this.dataSource.query(
        `DELETE FROM users WHERE id NOT IN ($1, $2, $3)`,
        KEEP_USERS
      );
      results.push(`Deleted ${userResult?.[1] || 'users'} users`);

      // Get remaining users
      const remaining = await this.dataSource.query(`SELECT id, name FROM users`);

      return {
        success: true,
        results,
        remainingUsers: remaining
      };
    } catch (error) {
      return { success: false, error: error.message, results };
    }
  }

  async getFollowedActivity(userId: string): Promise<{ courtActivity: any[]; playerActivity: any[] }> {
    return { courtActivity: [], playerActivity: [] };
  }

  /**
   * Delete a single user and all their related data
   * Used for testing/admin purposes
   */
  async deleteUser(userId: string): Promise<{ success: boolean; deletedFrom: string[] }> {
    const deletedFrom: string[] = [];

    try {
      // Delete in order respecting foreign keys
      const tables = [
        { table: 'status_likes', col: 'user_id' },
        { table: 'status_comments', col: 'user_id' },
        { table: 'event_attendees', col: 'user_id' },
        { table: 'player_statuses', col: 'user_id' },
        { table: 'check_ins', col: 'user_id' },
        { table: 'user_followed_courts', col: 'user_id' },
        { table: 'user_followed_players', col: 'follower_id' },
        { table: 'user_followed_players', col: 'followed_id' },
        { table: 'user_court_alerts', col: 'user_id' },
        { table: 'friendships', col: 'user_id' },
        { table: 'friendships', col: 'friend_id' },
        { table: 'team_members', col: 'user_id' },
        { table: 'messages', col: 'from_id' },
        { table: 'messages', col: 'to_id' },
        { table: 'matches', col: 'creator_id' },
        { table: 'matches', col: 'opponent_id' },
        { table: 'challenges', col: 'challenger_id' },
        { table: 'challenges', col: 'challenged_id' },
      ];

      for (const t of tables) {
        try {
          const result = await this.dataSource.query(
            `DELETE FROM ${t.table} WHERE ${t.col} = $1`,
            [userId]
          );
          if (result[1] > 0) {
            deletedFrom.push(`${t.table} (${result[1]} rows)`);
          }
        } catch (e) {
          // Table might not exist, skip
        }
      }

      // Finally delete the user
      const userResult = await this.dataSource.query(
        'DELETE FROM users WHERE id = $1 RETURNING name, email',
        [userId]
      );

      if (userResult[0]?.length > 0) {
        deletedFrom.push(`users (${userResult[0][0].name} - ${userResult[0][0].email})`);
      }

      return { success: true, deletedFrom };
    } catch (error) {
      return { success: false, deletedFrom, error: error.message } as any;
    }
  }

  /**
   * Get users within specified radius of the requesting user.
   * Uses Haversine formula to calculate distance between coordinates.
   * Falls back to zip code geocoding if lat/lng not available.
   */
  async getNearbyUsers(userId: string, radiusMiles: number = 25): Promise<any[]> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (!isPostgres) {
      return [];
    }

    // Simple zip code to lat/lng lookup (approximate center of zip code area)
    const zipCoords: Record<string, { lat: number; lng: number }> = {
      // Oregon
      '97027': { lat: 45.3762, lng: -122.5967 }, // Gladstone, OR
      '97034': { lat: 45.4206, lng: -122.6706 }, // Lake Oswego, OR
      '97201': { lat: 45.5152, lng: -122.6784 }, // Portland, OR
      '97202': { lat: 45.4829, lng: -122.6515 }, // Portland, OR
      '97206': { lat: 45.4765, lng: -122.6001 }, // Portland, OR
      '97045': { lat: 45.3542, lng: -122.5765 }, // Oregon City, OR
      // California - Bay Area
      '94102': { lat: 37.7786, lng: -122.4159 }, // San Francisco, CA
      '94103': { lat: 37.7726, lng: -122.4110 }, // San Francisco, CA
      '94107': { lat: 37.7649, lng: -122.3955 }, // San Francisco, CA
      '94501': { lat: 37.7652, lng: -122.2416 }, // Alameda, CA
      '94541': { lat: 37.6688, lng: -122.0860 }, // Hayward, CA
      '94542': { lat: 37.6338, lng: -122.0469 }, // Hayward, CA
      '94544': { lat: 37.6332, lng: -122.0971 }, // Hayward, CA
      '94545': { lat: 37.6336, lng: -122.1092 }, // Hayward, CA
      // Washington
      '98362': { lat: 48.1181, lng: -123.4307 }, // Port Angeles, WA
      '98363': { lat: 48.0633, lng: -123.8859 }, // Port Angeles, WA
    };

    try {
      // Get the requesting user's location (with zip fallback)
      const currentUser = await this.dataSource.query(
        `SELECT lat, lng, zip, city FROM users WHERE id = $1`,
        [userId]
      );

      if (!currentUser[0]) {
        return [];
      }

      let { lat, lng, zip, city } = currentUser[0];

      // Fallback to zip code coordinates if no GPS
      if ((!lat || !lng) && zip && zipCoords[zip]) {
        lat = zipCoords[zip].lat;
        lng = zipCoords[zip].lng;
      }

      // If still no location, return all users as fallback
      if (!lat || !lng) {
        return await this.dataSource.query(`
          SELECT 
            id,
            name,
            avatar_url as "avatarUrl",
            hoop_rank as rating,
            position,
            city,
            games_played as "gamesPlayed"
          FROM users 
          WHERE name IS NOT NULL 
            AND name != ''
            AND name != 'New Player'
          ORDER BY hoop_rank DESC
          LIMIT 100
        `);
      }

      // Query users within radius using Haversine formula
      // Use COALESCE to fall back to zip coordinates for other users too
      // 3959 = Earth's radius in miles
      const nearbyUsers = await this.dataSource.query(`
        WITH user_locations AS (
          SELECT 
            id,
            name,
            avatar_url as "avatarUrl",
            hoop_rank as rating,
            position,
            city,
            games_played as "gamesPlayed",
            zip,
            COALESCE(lat, 
              CASE zip
                WHEN '97027' THEN 45.3762
                WHEN '97034' THEN 45.4206
                WHEN '97201' THEN 45.5152
                WHEN '97202' THEN 45.4829
                WHEN '97206' THEN 45.4765
                WHEN '97045' THEN 45.3542
                WHEN '94102' THEN 37.7786
                WHEN '94103' THEN 37.7726
                WHEN '94107' THEN 37.7649
                WHEN '94501' THEN 37.7652
                WHEN '94541' THEN 37.6688
                WHEN '94542' THEN 37.6338
                WHEN '94544' THEN 37.6332
                WHEN '94545' THEN 37.6336
                WHEN '98362' THEN 48.1181
                WHEN '98363' THEN 48.0633
                ELSE NULL
              END
            ) as effective_lat,
            COALESCE(lng, 
              CASE zip
                WHEN '97027' THEN -122.5967
                WHEN '97034' THEN -122.6706
                WHEN '97201' THEN -122.6784
                WHEN '97202' THEN -122.6515
                WHEN '97206' THEN -122.6001
                WHEN '97045' THEN -122.5765
                WHEN '94102' THEN -122.4159
                WHEN '94103' THEN -122.4110
                WHEN '94107' THEN -122.3955
                WHEN '94501' THEN -122.2416
                WHEN '94541' THEN -122.0860
                WHEN '94542' THEN -122.0469
                WHEN '94544' THEN -122.0971
                WHEN '94545' THEN -122.1092
                WHEN '98362' THEN -123.4307
                WHEN '98363' THEN -123.8859
                ELSE NULL
              END
            ) as effective_lng
          FROM users 
          WHERE name IS NOT NULL 
            AND name != ''
            AND name != 'New Player'
            AND id != $1
        )
        SELECT 
          id,
          name,
          "avatarUrl",
          rating,
          position,
          city,
          "gamesPlayed",
          (
            3959 * acos(
              cos(radians($2)) * cos(radians(effective_lat)) *
              cos(radians(effective_lng) - radians($3)) +
              sin(radians($2)) * sin(radians(effective_lat))
            )
          ) as distance
        FROM user_locations
        WHERE effective_lat IS NOT NULL 
          AND effective_lng IS NOT NULL
          AND (
            3959 * acos(
              cos(radians($2)) * cos(radians(effective_lat)) *
              cos(radians(effective_lng) - radians($3)) +
              sin(radians($2)) * sin(radians(effective_lat))
            )
          ) <= $4
        ORDER BY rating DESC
        LIMIT 100
      `, [userId, lat, lng, radiusMiles]);

      return nearbyUsers;
    } catch (error) {
      console.error('getNearbyUsers error:', error.message);
      return [];
    }
  }

  // ==================== REPORT & BLOCK (Guideline 1.2) ====================



  async reportUser(reporterId: string, reportedUserId: string, reason: string): Promise<{ success: boolean }> {
    await this.dataSource.query(
      `INSERT INTO user_reports (reporter_id, reported_user_id, reason) VALUES ($1, $2, $3)`,
      [reporterId, reportedUserId, reason],
    );
    console.log(`[REPORT] User ${reporterId} reported user ${reportedUserId}: ${reason}`);
    return { success: true };
  }

  async reportStatus(reporterId: string, statusId: number, reason: string): Promise<{ success: boolean }> {
    await this.dataSource.query(
      `INSERT INTO content_reports (reporter_id, status_id, reason) VALUES ($1, $2, $3)`,
      [reporterId, statusId, reason],
    );
    console.log(`[REPORT] User ${reporterId} reported status ${statusId}: ${reason}`);
    return { success: true };
  }

  async blockUser(userId: string, targetId: string): Promise<{ success: boolean }> {
    await this.dataSource.query(
      `INSERT INTO blocked_users (user_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT (user_id, blocked_user_id) DO NOTHING`,
      [userId, targetId],
    );
    console.log(`[BLOCK] User ${userId} blocked user ${targetId}`);
    return { success: true };
  }

  async unblockUser(userId: string, targetId: string): Promise<{ success: boolean }> {
    await this.dataSource.query(
      `DELETE FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2`,
      [userId, targetId],
    );
    return { success: true };
  }

  async getBlockedUsers(userId: string): Promise<string[]> {
    const rows = await this.dataSource.query(
      `SELECT blocked_user_id FROM blocked_users WHERE user_id = $1`,
      [userId],
    );
    return rows.map((r: any) => r.blocked_user_id);
  }

  async isBlocked(userId: string, targetId: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2 LIMIT 1`,
      [userId, targetId],
    );
    return rows.length > 0;
  }

  /**
   * Delete the authenticated user's own account and all related data.
   * Also deletes the Firebase Auth record.
   */
  async deleteMyAccount(userId: string): Promise<{ success: boolean; deletedFrom: string[] }> {
    const result = await this.deleteUser(userId);

    // Also delete from Firebase Auth
    try {
      const admin = require('firebase-admin');
      if (admin.apps.length > 0) {
        await admin.auth().deleteUser(userId);
        result.deletedFrom.push('firebase-auth');
      }
    } catch (e) {
      console.warn('[DELETE_ACCOUNT] Firebase Auth deletion failed:', e.message);
    }

    return result;
  }
}

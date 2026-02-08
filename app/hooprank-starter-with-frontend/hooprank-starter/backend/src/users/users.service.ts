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
      console.log('findOrCreate: creating new user with id=', authToken);
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
      const result = await this.dataSource.query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [id]);
      return result.length > 0 ? result[0] : null;
    }

    return this.usersRepository.findOne({ where: { id } });
  }

  async getAll(): Promise<User[]> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      return await this.dataSource.query(`SELECT * FROM users ORDER BY hoop_rank DESC LIMIT 100`);
    }

    return this.usersRepository.find();
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
      console.log('reverseGeocode failed (non-critical):', e.message);
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
            console.log(`updateProfile: inferred city="${city}" from coords (${lat}, ${lng})`);
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
      return await this.dataSource.query(`
        SELECT u.* FROM users u
        JOIN friendships f ON f.friend_id = u.id
        WHERE f.user_id = $1
      `, [userId]);
    }

    const user = await this.usersRepository.findOne({ where: { id: userId }, relations: ['friends'] });
    return user?.friends || [];
  }

  async getMatches(userId: string): Promise<any[]> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      return await this.dataSource.query(`
        SELECT m.*, c.name as court_name, c.city as court_city
        FROM matches m
        LEFT JOIN courts c ON m.court_id = c.id
        WHERE m.creator_id = $1 OR m.opponent_id = $1
        ORDER BY m.created_at DESC
      `, [userId]);
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['createdMatches', 'opponentMatches', 'createdMatches.court', 'opponentMatches.court']
    });
    if (!user) return [];
    return [...(user.createdMatches || []), ...(user.opponentMatches || [])];
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
          AND status = 'completed'
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

  // ==================== FOLLOW METHODS ====================

  async followCourt(userId: string, courtId: string): Promise<void> {
    const isPostgres = !!process.env.DATABASE_URL;
    console.log(`followCourt: userId=${userId}, courtId=${courtId}, isPostgres=${isPostgres}`);
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
      console.log('followCourt: success');
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

  async getFollows(userId: string): Promise<{ courts: any[]; players: any[] }> {
    console.log('getFollows called, userId:', userId);

    // Query courts
    let courts: any[] = [];
    try {
      courts = await this.dataSource.query(
        `SELECT court_id as "courtId" FROM user_followed_courts WHERE user_id = $1`,
        [userId]
      );
      console.log('getFollows courts SUCCESS:', JSON.stringify(courts));
    } catch (courtError) {
      console.error('getFollows courts ERROR:', courtError.message);
      return { courts: [], players: [], courtsError: courtError.message } as any;
    }

    // Query players - separate try-catch
    let players: any[] = [];
    try {
      players = await this.dataSource.query(
        `SELECT followed_id as "playerId" FROM user_followed_players WHERE follower_id = $1`,
        [userId]
      );
      console.log('getFollows players SUCCESS:', JSON.stringify(players));
    } catch (playerError) {
      console.error('getFollows players ERROR:', playerError.message);
      return { courts, players: [], playersError: playerError.message } as any;
    }

    return { courts, players };
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
   * Run one-time schema migrations to fix known issues.
   * This fixes:
   * 1. user_followed_courts.court_id - change from UUID to VARCHAR(255)
   * 2. user_court_alerts - create table if missing
   */
  async runMigrations(): Promise<{ success: boolean; results: string[] }> {
    const isPostgres = !!process.env.DATABASE_URL;
    if (!isPostgres) {
      return { success: true, results: ['Migrations only needed for PostgreSQL'] };
    }

    const results: string[] = [];

    try {
      // Fix 1: Recreate user_followed_courts with VARCHAR(255) for both user_id and court_id
      results.push('Fixing user_followed_courts table...');

      // Check if table exists and has wrong types for either user_id or court_id
      const userIdCheck = await this.dataSource.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_followed_courts' AND column_name = 'user_id'
      `);

      const courtIdCheck = await this.dataSource.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_followed_courts' AND column_name = 'court_id'
      `);

      const needsRecreate =
        (userIdCheck.length > 0 && userIdCheck[0].data_type !== 'character varying') ||
        (courtIdCheck.length > 0 && courtIdCheck[0].data_type !== 'character varying');

      if (needsRecreate) {
        // Drop and recreate with correct types
        results.push(`user_id type: ${userIdCheck[0]?.data_type}, court_id type: ${courtIdCheck[0]?.data_type} - recreating...`);
        await this.dataSource.query(`DROP TABLE IF EXISTS user_followed_courts CASCADE`);
        await this.dataSource.query(`
          CREATE TABLE user_followed_courts (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            court_id VARCHAR(255) NOT NULL,
            alerts_enabled BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, court_id)
          )
        `);
        results.push('Recreated user_followed_courts with VARCHAR(255) for user_id and court_id');
      } else if (userIdCheck.length === 0) {
        // Table doesn't exist, create it
        await this.dataSource.query(`
          CREATE TABLE IF NOT EXISTS user_followed_courts (
            id SERIAL PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            court_id VARCHAR(255) NOT NULL,
            alerts_enabled BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, court_id)
          )
        `);
        results.push('Created user_followed_courts table');
      } else {
        results.push('user_followed_courts has correct types');
      }

      // Fix 2: Create user_court_alerts if missing
      results.push('Checking user_court_alerts table...');
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS user_court_alerts (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          court_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, court_id)
        )
      `);
      results.push('Ensured user_court_alerts table exists');

      // Fix 3: Ensure user_followed_players has correct column types
      results.push('Fixing user_followed_players table...');
      const followerColumnCheck = await this.dataSource.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_followed_players' AND column_name = 'follower_id'
      `);
      const followedColumnCheck = await this.dataSource.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_followed_players' AND column_name = 'followed_id'
      `);

      const followerIsWrongType = followerColumnCheck.length > 0 && followerColumnCheck[0].data_type === 'integer';
      const followedIsWrongType = followedColumnCheck.length > 0 && followedColumnCheck[0].data_type === 'integer';

      if (followerColumnCheck.length === 0) {
        // Table doesn't exist, create it
        await this.dataSource.query(`
          CREATE TABLE IF NOT EXISTS user_followed_players (
            id SERIAL PRIMARY KEY,
            follower_id VARCHAR(255) NOT NULL,
            followed_id VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(follower_id, followed_id)
          )
        `);
        results.push('Created user_followed_players table');
      } else if (followerIsWrongType || followedIsWrongType) {
        // Table exists with wrong column types, recreate it
        await this.dataSource.query(`DROP TABLE IF EXISTS user_followed_players CASCADE`);
        await this.dataSource.query(`
          CREATE TABLE user_followed_players (
            id SERIAL PRIMARY KEY,
            follower_id VARCHAR(255) NOT NULL,
            followed_id VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(follower_id, followed_id)
          )
        `);
        results.push('Recreated user_followed_players with VARCHAR(255) columns');
      } else {
        results.push('user_followed_players has correct types');
      }

      // Fix 4: Add court_id column to player_statuses if missing
      results.push('Checking player_statuses.court_id column...');
      const courtIdColumnCheck = await this.dataSource.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'player_statuses' AND column_name = 'court_id'
      `);
      if (courtIdColumnCheck.length === 0) {
        await this.dataSource.query(`
          ALTER TABLE player_statuses 
          ADD COLUMN court_id VARCHAR(255) NULL
        `);
        results.push('Added court_id column to player_statuses');
      } else {
        results.push('player_statuses.court_id already exists');
      }

      // Fix 4b: Add video columns to player_statuses if missing
      results.push('Checking player_statuses video columns...');
      const videoUrlCheck = await this.dataSource.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'player_statuses' AND column_name = 'video_url'
      `);
      if (videoUrlCheck.length === 0) {
        await this.dataSource.query(`
          ALTER TABLE player_statuses ADD COLUMN video_url VARCHAR(500) NULL
        `);
        results.push('Added video_url column to player_statuses');
      }

      const videoThumbnailCheck = await this.dataSource.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'player_statuses' AND column_name = 'video_thumbnail_url'
      `);
      if (videoThumbnailCheck.length === 0) {
        await this.dataSource.query(`
          ALTER TABLE player_statuses ADD COLUMN video_thumbnail_url VARCHAR(500) NULL
        `);
        results.push('Added video_thumbnail_url column to player_statuses');
      }

      const videoDurationCheck = await this.dataSource.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'player_statuses' AND column_name = 'video_duration_ms'
      `);
      if (videoDurationCheck.length === 0) {
        await this.dataSource.query(`
          ALTER TABLE player_statuses ADD COLUMN video_duration_ms INTEGER NULL
        `);
        results.push('Added video_duration_ms column to player_statuses');
      }

      // Fix 5: Fix player_statuses.user_id from INTEGER to VARCHAR (for Firebase UIDs)
      results.push('Checking player_statuses.user_id type...');
      const statusUserIdType = await this.dataSource.query(`
        SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'player_statuses' AND column_name = 'user_id'
      `);
      if (statusUserIdType.length > 0 && statusUserIdType[0].data_type === 'integer') {
        results.push('player_statuses.user_id is INTEGER, converting to VARCHAR...');

        // First, drop any foreign key constraints on user_id
        try {
          await this.dataSource.query(`
            ALTER TABLE player_statuses 
            DROP CONSTRAINT IF EXISTS player_statuses_user_id_fkey
          `);
          results.push('Dropped player_statuses_user_id_fkey constraint');
        } catch (e) {
          results.push('No FK constraint to drop or already dropped');
        }

        // Now alter the column type
        await this.dataSource.query(`
          ALTER TABLE player_statuses 
          ALTER COLUMN user_id TYPE VARCHAR(255) 
          USING user_id::TEXT
        `);
        results.push('Converted player_statuses.user_id to VARCHAR(255)');
      } else {
        results.push('player_statuses.user_id already correct type');
      }

      // Fix 6: Fix users.id from INTEGER to VARCHAR (for Firebase UIDs)
      results.push('Checking users.id type...');
      const usersIdType = await this.dataSource.query(`
        SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'id'
      `);
      if (usersIdType.length > 0 && usersIdType[0].data_type === 'integer') {
        results.push('users.id is INTEGER, converting to VARCHAR...');

        // Drop ALL foreign key constraints referencing users.id
        const fkConstraints = [
          'player_statuses_user_id_fkey',
          'matches_host_id_fkey',
          'matches_guest_id_fkey',
          'matches_creator_id_fkey',
          'matches_opponent_id_fkey',
          'check_ins_user_id_fkey',
          'friendships_user_id_fkey',
          'friendships_friend_id_fkey',
        ];

        for (const fk of fkConstraints) {
          try {
            const tableName = fk.replace(/_[^_]+_id_fkey$/, '');
            await this.dataSource.query(`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS ${fk}`);
            results.push(`Dropped ${fk}`);
          } catch (e) {
            results.push(`No FK ${fk} to drop`);
          }
        }

        // Drop the primary key constraint with CASCADE
        try {
          await this.dataSource.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey CASCADE`);
          results.push('Dropped users primary key');
        } catch (e) {
          results.push('No PK to drop: ' + e.message);
        }

        // Alter the column type
        await this.dataSource.query(`
          ALTER TABLE users 
          ALTER COLUMN id TYPE VARCHAR(255) 
          USING id::TEXT
        `);
        results.push('Converted users.id to VARCHAR(255)');

        // Re-add primary key
        try {
          await this.dataSource.query(`ALTER TABLE users ADD PRIMARY KEY (id)`);
          results.push('Re-added users primary key');
        } catch (e) {
          results.push('Could not re-add PK: ' + e.message);
        }
      } else {
        results.push('users.id already correct type');
      }

      // Fix 7: Add missing columns to users table
      results.push('Checking for missing columns in users table...');
      const missingColumns = [
        { name: 'position', type: 'TEXT' },
        { name: 'height', type: 'TEXT' },
        { name: 'weight', type: 'INTEGER' },
        { name: 'city', type: 'TEXT' },
      ];

      for (const col of missingColumns) {
        const exists = await this.dataSource.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = $1
        `, [col.name]);

        if (exists.length === 0) {
          await this.dataSource.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
          results.push(`Added column ${col.name}`);
        }
      }
      results.push('Finished checking missing columns');

      // Fix 8: Create teams tables if missing
      results.push('Checking teams tables...');

      // Check if teams table exists
      const teamsTableCheck = await this.dataSource.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_name = 'teams'
      `);

      if (teamsTableCheck.length === 0) {
        await this.dataSource.query(`
          CREATE TABLE teams (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            team_type TEXT NOT NULL,
            owner_id VARCHAR(255) NOT NULL,
            rating NUMERIC(2,1) DEFAULT 3.0,
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            logo_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        results.push('Created teams table');
      } else {
        results.push('teams table already exists');
      }

      // Check if team_members table exists
      const teamMembersCheck = await this.dataSource.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_name = 'team_members'
      `);

      if (teamMembersCheck.length === 0) {
        await this.dataSource.query(`
          CREATE TABLE team_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            user_id VARCHAR(255) NOT NULL,
            status TEXT DEFAULT 'pending',
            role TEXT DEFAULT 'member',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(team_id, user_id)
          )
        `);
        results.push('Created team_members table');
      } else {
        // Check if id column exists
        const idColumnCheck = await this.dataSource.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'team_members' AND column_name = 'id'
        `);

        if (idColumnCheck.length === 0) {
          results.push('team_members table missing id column, recreating...');
          // Drop and recreate with proper schema
          await this.dataSource.query(`DROP TABLE IF EXISTS team_members CASCADE`);
          await this.dataSource.query(`
            CREATE TABLE team_members (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
              user_id VARCHAR(255) NOT NULL,
              status TEXT DEFAULT 'pending',
              role TEXT DEFAULT 'member',
              joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(team_id, user_id)
            )
          `);
          results.push('Recreated team_members table with id column');
        } else {
          results.push('team_members table already exists with correct schema');
        }
      }

      // Check if team_messages table exists
      const teamMessagesCheck = await this.dataSource.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_name = 'team_messages'
      `);

      if (teamMessagesCheck.length === 0) {
        await this.dataSource.query(`
          CREATE TABLE team_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
            sender_id VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        results.push('Created team_messages table');
      } else {
        results.push('team_messages table already exists');
      }

      // Fix 9: Fix check_ins.court_id from UUID to VARCHAR (for OSM/non-UUID court IDs)
      results.push('Checking check_ins.court_id type...');
      const checkInsCourtIdType = await this.dataSource.query(`
        SELECT data_type FROM information_schema.columns 
        WHERE table_name = 'check_ins' AND column_name = 'court_id'
      `);
      if (checkInsCourtIdType.length > 0 && checkInsCourtIdType[0].data_type === 'uuid') {
        results.push('check_ins.court_id is UUID, converting to VARCHAR...');

        // Drop any foreign key constraints on court_id
        try {
          await this.dataSource.query(`
            ALTER TABLE check_ins 
            DROP CONSTRAINT IF EXISTS check_ins_court_id_fkey
          `);
          results.push('Dropped check_ins_court_id_fkey constraint if it existed');
        } catch (e) {
          results.push('No FK constraint to drop or already dropped');
        }

        // Alter the column type
        await this.dataSource.query(`
          ALTER TABLE check_ins 
          ALTER COLUMN court_id TYPE VARCHAR(255) 
          USING court_id::TEXT
        `);
        results.push('Converted check_ins.court_id to VARCHAR(255)');
      } else if (checkInsCourtIdType.length === 0) {
        results.push('check_ins table does not exist or has no court_id column');
      } else {
        results.push('check_ins.court_id already correct type: ' + checkInsCourtIdType[0].data_type);
      }

      return { success: true, results };
    } catch (error) {
      results.push(`Error: ${error.message}`);
      return { success: false, results };
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
        console.log('getNearbyUsers: user not found');
        return [];
      }

      let { lat, lng, zip, city } = currentUser[0];

      // Fallback to zip code coordinates if no GPS
      if ((!lat || !lng) && zip && zipCoords[zip]) {
        lat = zipCoords[zip].lat;
        lng = zipCoords[zip].lng;
        console.log(`getNearbyUsers: using zip ${zip} coords (${lat}, ${lng}) for user ${userId}`);
      }

      // If still no location, return all users as fallback
      if (!lat || !lng) {
        console.log('getNearbyUsers: user has no location or zip, returning all users');
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

      console.log(`getNearbyUsers: found ${nearbyUsers.length} users within ${radiusMiles} miles of (${lat}, ${lng})`);
      return nearbyUsers;
    } catch (error) {
      console.error('getNearbyUsers error:', error.message);
      return [];
    }
  }
}


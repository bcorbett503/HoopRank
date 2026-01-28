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
      // Check if user exists by auth_token
      const existing = await this.dataSource.query(
        `SELECT * FROM users WHERE auth_token = $1 LIMIT 1`,
        [authToken]
      );

      if (existing.length > 0) {
        return existing[0];
      }

      // Create new user
      const result = await this.dataSource.query(`
        INSERT INTO users (id, email, auth_token, name, hoop_rank, reputation, loc_enabled, created_at, updated_at)
        VALUES ($1, $2, $3, 'New Player', 3.0, 5.0, false, NOW(), NOW())
        RETURNING *
      `, [authToken, email, authToken]);

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

  async updateProfile(id: string, data: Partial<any>): Promise<User> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Map camelCase to snake_case for production columns
      const columnMap: Record<string, string> = {
        name: 'name',
        email: 'email',
        avatarUrl: 'avatar_url',
        hoopRank: 'hoop_rank',
        position: 'position',
        height: 'height',
        weight: 'weight',
        city: 'city',
        gamesPlayed: 'games_played',
        fcmToken: 'fcm_token',
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
    const isPostgres = !!process.env.DATABASE_URL;

    try {
      const courtsQuery = isPostgres
        ? `SELECT court_id as "courtId" FROM user_followed_courts WHERE user_id = $1`
        : `SELECT court_id as "courtId" FROM user_followed_courts WHERE user_id = ?`;
      const courts = await this.dataSource.query(courtsQuery, [userId]);

      const playersQuery = isPostgres
        ? `SELECT followed_id as "playerId" FROM user_followed_players WHERE follower_id = $1`
        : `SELECT followed_id as "playerId" FROM user_followed_players WHERE follower_id = ?`;
      const players = await this.dataSource.query(playersQuery, [userId]);

      return { courts, players };
    } catch (error) {
      console.error('getFollows error (tables may not exist):', error.message);
      return { courts: [], players: [] };
    }
  }

  async getFollowedActivity(userId: string): Promise<{ courtActivity: any[]; playerActivity: any[] }> {
    return { courtActivity: [], playerActivity: [] };
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

      // Fix 3: Ensure user_followed_players has correct type
      const playerColumnCheck = await this.dataSource.query(`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_followed_players' AND column_name = 'follower_id'
      `);

      if (playerColumnCheck.length === 0) {
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
      } else {
        results.push('user_followed_players table exists');
      }

      return { success: true, results };
    } catch (error) {
      results.push(`Error: ${error.message}`);
      return { success: false, results };
    }
  }
}


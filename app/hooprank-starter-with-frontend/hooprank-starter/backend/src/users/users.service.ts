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

  async findOrCreate(firebaseUid: string, email: string): Promise<User> {
    let user = await this.usersRepository.findOne({ where: { firebaseUid } });
    if (!user) {
      user = this.usersRepository.create({
        firebaseUid,
        email,
        // Default stats
        rating: 2.5,
        offense: 2.5,
        defense: 2.5,
        shooting: 2.5,
        passing: 2.5,
        rebounding: 2.5,
      });
      await this.usersRepository.save(user);
    }
    return user;
  }

  async seed(): Promise<string> {
    const mockPlayers = [
      {
        firebaseUid: 'mock-player-1',
        email: 'lebron@example.com',
        name: 'LeBron James',
        photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/cf/LeBron_James_crop_2020.jpg',
        rating: 5.0,
        position: 'F',
        height: "6'9\"",
        weight: '250 lbs',
        age: 39,
        matchesPlayed: 1400,
      },
      {
        firebaseUid: 'mock-player-2',
        email: 'curry@example.com',
        name: 'Stephen Curry',
        photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Stephen_Curry_2016_June_16.jpg',
        rating: 4.9,
        position: 'G',
        height: "6'2\"",
        weight: '185 lbs',
        age: 36,
        matchesPlayed: 900,
      },
      {
        firebaseUid: 'mock-player-3',
        email: 'durant@example.com',
        name: 'Kevin Durant',
        photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Kevin_Durant_2018_June_08.jpg',
        rating: 4.9,
        position: 'F',
        height: "6'10\"",
        weight: '240 lbs',
        age: 35,
        matchesPlayed: 1000,
      },
      {
        firebaseUid: 'mock-player-4',
        email: 'jokic@example.com',
        name: 'Nikola Jokic',
        photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Nikola_Joki%C4%87_2019.jpg',
        rating: 5.0,
        position: 'C',
        height: "6'11\"",
        weight: '284 lbs',
        age: 29,
        matchesPlayed: 600,
      },
      {
        firebaseUid: 'mock-player-5',
        email: 'luka@example.com',
        name: 'Luka Doncic',
        photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Luka_Doncic_2021.jpg',
        rating: 4.8,
        position: 'G',
        height: "6'7\"",
        weight: '230 lbs',
        age: 25,
        matchesPlayed: 400,
      },
    ];

    for (const player of mockPlayers) {
      const existing = await this.findOrCreate(player.firebaseUid, player.email);
      await this.updateProfile(existing.id, {
        name: player.name,
        photoUrl: player.photoUrl,
        rating: player.rating,
        position: player.position,
        height: player.height,
        weight: player.weight,
        age: player.age,
        matchesPlayed: player.matchesPlayed,
      });
    }
    return 'Seeded successfully';
  }

  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async getAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async updateProfile(id: string, data: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, data);
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async get(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async setRating(id: string, rating: number): Promise<void> {
    await this.usersRepository.update(id, { rating });
  }

  async addFriend(userId: string, friendId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId }, relations: ['friends'] });
    const friend = await this.usersRepository.findOne({ where: { id: friendId } });

    if (user && friend) {
      user.friends = [...(user.friends || []), friend];
      await this.usersRepository.save(user);
    }
  }

  async removeFriend(userId: string, friendId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId }, relations: ['friends'] });

    if (user) {
      user.friends = user.friends.filter(f => f.id !== friendId);
      await this.usersRepository.save(user);
    }
  }

  async getFriends(userId: string): Promise<User[]> {
    const user = await this.usersRepository.findOne({ where: { id: userId }, relations: ['friends'] });
    return user?.friends || [];
  }

  async getMatches(userId: string): Promise<any[]> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['hostedMatches', 'guestMatches', 'hostedMatches.court', 'guestMatches.court']
    });

    if (!user) return [];

    const matches = [...(user.hostedMatches || []), ...(user.guestMatches || [])];
    // Sort by date desc
    return matches.sort((a, b) => {
      const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  // ==================== FOLLOW METHODS ====================

  async followCourt(userId: string, courtId: string): Promise<void> {
    const isPostgres = !!process.env.DATABASE_URL;
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

    // Get followed courts
    const courtsQuery = isPostgres
      ? `SELECT court_id as "courtId" FROM user_followed_courts WHERE user_id = $1`
      : `SELECT court_id as "courtId" FROM user_followed_courts WHERE user_id = ?`;
    const courts = await this.dataSource.query(courtsQuery, [userId]);

    // Get followed players
    const playersQuery = isPostgres
      ? `SELECT followed_id as "playerId" FROM user_followed_players WHERE follower_id = $1`
      : `SELECT followed_id as "playerId" FROM user_followed_players WHERE follower_id = ?`;
    const players = await this.dataSource.query(playersQuery, [userId]);

    return { courts, players };
  }

  async getFollowedActivity(userId: string): Promise<{ courtActivity: any[]; playerActivity: any[] }> {
    // Simplified for now - just return empty arrays
    // Full implementation would require dialect-aware date handling
    return { courtActivity: [], playerActivity: [] };
  }
}

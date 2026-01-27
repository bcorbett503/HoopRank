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

  async followCourt(userId: number, courtId: string): Promise<void> {
    await this.dataSource.query(`
      INSERT INTO user_followed_courts (user_id, court_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, court_id) DO NOTHING
    `, [userId, courtId]);
  }

  async unfollowCourt(userId: number, courtId: string): Promise<void> {
    await this.dataSource.query(`
      DELETE FROM user_followed_courts WHERE user_id = $1 AND court_id = $2
    `, [userId, courtId]);
  }

  async followPlayer(followerId: number, followedId: number): Promise<void> {
    await this.dataSource.query(`
      INSERT INTO user_followed_players (follower_id, followed_id)
      VALUES ($1, $2)
      ON CONFLICT (follower_id, followed_id) DO NOTHING
    `, [followerId, followedId]);
  }

  async unfollowPlayer(followerId: number, followedId: number): Promise<void> {
    await this.dataSource.query(`
      DELETE FROM user_followed_players WHERE follower_id = $1 AND followed_id = $2
    `, [followerId, followedId]);
  }

  async getFollows(userId: number): Promise<{ courts: any[]; players: any[] }> {
    // Get followed courts
    const courts = await this.dataSource.query(`
      SELECT fc.court_id as "courtId", 
             CASE WHEN ca.court_id IS NOT NULL THEN true ELSE false END as "alertsEnabled"
      FROM user_followed_courts fc
      LEFT JOIN user_court_alerts ca ON fc.user_id = ca.user_id AND fc.court_id = ca.court_id
      WHERE fc.user_id = $1
    `, [userId]);

    // Get followed players
    const players = await this.dataSource.query(`
      SELECT fp.followed_id as "playerId", u.name, u.photo_url as "photoUrl"
      FROM user_followed_players fp
      JOIN users u ON fp.followed_id = u.id
      WHERE fp.follower_id = $1
    `, [userId]);

    return { courts, players };
  }

  async getFollowedActivity(userId: number): Promise<{ courtActivity: any[]; playerActivity: any[] }> {
    // Get activity from followed courts (last 24 hours)
    const courtActivity = await this.dataSource.query(`
      SELECT 
        ci.id,
        ci.court_id as "courtId",
        ci.user_id as "userId",
        u.display_name as "userName",
        u.avatar_url as "userPhotoUrl",
        ci.checked_in_at as "checkedInAt",
        ci.checked_out_at as "checkedOutAt",
        'check_in' as "activityType"
      FROM court_check_ins ci
      JOIN users u ON ci.user_id = u.id
      WHERE ci.court_id IN (
        SELECT court_id FROM user_followed_courts WHERE user_id = $1
      )
      AND ci.checked_in_at > NOW() - INTERVAL '24 hours'
      ORDER BY ci.checked_in_at DESC
      LIMIT 50
    `, [userId]);

    // Get recent matches from followed players (last 7 days)
    const playerActivity = await this.dataSource.query(`
      SELECT 
        m.id as "matchId",
        m.host_id as "hostId",
        m.guest_id as "guestId",
        host.display_name as "hostName",
        host.avatar_url as "hostPhotoUrl",
        guest.display_name as "guestName",
        guest.avatar_url as "guestPhotoUrl",
        m.status,
        m.created_at as "createdAt",
        'match' as "activityType"
      FROM matches m
      JOIN users host ON m.host_id = host.id
      JOIN users guest ON m.guest_id = guest.id
      WHERE (m.host_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id = $1)
         OR m.guest_id IN (SELECT followed_id FROM user_followed_players WHERE follower_id = $1))
      AND m.created_at > NOW() - INTERVAL '7 days'
      ORDER BY m.created_at DESC
      LIMIT 50
    `, [userId]);

    return { courtActivity, playerActivity };
  }
}

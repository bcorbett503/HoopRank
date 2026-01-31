import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Match } from './match.entity';
import { UsersService } from '../users/users.service';
import { HoopRankService } from '../ratings/hooprank.service';

@Injectable()
export class MatchesService {
  private rater = new HoopRankService();

  constructor(
    @InjectRepository(Match)
    private matchesRepository: Repository<Match>,
    private readonly users: UsersService,
    private dataSource: DataSource,
  ) { }

  async create(creatorId: string, opponentId?: string, courtId?: string): Promise<Match> {
    // Use raw SQL for production compatibility
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      const result = await this.dataSource.query(`
        INSERT INTO matches (id, status, match_type, creator_id, opponent_id, court_id, started_by, created_at, updated_at)
        VALUES (gen_random_uuid(), 'pending', '1v1', $1, $2, $3, '{}', NOW(), NOW())
        RETURNING *
      `, [creatorId, opponentId || null, courtId || null]);
      return result[0];
    }

    // SQLite fallback (shouldn't happen in production)
    const match = this.matchesRepository.create({
      creatorId,
      opponentId,
      status: 'pending',
      matchType: '1v1',
      courtId
    } as any);
    const saved = await this.matchesRepository.save(match);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  async accept(id: string, opponentId: string): Promise<Match> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      await this.dataSource.query(`
        UPDATE matches SET opponent_id = $2, status = 'accepted', updated_at = NOW()
        WHERE id = $1
      `, [id, opponentId]);
      const result = await this.dataSource.query(`SELECT * FROM matches WHERE id = $1`, [id]);
      return result[0];
    }

    const m = await this.matchesRepository.findOne({ where: { id } });
    if (!m) throw new Error('match not found');

    m.opponentId = opponentId;
    m.status = 'accepted';
    return await this.matchesRepository.save(m);
  }

  async complete(id: string, winnerId: string): Promise<Match> {
    return this.completeWithScores(id, winnerId, null, null);
  }

  async completeWithScores(id: string, winnerId: string, scoreCreator: number | null, scoreOpponent: number | null): Promise<Match> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      // Get match with creator and opponent
      const matchResult = await this.dataSource.query(`SELECT * FROM matches WHERE id = $1`, [id]);
      if (!matchResult[0] || !matchResult[0].opponent_id) throw new Error('invalid match');

      const m = matchResult[0];
      const creator = await this.users.get(m.creator_id);
      const opponent = await this.users.get(m.opponent_id);

      if (!creator || !opponent) throw new Error('users not found');

      const creatorWon = winnerId === m.creator_id;

      // Update ratings using new HoopRank logic
      const newCreatorRating = this.rater.updateRating(creator.hoopRank || 3.0, opponent.hoopRank || 3.0, creator.gamesPlayed || 0, creatorWon ? 1 : 0);
      const newOpponentRating = this.rater.updateRating(opponent.hoopRank || 3.0, creator.hoopRank || 3.0, opponent.gamesPlayed || 0, creatorWon ? 0 : 1);

      // Update users
      await this.dataSource.query(`
        UPDATE users SET hoop_rank = $1, games_played = COALESCE(games_played, 0) + 1, updated_at = NOW()
        WHERE id = $2
      `, [newCreatorRating, creator.id]);

      await this.dataSource.query(`
        UPDATE users SET hoop_rank = $1, games_played = COALESCE(games_played, 0) + 1, updated_at = NOW()
        WHERE id = $2
      `, [newOpponentRating, opponent.id]);

      // Complete match with scores
      await this.dataSource.query(`
        UPDATE matches SET status = 'completed', winner_id = $2, 
          score_creator = $3, score_opponent = $4, updated_at = NOW()
        WHERE id = $1
      `, [id, winnerId, scoreCreator, scoreOpponent]);

      // Update associated challenge to 'completed' status
      await this.dataSource.query(`
        UPDATE messages SET challenge_status = 'completed', updated_at = NOW()
        WHERE match_id = $1 AND is_challenge = true
      `, [id]);

      const result = await this.dataSource.query(`SELECT * FROM matches WHERE id = $1`, [id]);
      return result[0];
    }

    // SQLite fallback
    const m = await this.matchesRepository.findOne({ where: { id } });
    if (!m || !m.opponentId) throw new Error('invalid match');

    m.status = 'completed';
    m.winnerId = winnerId;
    if (scoreCreator !== null) (m as any).scoreCreator = scoreCreator;
    if (scoreOpponent !== null) (m as any).scoreOpponent = scoreOpponent;
    return await this.matchesRepository.save(m);
  }

  async get(id: string): Promise<Match | undefined> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      const result = await this.dataSource.query(`
        SELECT m.*, 
          c.name as court_name, c.city as court_city
        FROM matches m
        LEFT JOIN courts c ON m.court_id = c.id
        WHERE m.id = $1
      `, [id]);
      if (result.length === 0) return undefined;
      return result[0];
    }

    return await this.matchesRepository.findOne({ where: { id }, relations: ['creator', 'opponent', 'court'] }) || undefined;
  }

  async findByCourt(courtId: string): Promise<Match[]> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      return await this.dataSource.query(`
        SELECT * FROM matches WHERE court_id = $1 ORDER BY created_at DESC
      `, [courtId]);
    }

    return await this.matchesRepository.find({ where: { courtId } });
  }
}

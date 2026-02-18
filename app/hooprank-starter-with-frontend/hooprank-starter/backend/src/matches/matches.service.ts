import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Match } from './match.entity';
import { UsersService } from '../users/users.service';
import { HoopRankService } from '../ratings/hooprank.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MatchesService {
  private rater = new HoopRankService();

  constructor(
    @InjectRepository(Match)
    private matchesRepository: Repository<Match>,
    private readonly users: UsersService,
    private dataSource: DataSource,
    private notificationsService: NotificationsService,
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

  async completeWithScores(id: string, winnerId: string, scoreCreator: number | null, scoreOpponent: number | null, courtId?: string): Promise<Match> {
    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      // Get match with creator and opponent
      const matchResult = await this.dataSource.query(`SELECT * FROM matches WHERE id = $1`, [id]);
      if (!matchResult[0] || !matchResult[0].opponent_id) throw new Error('invalid match');

      const m = matchResult[0];

      // Only update ratings if match is not already completed
      const isFirstCompletion = m.status !== 'completed';

      if (isFirstCompletion) {
        const creator = await this.users.get(m.creator_id);
        const opponent = await this.users.get(m.opponent_id);

        if (!creator || !opponent) throw new Error('users not found');

        const creatorWon = winnerId === m.creator_id;

        // Get ratings - raw SQL returns snake_case (hoop_rank, games_played)
        // Cast to any since raw SQL doesn't match User entity type
        const creatorRating = parseFloat((creator as any).hoop_rank) || 3.0;
        const opponentRating = parseFloat((opponent as any).hoop_rank) || 3.0;
        const creatorGames = parseInt((creator as any).games_played) || 0;
        const opponentGames = parseInt((opponent as any).games_played) || 0;


        // Update ratings using new HoopRank logic
        const newCreatorRating = this.rater.updateRating(creatorRating, opponentRating, creatorGames, creatorWon ? 1 : 0);
        const newOpponentRating = this.rater.updateRating(opponentRating, creatorRating, opponentGames, creatorWon ? 0 : 1);


        // Update users
        await this.dataSource.query(`
          UPDATE users SET hoop_rank = $1, games_played = COALESCE(games_played, 0) + 1, updated_at = NOW()
          WHERE id = $2
        `, [newCreatorRating, creator.id]);

        await this.dataSource.query(`
          UPDATE users SET hoop_rank = $1, games_played = COALESCE(games_played, 0) + 1, updated_at = NOW()
          WHERE id = $2
        `, [newOpponentRating, opponent.id]);

        // Send notifications to both players
        const creatorDelta = newCreatorRating - creatorRating;
        const opponentDelta = newOpponentRating - opponentRating;
        const creatorName = (creator as any).name || 'Opponent';
        const opponentName = (opponent as any).name || 'Opponent';

        this.notificationsService.sendMatchCompletedNotification(
          m.creator_id, newCreatorRating, creatorDelta, opponentName, creatorWon
        ).catch(() => { });

        this.notificationsService.sendMatchCompletedNotification(
          m.opponent_id, newOpponentRating, opponentDelta, creatorName, !creatorWon
        ).catch(() => { });
      }

      // Complete match with scores and court (always update scores even if already completed)
      // If courtId provided AND is a valid UUID, update it - otherwise keep existing court_id
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isValidUUID = courtId && uuidRegex.test(courtId);

      if (isValidUUID) {
        await this.dataSource.query(`
          UPDATE matches SET status = 'completed', winner_id = $2, 
            score_creator = $3, score_opponent = $4, court_id = $5, updated_at = NOW()
          WHERE id = $1
        `, [id, winnerId, scoreCreator, scoreOpponent, courtId]);
      } else {
        if (courtId) {
        }
        await this.dataSource.query(`
          UPDATE matches SET status = 'completed', winner_id = $2, 
            score_creator = $3, score_opponent = $4, updated_at = NOW()
          WHERE id = $1
        `, [id, winnerId, scoreCreator, scoreOpponent]);
      }

      // Update associated challenge to 'completed' status in new challenges table
      await this.dataSource.query(`
        UPDATE challenges SET status = 'completed', updated_at = NOW()
        WHERE match_id = $1
      `, [id]);

      // Create shadow player_status for likes/comments (only on first completion)
      if (isFirstCompletion) {
        try {
          const updatedMatch = await this.dataSource.query(`SELECT * FROM matches WHERE id = $1`, [id]);
          const um = updatedMatch[0];
          const creatorName = (await this.users.get(um.creator_id) as any)?.name || 'Player';
          const opponentName = (await this.users.get(um.opponent_id) as any)?.name || 'Opponent';
          const scoreStr = um.score_creator != null && um.score_opponent != null
            ? `: ${um.score_creator}-${um.score_opponent}` : '';
          const content = `${creatorName} vs ${opponentName}${scoreStr}`;

          const statusResult = await this.dataSource.query(`
            INSERT INTO player_statuses (user_id, content, court_id, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id
          `, [winnerId, content, um.court_id || null]);

          if (statusResult[0]?.id) {
            await this.dataSource.query(`UPDATE matches SET status_id = $1 WHERE id = $2`, [statusResult[0].id, id]);
          }
        } catch (e) {
          console.error('[completeWithScores] Shadow status creation error (non-fatal):', e.message);
        }
      }

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

  /**
   * Phase 1: Store scores and IMMEDIATELY complete the match (update ratings,
   * create feed item, mark challenge done). The opponent can still contest,
   * which will reverse all effects.
   */
  async submitScoreOnly(
    id: string,
    submitterId: string,
    scoreCreator: number,
    scoreOpponent: number,
    courtId?: string,
  ): Promise<Match> {
    const isPostgres = !!process.env.DATABASE_URL;
    if (!isPostgres) throw new Error('Only supported on PostgreSQL');

    const match = await this.get(id);
    if (!match) throw new Error('Match not found');

    const status = ((match as any).status || '').toString().toLowerCase();
    // Allow score submission while match is active, or while replacing a
    // previously submitted score before final confirmation.
    if (!['accepted', 'live', 'score_submitted', 'pending_confirmation'].includes(status)) {
      throw new Error(`Cannot submit score while match status is '${status}'`);
    }

    const creatorId = (match as any).creator_id || match.creatorId;
    const opponentId = (match as any).opponent_id || match.opponentId;

    if (submitterId !== creatorId && submitterId !== opponentId) {
      throw new Error('You are not a participant in this match');
    }

    // Store score_submitter_id so contestScore knows who submitted
    await this.dataSource.query(`
      UPDATE matches SET score_submitter_id = $2, updated_at = NOW()
      WHERE id = $1
    `, [id, submitterId]);

    // Determine the winner and immediately complete the match
    const winnerId = scoreCreator > scoreOpponent ? creatorId : opponentId;
    const completed = await this.completeWithScores(id, winnerId, scoreCreator, scoreOpponent, courtId);

    // Notify the OTHER player so they can confirm or contest
    const otherUserId = submitterId === creatorId ? opponentId : creatorId;
    const submitterResult = await this.dataSource.query(`SELECT name FROM users WHERE id = $1`, [submitterId]);
    const submitterName = submitterResult[0]?.name || 'Your opponent';

    this.notificationsService.sendScoreSubmittedNotification(
      otherUserId, submitterName, scoreCreator, scoreOpponent, id
    ).catch(() => { });

    return completed;
  }

  /**
   * Phase 2a: Opponent confirms the score.
   * With instant results, the match is already completed — this is a no-op
   * acknowledgment. Kept for backward compatibility.
   */
  async confirmScore(matchId: string, confirmerId: string): Promise<Match> {
    const isPostgres = !!process.env.DATABASE_URL;
    if (!isPostgres) throw new Error('Only supported on PostgreSQL');

    const match = await this.get(matchId);
    if (!match) throw new Error('Match not found');

    const status = (match as any).status;

    // Match is already completed (instant results) — just return it
    if (status === 'completed') {
      return match;
    }

    // Backward compat: if still score_submitted (old flow), complete it
    if (status === 'score_submitted') {
      const creatorId = (match as any).creator_id || match.creatorId;
      const opponentId = (match as any).opponent_id || match.opponentId;
      const scoreCreator = parseInt((match as any).score_creator);
      const scoreOpponent = parseInt((match as any).score_opponent);
      const winnerId = scoreCreator > scoreOpponent ? creatorId : opponentId;
      return this.completeWithScores(matchId, winnerId, scoreCreator, scoreOpponent);
    }

    throw new Error(`Cannot confirm — match status is '${status}'`);
  }

  /**
   * Phase 2b: Opponent contests the score — REVERSES instant results:
   * restores original ratings, decrements games_played, deletes the shadow
   * feed item, and sets the match to 'contested'.
   */
  async contestScore(matchId: string, contesterId: string): Promise<Match> {
    const isPostgres = !!process.env.DATABASE_URL;
    if (!isPostgres) throw new Error('Only supported on PostgreSQL');

    const match = await this.get(matchId);
    if (!match) throw new Error('Match not found');

    const status = (match as any).status;
    // Accept both completed (instant results) and score_submitted (legacy)
    if (status !== 'completed' && status !== 'score_submitted') {
      throw new Error(`Cannot contest — match status is '${status}'`);
    }

    const creatorId = (match as any).creator_id || match.creatorId;
    const opponentId = (match as any).opponent_id || match.opponentId;
    const submitterId = (match as any).score_submitter_id;

    // Only the NON-submitter can contest
    if (contesterId === submitterId) {
      throw new Error('You submitted the score — you cannot contest your own submission');
    }
    if (contesterId !== creatorId && contesterId !== opponentId) {
      throw new Error('You are not a participant in this match');
    }

    // --- Reverse the instant rating changes ---
    const scoreCreator = parseInt((match as any).score_creator);
    const scoreOpponent = parseInt((match as any).score_opponent);

    if (!isNaN(scoreCreator) && !isNaN(scoreOpponent)) {
      const creator = await this.users.get(creatorId);
      const opponent = await this.users.get(opponentId);

      if (creator && opponent) {
        const creatorWon = (match as any).winner_id === creatorId;
        const curCreatorRating = parseFloat((creator as any).hoop_rank) || 3.0;
        const curOpponentRating = parseFloat((opponent as any).hoop_rank) || 3.0;
        // games_played was incremented during completion — use current - 1 for
        // the reverse calculation so the K-factor matches what was applied.
        const curCreatorGames = Math.max((parseInt((creator as any).games_played) || 1) - 1, 0);
        const curOpponentGames = Math.max((parseInt((opponent as any).games_played) || 1) - 1, 0);

        // Reverse: recalculate what the rating WAS before the match completed
        const origCreatorRating = this.rater.updateRating(curCreatorRating, curOpponentRating, curCreatorGames, creatorWon ? 0 : 1);
        const origOpponentRating = this.rater.updateRating(curOpponentRating, curCreatorRating, curOpponentGames, creatorWon ? 1 : 0);

        // Restore original ratings and decrement games_played
        await this.dataSource.query(`
          UPDATE users SET hoop_rank = $1, games_played = GREATEST(COALESCE(games_played, 1) - 1, 0), updated_at = NOW()
          WHERE id = $2
        `, [origCreatorRating, creatorId]);

        await this.dataSource.query(`
          UPDATE users SET hoop_rank = $1, games_played = GREATEST(COALESCE(games_played, 1) - 1, 0), updated_at = NOW()
          WHERE id = $2
        `, [origOpponentRating, opponentId]);
      }
    }

    // --- Delete shadow feed item ---
    const statusId = (match as any).status_id;
    if (statusId) {
      await this.dataSource.query(`DELETE FROM player_statuses WHERE id = $1`, [statusId]).catch(() => { });
    }

    // --- Reset match state ---
    await this.dataSource.query(`
      UPDATE matches SET status = 'contested', score_creator = NULL, score_opponent = NULL,
        winner_id = NULL, status_id = NULL, updated_at = NOW()
      WHERE id = $1
    `, [matchId]);

    // Revert challenge status back to accepted so it remains visible
    await this.dataSource.query(`
      UPDATE challenges SET status = 'accepted', updated_at = NOW()
      WHERE match_id = $1
    `, [matchId]);

    // Increment games_contested for both players
    await this.dataSource.query(`
      UPDATE users SET games_contested = COALESCE(games_contested, 0) + 1, updated_at = NOW()
      WHERE id = $1 OR id = $2
    `, [creatorId, opponentId]);

    // Notify the submitter that the score was contested
    const contesterResult = await this.dataSource.query(`SELECT name FROM users WHERE id = $1`, [contesterId]);
    const contesterName = contesterResult[0]?.name || 'Your opponent';

    this.notificationsService.sendScoreContestedNotification(
      submitterId, contesterName, matchId
    ).catch(() => { });

    const result = await this.dataSource.query(`SELECT * FROM matches WHERE id = $1`, [matchId]);
    return result[0];
  }

  /**
   * Get matches awaiting score confirmation from this user.
   * Returns matches with status 'score_submitted' where this user is NOT the submitter.
   * Response shape matches mobile expectation: {matchId, opponentName, score: {me, opponent}}
   */
  async getPendingConfirmations(userId: string): Promise<any[]> {
    const isPostgres = !!process.env.DATABASE_URL;
    if (!isPostgres) return [];

    const results = await this.dataSource.query(`
      SELECT m.*,
        c.name as court_name, c.city as court_city,
        creator.name as creator_name,
        opponent.name as opponent_name
      FROM matches m
      LEFT JOIN courts c ON m.court_id = c.id
      LEFT JOIN users creator ON m.creator_id = creator.id
      LEFT JOIN users opponent ON m.opponent_id = opponent.id
      WHERE (m.creator_id = $1 OR m.opponent_id = $1)
        AND m.status = 'score_submitted'
        AND m.score_submitter_id IS NOT NULL
        AND m.score_submitter_id != $1
      ORDER BY m.updated_at DESC
    `, [userId]);

    // Transform to shape expected by mobile app
    return results.map((m: any) => {
      const isUserCreator = m.creator_id === userId;
      const opponentName = isUserCreator ? m.opponent_name : m.creator_name;
      const myScore = isUserCreator ? m.score_creator : m.score_opponent;
      const theirScore = isUserCreator ? m.score_opponent : m.score_creator;

      return {
        matchId: m.id,
        opponentName: opponentName || 'Opponent',
        score: { me: parseInt(myScore), opponent: parseInt(theirScore) },
        courtName: m.court_name,
        createdAt: m.updated_at,
      };
    });
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

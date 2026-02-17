import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Challenge } from './challenge.entity';
import { v4 as uuidv4 } from 'uuid';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChallengesService {
    constructor(
        @InjectRepository(Challenge)
        private challengesRepository: Repository<Challenge>,
        private dataSource: DataSource,
        private notificationsService: NotificationsService,
    ) { }

    /**
     * Create a new challenge between two players
     */
    async create(fromUserId: string, toUserId: string, message?: string, courtId?: string): Promise<Challenge> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            // Block duplicate challenge creation only when there is an unresolved active challenge.
            // Accepted challenges tied to finished/score-submitted matches should not prevent rematches.
            const existing = await this.dataSource.query(`
                SELECT c.id
                FROM challenges c
                LEFT JOIN matches m ON m.id = c.match_id
                WHERE ((c.from_user_id = $1 AND c.to_user_id = $2) OR (c.from_user_id = $2 AND c.to_user_id = $1))
                  AND (
                    c.status = 'pending'
                    OR (
                      c.status = 'accepted'
                      AND (
                        c.match_id IS NULL
                        OR COALESCE(m.status, 'accepted') IN ('pending', 'accepted', 'live', 'score_submitted', 'pending_confirmation')
                      )
                    )
                  )
                LIMIT 1
            `, [fromUserId, toUserId]);

            if (existing.length > 0) {
                throw new HttpException('You already have an active challenge with this player', HttpStatus.CONFLICT);
            }

            const id = uuidv4();
            await this.dataSource.query(`
                INSERT INTO challenges (id, from_user_id, to_user_id, court_id, message, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
            `, [id, fromUserId, toUserId, courtId || null, message || 'Want to play?']);

            const result = await this.dataSource.query(`SELECT * FROM challenges WHERE id = $1`, [id]);

            // Send notification to recipient
            const senderName = await this.getUserName(fromUserId);
            this.notificationsService.sendChallengeNotification(toUserId, senderName, 'received', id).catch(() => { });

            return result[0];
        }

        // SQLite fallback
        const challenge = this.challengesRepository.create({
            id: uuidv4(),
            fromUserId,
            toUserId,
            courtId,
            message: message || 'Want to play?',
            status: 'pending',
        });
        const saved = await this.challengesRepository.save(challenge);

        // Send notification
        const senderName = await this.getUserName(fromUserId);
        this.notificationsService.sendChallengeNotification(toUserId, senderName, 'received', saved.id).catch(() => { });

        return saved;
    }

    private async getUserName(userId: string): Promise<string> {
        const isPostgres = !!process.env.DATABASE_URL;
        const query = isPostgres
            ? `SELECT name FROM users WHERE id = $1`
            : `SELECT name FROM users WHERE id = ?`;
        const result = await this.dataSource.query(query, [userId]);
        return result[0]?.name || 'Someone';
    }

    /**
     * Get pending challenges for a user (incoming)
     */
    async getPendingForUser(userId: string): Promise<any[]> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            return this.dataSource.query(`
                SELECT 
                    c.*,
                    json_build_object(
                        'id', fu.id,
                        'name', fu.name,
                        'avatarUrl', fu.avatar_url,
                        'hoopRank', fu.hoop_rank
                    ) as "fromUser",
                    json_build_object(
                        'id', tu.id,
                        'name', tu.name,
                        'avatarUrl', tu.avatar_url,
                        'hoopRank', tu.hoop_rank
                    ) as "toUser",
                    CASE WHEN ct.id IS NOT NULL THEN json_build_object(
                        'id', ct.id,
                        'name', ct.name,
                        'city', ct.city
                    ) ELSE NULL END as "court"
                FROM challenges c
                LEFT JOIN users fu ON c.from_user_id = fu.id
                LEFT JOIN users tu ON c.to_user_id = tu.id
                LEFT JOIN courts ct ON c.court_id::TEXT = ct.id::TEXT
                WHERE c.to_user_id = $1 AND c.status = 'pending'
                ORDER BY c.created_at DESC
            `, [userId]);
        }

        return this.challengesRepository.find({
            where: { toUserId: userId, status: 'pending' },
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Get all challenges for a user (both sent and received)
     */
    async getAllForUser(userId: string): Promise<any[]> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            return this.dataSource.query(`
                SELECT 
                    c.*,
                    json_build_object(
                        'id', fu.id,
                        'name', fu.name,
                        'avatarUrl', fu.avatar_url,
                        'hoopRank', fu.hoop_rank
                    ) as "fromUser",
                    json_build_object(
                        'id', tu.id,
                        'name', tu.name,
                        'avatarUrl', tu.avatar_url,
                        'hoopRank', tu.hoop_rank
                    ) as "toUser",
                    CASE WHEN ct.id IS NOT NULL THEN json_build_object(
                        'id', ct.id,
                        'name', ct.name,
                        'city', ct.city
                    ) ELSE NULL END as "court"
                FROM challenges c
                LEFT JOIN users fu ON c.from_user_id = fu.id
                LEFT JOIN users tu ON c.to_user_id = tu.id
                LEFT JOIN courts ct ON c.court_id::TEXT = ct.id::TEXT
                WHERE (c.from_user_id = $1 OR c.to_user_id = $1)
                AND c.status IN ('pending', 'accepted')
                ORDER BY c.created_at DESC
            `, [userId]);
        }

        return this.challengesRepository.find({
            where: [
                { fromUserId: userId },
                { toUserId: userId },
            ],
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Accept a challenge - creates a match and links it
     */
    async accept(challengeId: string, userId: string): Promise<{ challenge: any; matchId: string }> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            // Get the challenge
            const challenges = await this.dataSource.query(`
                SELECT * FROM challenges WHERE id = $1
            `, [challengeId]);

            if (challenges.length === 0) {
                throw new HttpException('Challenge not found', HttpStatus.NOT_FOUND);
            }

            const challenge = challenges[0];

            // Verify user is the recipient
            if (challenge.to_user_id !== userId) {
                throw new HttpException('You can only accept challenges sent to you', HttpStatus.FORBIDDEN);
            }

            if (challenge.status !== 'pending') {
                throw new HttpException('Challenge is no longer pending', HttpStatus.BAD_REQUEST);
            }

            // Create the match
            const matchId = uuidv4();
            await this.dataSource.query(`
                INSERT INTO matches (id, creator_id, opponent_id, court_id, status, match_type, created_at, updated_at)
                VALUES ($1, $2, $3, $4, 'accepted', '1v1', NOW(), NOW())
            `, [matchId, challenge.from_user_id, challenge.to_user_id, challenge.court_id]);

            // Update challenge status and link match
            await this.dataSource.query(`
                UPDATE challenges 
                SET status = 'accepted', match_id = $2, updated_at = NOW()
                WHERE id = $1
            `, [challengeId, matchId]);

            const updated = await this.dataSource.query(`
                SELECT * FROM challenges WHERE id = $1
            `, [challengeId]);

            // Notify challenger their challenge was accepted
            const accepterName = await this.getUserName(userId);
            this.notificationsService.sendChallengeNotification(challenge.from_user_id, accepterName, 'accepted', challengeId).catch(() => { });

            return { challenge: updated[0], matchId };
        }

        // SQLite fallback
        const challenge = await this.challengesRepository.findOne({ where: { id: challengeId } });
        if (!challenge) throw new HttpException('Challenge not found', HttpStatus.NOT_FOUND);
        if (challenge.toUserId !== userId) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
        if (challenge.status !== 'pending') throw new HttpException('Not pending', HttpStatus.BAD_REQUEST);

        const matchId = uuidv4();
        challenge.status = 'accepted';
        challenge.matchId = matchId;
        await this.challengesRepository.save(challenge);

        // Notify challenger
        const accepterName = await this.getUserName(userId);
        this.notificationsService.sendChallengeNotification(challenge.fromUserId, accepterName, 'accepted', challengeId).catch(() => { });

        return { challenge, matchId };
    }

    /**
     * Decline a challenge
     */
    async decline(challengeId: string, userId: string): Promise<Challenge> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            const challenges = await this.dataSource.query(`
                SELECT * FROM challenges WHERE id = $1
            `, [challengeId]);

            if (challenges.length === 0) {
                throw new HttpException('Challenge not found', HttpStatus.NOT_FOUND);
            }

            const challenge = challenges[0];

            if (challenge.to_user_id !== userId) {
                throw new HttpException('You can only decline challenges sent to you', HttpStatus.FORBIDDEN);
            }

            if (challenge.status !== 'pending') {
                throw new HttpException('Challenge is no longer pending', HttpStatus.BAD_REQUEST);
            }

            await this.dataSource.query(`
                UPDATE challenges 
                SET status = 'declined', updated_at = NOW()
                WHERE id = $1
            `, [challengeId]);

            const updated = await this.dataSource.query(`
                SELECT * FROM challenges WHERE id = $1
            `, [challengeId]);

            // Notify challenger their challenge was declined
            const declinerName = await this.getUserName(userId);
            this.notificationsService.sendChallengeNotification(challenge.from_user_id, declinerName, 'declined', challengeId).catch(() => { });

            return updated[0];
        }

        const challenge = await this.challengesRepository.findOne({ where: { id: challengeId } });
        if (!challenge) throw new HttpException('Challenge not found', HttpStatus.NOT_FOUND);
        if (challenge.toUserId !== userId) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

        challenge.status = 'declined';
        const saved = await this.challengesRepository.save(challenge);

        // Notify challenger
        const declinerName = await this.getUserName(userId);
        this.notificationsService.sendChallengeNotification(challenge.fromUserId, declinerName, 'declined', challengeId).catch(() => { });

        return saved;
    }

    /**
     * Cancel a challenge (sender only)
     */
    async cancel(challengeId: string, userId: string): Promise<Challenge> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            const challenges = await this.dataSource.query(`
                SELECT * FROM challenges WHERE id = $1
            `, [challengeId]);

            if (challenges.length === 0) {
                throw new HttpException('Challenge not found', HttpStatus.NOT_FOUND);
            }

            const challenge = challenges[0];

            if (challenge.from_user_id !== userId) {
                throw new HttpException('You can only cancel challenges you sent', HttpStatus.FORBIDDEN);
            }

            if (challenge.status !== 'pending') {
                throw new HttpException('Challenge is no longer pending', HttpStatus.BAD_REQUEST);
            }

            await this.dataSource.query(`
                UPDATE challenges 
                SET status = 'cancelled', updated_at = NOW()
                WHERE id = $1
            `, [challengeId]);

            const updated = await this.dataSource.query(`
                SELECT * FROM challenges WHERE id = $1
            `, [challengeId]);
            return updated[0];
        }

        const challenge = await this.challengesRepository.findOne({ where: { id: challengeId } });
        if (!challenge) throw new HttpException('Challenge not found', HttpStatus.NOT_FOUND);
        if (challenge.fromUserId !== userId) throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);

        challenge.status = 'cancelled';
        return this.challengesRepository.save(challenge);
    }

    /**
     * Mark challenge as completed (called when match score is submitted)
     */
    async markCompletedByMatchId(matchId: string): Promise<void> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            await this.dataSource.query(`
                UPDATE challenges 
                SET status = 'completed', updated_at = NOW()
                WHERE match_id = $1
            `, [matchId]);
        } else {
            await this.challengesRepository.update({ matchId }, { status: 'completed' });
        }
    }

    /**
     * Check if there's an active challenge between two users
     */
    async hasActiveChallenge(userId1: string, userId2: string): Promise<boolean> {
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            const result = await this.dataSource.query(`
                SELECT COUNT(*) as count
                FROM challenges c
                LEFT JOIN matches m ON m.id = c.match_id
                WHERE ((c.from_user_id = $1 AND c.to_user_id = $2) OR (c.from_user_id = $2 AND c.to_user_id = $1))
                  AND (
                    c.status = 'pending'
                    OR (
                      c.status = 'accepted'
                      AND (
                        c.match_id IS NULL
                        OR COALESCE(m.status, 'accepted') IN ('pending', 'accepted', 'live', 'score_submitted', 'pending_confirmation')
                      )
                    )
                  )
            `, [userId1, userId2]);
            return parseInt(result[0].count) > 0;
        }

        const count = await this.challengesRepository.count({
            where: [
                { fromUserId: userId1, toUserId: userId2, status: 'pending' },
                { fromUserId: userId1, toUserId: userId2, status: 'accepted' },
                { fromUserId: userId2, toUserId: userId1, status: 'pending' },
                { fromUserId: userId2, toUserId: userId1, status: 'accepted' },
            ],
        });
        return count > 0;
    }
}

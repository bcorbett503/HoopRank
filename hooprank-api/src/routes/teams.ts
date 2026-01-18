// src/routes/teams.ts
// =============================================================================
// Team Routes - CRUD and member management
// =============================================================================
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { asyncH, getUserId } from "../middleware/index.js";
import { sendPushNotification } from "../services/notifications.js";

const router = Router();

// =============================================================================
// Team CRUD
// =============================================================================

// POST /teams - Create a new team
const CreateTeamSchema = z.object({
    name: z.string().min(2).max(50),
    teamType: z.enum(["3v3", "5v5"]),
});

router.post(
    "/teams",
    asyncH(async (req, res) => {
        const uid = getUserId(req);
        const { name, teamType } = CreateTeamSchema.parse(req.body);

        // Ensure user exists in database (auto-create if not)
        // This handles Firebase users who haven't synced yet
        await pool.query(
            `INSERT INTO users (id, name, hoop_rank)
             VALUES ($1, 'Player', 3.0)
             ON CONFLICT (id) DO NOTHING`,
            [uid]
        );

        // Note: Team group chat will be implemented separately
        // The current threads table schema is designed for 1:1 chats (user_a, user_b)
        // Team group chats require a different approach

        const result = await pool.query(
            `INSERT INTO teams (owner_id, name, team_type)
       VALUES ($1, $2, $3)
       RETURNING id, name, team_type, rating, mmr, matches_played, wins, losses, thread_id, created_at`,
            [uid, name, teamType]
        );

        const team = result.rows[0];

        // Auto-add owner as accepted member
        await pool.query(
            `INSERT INTO team_members (team_id, user_id, role, status, joined_at)
       VALUES ($1, $2, 'owner', 'accepted', now())`,
            [team.id, uid]
        );

        res.status(201).json({
            id: team.id,
            name: team.name,
            teamType: team.team_type,
            rating: Number(team.rating),
            matchesPlayed: team.matches_played,
            wins: team.wins,
            losses: team.losses,
            threadId: team.thread_id,
            createdAt: team.created_at,
            isOwner: true,
            memberCount: 1,
        });
    })
);

// GET /teams - List user's teams
router.get(
    "/teams",
    asyncH(async (req, res) => {
        const uid = getUserId(req);

        const result = await pool.query(
            `SELECT t.*, tm.role,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id AND status = 'accepted') as member_count,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id AND status = 'pending' AND user_id != $1) as pending_count
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1 AND tm.status = 'accepted'
       ORDER BY t.updated_at DESC`,
            [uid]
        );

        res.json(
            result.rows.map((t) => ({
                id: t.id,
                name: t.name,
                teamType: t.team_type,
                rating: Number(t.rating),
                matchesPlayed: t.matches_played,
                wins: t.wins,
                losses: t.losses,
                threadId: t.thread_id,
                isOwner: t.role === "owner",
                memberCount: Number(t.member_count),
                pendingCount: Number(t.pending_count),
            }))
        );
    })
);

// GET /teams/invites - List pending team invites
router.get(
    "/teams/invites",
    asyncH(async (req, res) => {
        const uid = getUserId(req);

        const result = await pool.query(
            `SELECT t.*, u.name as owner_name
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       JOIN users u ON u.id = t.owner_id
       WHERE tm.user_id = $1 AND tm.status = 'pending'
       ORDER BY tm.invited_at DESC`,
            [uid]
        );

        res.json(
            result.rows.map((t) => ({
                id: t.id,
                name: t.name,
                teamType: t.team_type,
                rating: Number(t.rating),
                ownerName: t.owner_name,
            }))
        );
    })
);

// GET /teams/:id - Get team details
router.get(
    "/teams/:id",
    asyncH(async (req, res) => {
        const { id } = req.params;
        const uid = getUserId(req);

        const teamResult = await pool.query(
            `SELECT t.*, 
        (SELECT role FROM team_members WHERE team_id = t.id AND user_id = $2) as my_role
       FROM teams t WHERE t.id = $1`,
            [id, uid]
        );

        if (teamResult.rowCount === 0) {
            return res.status(404).json({ error: "team_not_found" });
        }

        const team = teamResult.rows[0];

        // Get members with user info
        const membersResult = await pool.query(
            `SELECT tm.*, u.name, u.avatar_url, u.hoop_rank as user_rating
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY tm.role DESC, tm.joined_at ASC`,
            [id]
        );

        res.json({
            id: team.id,
            name: team.name,
            teamType: team.team_type,
            rating: Number(team.rating),
            matchesPlayed: team.matches_played,
            wins: team.wins,
            losses: team.losses,
            threadId: team.thread_id,
            isOwner: team.my_role === "owner",
            isMember: !!team.my_role,
            members: membersResult.rows.map((m) => ({
                id: m.user_id,
                name: m.name,
                photoUrl: m.avatar_url,
                rating: Number(m.user_rating),
                role: m.role,
                status: m.status,
                joinedAt: m.joined_at,
            })),
        });
    })
);

// DELETE /teams/:id - Delete team (owner only)
router.delete(
    "/teams/:id",
    asyncH(async (req, res) => {
        const { id } = req.params;
        const uid = getUserId(req);

        const result = await pool.query(
            `DELETE FROM teams WHERE id = $1 AND owner_id = $2 RETURNING id`,
            [id, uid]
        );

        if (result.rowCount === 0) {
            return res.status(403).json({ error: "not_owner_or_not_found" });
        }

        res.json({ success: true });
    })
);

// =============================================================================
// Member Management
// =============================================================================

// POST /teams/:id/invite/:userId - Invite player to team
router.post(
    "/teams/:id/invite/:userId",
    asyncH(async (req, res) => {
        const { id, userId } = req.params;
        const uid = getUserId(req);

        // Verify requester is owner
        const ownerCheck = await pool.query(
            `SELECT 1 FROM teams WHERE id = $1 AND owner_id = $2`,
            [id, uid]
        );
        if (ownerCheck.rowCount === 0) {
            return res.status(403).json({ error: "not_owner" });
        }

        // Check if already a member
        const existsCheck = await pool.query(
            `SELECT status FROM team_members WHERE team_id = $1 AND user_id = $2`,
            [id, userId]
        );
        if ((existsCheck.rowCount ?? 0) > 0) {
            return res.status(400).json({ error: "already_invited_or_member" });
        }

        // Add as pending
        await pool.query(
            `INSERT INTO team_members (team_id, user_id, role, status)
       VALUES ($1, $2, 'member', 'pending')`,
            [id, userId]
        );

        // Send push notification to the invited user
        const teamResult = await pool.query(`SELECT name FROM teams WHERE id = $1`, [id]);
        const inviterResult = await pool.query(`SELECT name FROM users WHERE id = $1`, [uid]);
        const teamName = teamResult.rows[0]?.name || "a team";
        const inviterName = inviterResult.rows[0]?.name || "Someone";
        await sendPushNotification(
            userId,
            "🏀 Team Invite!",
            `${inviterName} invited you to join ${teamName}`,
            { type: "team_invite", teamId: id }
        );

        res.json({ success: true });
    })
);

// POST /teams/:id/accept - Accept team invite
router.post(
    "/teams/:id/accept",
    asyncH(async (req, res) => {
        const { id } = req.params;
        const uid = getUserId(req);

        const result = await pool.query(
            `UPDATE team_members 
       SET status = 'accepted', joined_at = now()
       WHERE team_id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING team_id`,
            [id, uid]
        );

        if (result.rowCount === 0) {
            return res.status(400).json({ error: "no_pending_invite" });
        }

        // Add to team thread
        const teamResult = await pool.query(
            `SELECT thread_id FROM teams WHERE id = $1`,
            [id]
        );
        if (teamResult.rows[0]?.thread_id) {
            await pool.query(
                `INSERT INTO thread_participants (thread_id, user_id) 
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [teamResult.rows[0].thread_id, uid]
            );
        }

        res.json({ success: true });
    })
);

// POST /teams/:id/decline - Decline team invite
router.post(
    "/teams/:id/decline",
    asyncH(async (req, res) => {
        const { id } = req.params;
        const uid = getUserId(req);

        await pool.query(
            `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'pending'`,
            [id, uid]
        );

        res.json({ success: true });
    })
);

// POST /teams/:id/leave - Leave team
router.post(
    "/teams/:id/leave",
    asyncH(async (req, res) => {
        const { id } = req.params;
        const uid = getUserId(req);

        // Cannot leave if owner
        const ownerCheck = await pool.query(
            `SELECT 1 FROM teams WHERE id = $1 AND owner_id = $2`,
            [id, uid]
        );
        if ((ownerCheck.rowCount ?? 0) > 0) {
            return res.status(400).json({ error: "owner_cannot_leave" });
        }

        await pool.query(
            `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
            [id, uid]
        );

        // Remove from thread
        const teamResult = await pool.query(
            `SELECT thread_id FROM teams WHERE id = $1`,
            [id]
        );
        if (teamResult.rows[0]?.thread_id) {
            await pool.query(
                `DELETE FROM thread_participants WHERE thread_id = $1 AND user_id = $2`,
                [teamResult.rows[0].thread_id, uid]
            );
        }

        res.json({ success: true });
    })
);

// DELETE /teams/:id/members/:userId - Remove member (owner only)
router.delete(
    "/teams/:id/members/:userId",
    asyncH(async (req, res) => {
        const { id, userId } = req.params;
        const uid = getUserId(req);

        // Verify requester is owner
        const ownerCheck = await pool.query(
            `SELECT 1 FROM teams WHERE id = $1 AND owner_id = $2`,
            [id, uid]
        );
        if (ownerCheck.rowCount === 0) {
            return res.status(403).json({ error: "not_owner" });
        }

        // Cannot remove self (owner)
        if (userId === uid) {
            return res.status(400).json({ error: "cannot_remove_self" });
        }

        await pool.query(
            `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
            [id, userId]
        );

        res.json({ success: true });
    })
);

// =============================================================================
// Team Challenges & Matches
// =============================================================================

// POST /teams/:id/challenge/:opponentTeamId - Challenge another team
const TeamChallengeSchema = z.object({
    message: z.string().min(1).max(500).optional(),
});

router.post(
    "/teams/:id/challenge/:opponentTeamId",
    asyncH(async (req, res) => {
        const { id, opponentTeamId } = req.params;
        const uid = getUserId(req);
        const { message } = TeamChallengeSchema.parse(req.body);

        // Verify requester is owner of the challenging team
        const teamResult = await pool.query(
            `SELECT team_type FROM teams WHERE id = $1 AND owner_id = $2`,
            [id, uid]
        );
        if (teamResult.rowCount === 0) {
            return res.status(403).json({ error: "not_owner" });
        }

        const teamType = teamResult.rows[0].team_type;

        // Verify opponent team exists and is same type
        const opponentResult = await pool.query(
            `SELECT team_type, owner_id FROM teams WHERE id = $1`,
            [opponentTeamId]
        );
        if (opponentResult.rowCount === 0) {
            return res.status(404).json({ error: "opponent_team_not_found" });
        }
        if (opponentResult.rows[0].team_type !== teamType) {
            return res.status(400).json({ error: "team_type_mismatch" });
        }

        // Create challenge as a match with pending status
        const matchResult = await pool.query(
            `INSERT INTO matches (
                creator_id, opponent_id, match_type, 
                creator_team_id, opponent_team_id, status
            ) VALUES ($1, $2, $3, $4, $5, 'challenge_pending')
            RETURNING id, created_at`,
            [uid, opponentResult.rows[0].owner_id, teamType, id, opponentTeamId]
        );

        // Optionally create a message for the challenge
        if (message) {
            // Find or create thread between team owners
            const threadResult = await pool.query(
                `SELECT id FROM threads 
                 WHERE (user_a = $1 AND user_b = $2) OR (user_a = $2 AND user_b = $1)
                 LIMIT 1`,
                [uid, opponentResult.rows[0].owner_id]
            );

            let threadId = threadResult.rows[0]?.id;
            if (!threadId) {
                const newThread = await pool.query(
                    `INSERT INTO threads (user_a, user_b) VALUES ($1, $2) RETURNING id`,
                    [uid, opponentResult.rows[0].owner_id]
                );
                threadId = newThread.rows[0].id;
            }

            await pool.query(
                `INSERT INTO messages (thread_id, sender_id, content, message_type, match_id)
                 VALUES ($1, $2, $3, 'team_challenge', $4)`,
                [threadId, uid, message, matchResult.rows[0].id]
            );
        }

        res.status(201).json({
            matchId: matchResult.rows[0].id,
            teamType,
            createdAt: matchResult.rows[0].created_at,
        });
    })
);

// GET /teams/challenges - Get pending team challenges for user
router.get(
    "/teams/challenges",
    asyncH(async (req, res) => {
        const uid = getUserId(req);

        // Get challenges where user owns either the challenger or challenged team
        const result = await pool.query(
            `SELECT m.id, m.match_type, m.status, m.created_at,
                    t1.id as challenger_team_id, t1.name as challenger_team_name,
                    t2.id as opponent_team_id, t2.name as opponent_team_name,
                    u.name as challenger_name
             FROM matches m
             JOIN teams t1 ON t1.id = m.creator_team_id
             JOIN teams t2 ON t2.id = m.opponent_team_id
             JOIN users u ON u.id = m.creator_id
             WHERE m.status = 'challenge_pending'
               AND (t1.owner_id = $1 OR t2.owner_id = $1)
             ORDER BY m.created_at DESC`,
            [uid]
        );

        res.json(result.rows.map(r => ({
            id: r.id,
            matchType: r.match_type,
            status: r.status,
            createdAt: r.created_at,
            challengerTeam: { id: r.challenger_team_id, name: r.challenger_team_name },
            opponentTeam: { id: r.opponent_team_id, name: r.opponent_team_name },
            challengerName: r.challenger_name,
            isSent: r.challenger_team_id === uid,
        })));
    })
);

// POST /teams/challenges/:matchId/accept - Accept team challenge
router.post(
    "/teams/challenges/:matchId/accept",
    asyncH(async (req, res) => {
        const { matchId } = req.params;
        const uid = getUserId(req);

        // Verify user owns the challenged team
        const matchResult = await pool.query(
            `SELECT m.*, t.owner_id as opponent_owner_id
             FROM matches m
             JOIN teams t ON t.id = m.opponent_team_id
             WHERE m.id = $1 AND m.status = 'challenge_pending'`,
            [matchId]
        );

        if (matchResult.rowCount === 0) {
            return res.status(404).json({ error: "challenge_not_found" });
        }

        if (matchResult.rows[0].opponent_owner_id !== uid) {
            return res.status(403).json({ error: "not_challenged_team_owner" });
        }

        // Accept the challenge - change to active match
        await pool.query(
            `UPDATE matches SET status = 'accepted', updated_at = now() WHERE id = $1`,
            [matchId]
        );

        res.json({ success: true, matchId });
    })
);

// POST /teams/challenges/:matchId/decline - Decline team challenge
router.post(
    "/teams/challenges/:matchId/decline",
    asyncH(async (req, res) => {
        const { matchId } = req.params;
        const uid = getUserId(req);

        const matchResult = await pool.query(
            `SELECT m.*, t.owner_id as opponent_owner_id
             FROM matches m
             JOIN teams t ON t.id = m.opponent_team_id
             WHERE m.id = $1 AND m.status = 'challenge_pending'`,
            [matchId]
        );

        if (matchResult.rowCount === 0) {
            return res.status(404).json({ error: "challenge_not_found" });
        }

        if (matchResult.rows[0].opponent_owner_id !== uid) {
            return res.status(403).json({ error: "not_challenged_team_owner" });
        }

        await pool.query(`DELETE FROM matches WHERE id = $1`, [matchId]);

        res.json({ success: true });
    })
);

// POST /teams/matches/:matchId/score - Submit team match score
const TeamScoreSchema = z.object({
    myTeamScore: z.number().int().min(0),
    opponentTeamScore: z.number().int().min(0),
});

router.post(
    "/teams/matches/:matchId/score",
    asyncH(async (req, res) => {
        const { matchId } = req.params;
        const uid = getUserId(req);
        const { myTeamScore, opponentTeamScore } = TeamScoreSchema.parse(req.body);

        // Get match and verify user is on one of the teams
        const matchResult = await pool.query(
            `SELECT m.*, 
                    t1.owner_id as creator_owner, t2.owner_id as opponent_owner,
                    t1.rating as creator_rating, t2.rating as opponent_rating
             FROM matches m
             JOIN teams t1 ON t1.id = m.creator_team_id
             JOIN teams t2 ON t2.id = m.opponent_team_id
             WHERE m.id = $1`,
            [matchId]
        );

        if (matchResult.rowCount === 0) {
            return res.status(404).json({ error: "match_not_found" });
        }

        const match = matchResult.rows[0];
        const isCreator = match.creator_owner === uid;
        const isOpponent = match.opponent_owner === uid;

        if (!isCreator && !isOpponent) {
            return res.status(403).json({ error: "not_team_owner" });
        }

        // Determine scores from submitter's perspective
        const creatorScore = isCreator ? myTeamScore : opponentTeamScore;
        const opponentScore = isCreator ? opponentTeamScore : myTeamScore;
        const winnerId = creatorScore > opponentScore ? match.creator_id : match.opponent_id;
        const winnerTeamId = creatorScore > opponentScore ? match.creator_team_id : match.opponent_team_id;

        // If already has a score submission, check if it matches for confirmation
        if (match.score_creator !== null) {
            // Second submission - check if scores match
            if (match.score_creator === creatorScore && match.score_opponent === opponentScore) {
                // Scores match - finalize the match and update team ratings
                await pool.query(
                    `UPDATE matches 
                     SET status = 'completed', winner_id = $2, updated_at = now()
                     WHERE id = $1`,
                    [matchId, winnerId]
                );

                // Update team ratings using ELO-like system
                const K = 32;
                const creatorRating = Number(match.creator_rating);
                const opponentRating = Number(match.opponent_rating);

                const expectedCreator = 1 / (1 + Math.pow(10, (opponentRating - creatorRating) / 400));
                const actualCreator = creatorScore > opponentScore ? 1 : 0;

                const creatorRatingChange = K * (actualCreator - expectedCreator);
                const newCreatorRating = Math.max(0, Math.min(5, creatorRating + creatorRatingChange / 100));
                const newOpponentRating = Math.max(0, Math.min(5, opponentRating - creatorRatingChange / 100));

                // Update creator team
                await pool.query(
                    `UPDATE teams SET 
                        rating = $2,
                        matches_played = matches_played + 1,
                        wins = wins + $3,
                        losses = losses + $4,
                        updated_at = now()
                     WHERE id = $1`,
                    [match.creator_team_id, newCreatorRating, actualCreator, 1 - actualCreator]
                );

                // Update opponent team
                await pool.query(
                    `UPDATE teams SET 
                        rating = $2,
                        matches_played = matches_played + 1,
                        wins = wins + $3,
                        losses = losses + $4,
                        updated_at = now()
                     WHERE id = $1`,
                    [match.opponent_team_id, newOpponentRating, 1 - actualCreator, actualCreator]
                );

                res.json({
                    success: true,
                    status: 'completed',
                    winnerTeamId,
                    creatorRatingChange: creatorRatingChange / 100,
                });
            } else {
                // Scores don't match - mark as disputed
                await pool.query(
                    `UPDATE matches SET status = 'disputed', updated_at = now() WHERE id = $1`,
                    [matchId]
                );
                res.json({ success: true, status: 'disputed' });
            }
        } else {
            // First score submission
            await pool.query(
                `UPDATE matches 
                 SET score_creator = $2, score_opponent = $3, 
                     status = 'pending_confirmation', updated_at = now()
                 WHERE id = $1`,
                [matchId, creatorScore, opponentScore]
            );
            res.json({ success: true, status: 'pending_confirmation' });
        }
    })
);

export default router;

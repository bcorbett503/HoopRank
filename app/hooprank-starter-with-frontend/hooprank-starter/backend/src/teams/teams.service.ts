import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Team, TeamMember, TeamMessage } from './team.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TeamsService {
    constructor(
        @InjectRepository(Team)
        private teamsRepository: Repository<Team>,
        @InjectRepository(TeamMember)
        private membersRepository: Repository<TeamMember>,
        @InjectRepository(TeamMessage)
        private messagesRepository: Repository<TeamMessage>,
        @InjectRepository(User)
        private usersRepository: Repository<User>,
        private notificationsService: NotificationsService,
        private dataSource: DataSource,
    ) { }

    /**
     * Get all teams for a user (as member or owner)
     */
    async getUserTeams(userId: string): Promise<any[]> {
        const memberships = await this.membersRepository.find({
            where: { userId, status: 'active' },
            relations: ['team'],
        });

        return memberships
            .filter(m => m.team)  // Filter out memberships where team couldn't be loaded
            .map(m => ({
                id: m.team.id,
                name: m.team.name,
                teamType: m.team.teamType,
                rating: m.team.rating,
                wins: m.team.wins,
                losses: m.team.losses,
                logoUrl: m.team.logoUrl,
                isOwner: m.team.ownerId === userId,
                memberCount: 0,
                pendingCount: 0,
            }));
    }

    /**
     * Get pending team invites for a user
     */
    async getInvites(userId: string): Promise<any[]> {
        const invites = await this.membersRepository.find({
            where: { userId, status: 'pending' },
            relations: ['team'],
        });

        return invites
            .filter(inv => inv.team)  // Filter out invites where team couldn't be loaded
            .map(inv => ({
                id: inv.team.id,
                name: inv.team.name,
                teamType: inv.team.teamType,
                ownerName: 'Team Owner',  // Simplified - don't require owner relation
            }));
    }

    /**
     * Create a new team
     */
    async createTeam(userId: string, name: string, teamType: string): Promise<Team> {
        console.log(`[TeamsService.createTeam] userId=${userId}, name=${name}, teamType=${teamType}`);

        // Validate userId
        if (!userId || userId.trim() === '') {
            console.log('[TeamsService.createTeam] ERROR: userId is empty');
            throw new BadRequestException('User ID is required');
        }

        // Validate team type
        if (!['3v3', '5v5'].includes(teamType)) {
            throw new BadRequestException('Team type must be 3v3 or 5v5');
        }

        // Check if team name already exists for this type
        const existing = await this.teamsRepository.findOne({
            where: { name, teamType },
        });
        if (existing) {
            throw new BadRequestException('TEAM_NAME_TAKEN: A team with this name already exists');
        }

        // Create team
        const team = this.teamsRepository.create({
            name,
            teamType,
            ownerId: userId,
            rating: 3.0,
            wins: 0,
            losses: 0,
        });
        await this.teamsRepository.save(team);

        // Add owner as active member
        const ownerMember = this.membersRepository.create({
            teamId: team.id,
            userId,
            status: 'active',
            role: 'owner',
        });
        await this.membersRepository.save(ownerMember);

        return team;
    }

    /**
     * Get team details with members
     */
    async getTeamDetail(teamId: string, userId: string): Promise<any> {
        const team = await this.teamsRepository.findOne({
            where: { id: teamId },
        });

        if (!team) {
            throw new NotFoundException('Team not found');
        }

        // Get member counts without requiring user relation
        const memberCount = await this.membersRepository.count({
            where: { teamId, status: 'active' },
        });

        const pendingCount = await this.membersRepository.count({
            where: { teamId, status: 'pending' },
        });

        // Get member IDs for listing
        const members = await this.membersRepository.find({
            where: { teamId, status: 'active' },
        });

        const pendingMembers = await this.membersRepository.find({
            where: { teamId, status: 'pending' },
        });

        return {
            id: team.id,
            name: team.name,
            teamType: team.teamType,
            rating: team.rating,
            wins: team.wins,
            losses: team.losses,
            logoUrl: team.logoUrl,
            ownerId: team.ownerId,
            ownerName: 'Team Owner',  // Simplified
            isOwner: team.ownerId === userId,
            memberCount,
            pendingCount,
            members: members.map(m => ({
                id: m.userId,
                name: 'Member',  // Simplified - avoid user relation issues
                role: m.role,
            })),
            pending: pendingMembers.map(m => ({
                id: m.userId,
                name: 'Pending',
            })),
        };
    }

    /**
     * Accept team invite
     */
    async acceptInvite(teamId: string, userId: string): Promise<void> {
        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'pending' },
        });

        if (!membership) {
            throw new NotFoundException('No pending invite found');
        }

        membership.status = 'active';
        await this.membersRepository.save(membership);
    }

    /**
     * Decline team invite
     */
    async declineInvite(teamId: string, userId: string): Promise<void> {
        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'pending' },
        });

        if (!membership) {
            throw new NotFoundException('No pending invite found');
        }

        membership.status = 'declined';
        await this.membersRepository.save(membership);
    }

    /**
     * Leave team
     */
    async leaveTeam(teamId: string, userId: string): Promise<void> {
        const team = await this.teamsRepository.findOne({ where: { id: teamId } });
        if (!team) {
            throw new NotFoundException('Team not found');
        }

        if (team.ownerId === userId) {
            throw new BadRequestException('Owner cannot leave team. Transfer ownership or delete the team.');
        }

        await this.membersRepository.delete({ teamId, userId });
    }

    /**
     * Delete team (owner only)
     */
    async deleteTeam(teamId: string, userId: string): Promise<void> {
        const team = await this.teamsRepository.findOne({ where: { id: teamId } });
        if (!team) {
            throw new NotFoundException('Team not found');
        }

        if (team.ownerId !== userId) {
            throw new ForbiddenException('Only the owner can delete the team');
        }

        // Delete all members first
        await this.membersRepository.delete({ teamId });
        // Delete team
        await this.teamsRepository.delete({ id: teamId });
    }

    /**
     * Invite player to team
     */
    async invitePlayer(teamId: string, inviterId: string, playerId: string): Promise<void> {
        const team = await this.teamsRepository.findOne({ where: { id: teamId } });
        if (!team) {
            throw new NotFoundException('Team not found');
        }

        // Check if inviter is a member
        const inviterMembership = await this.membersRepository.findOne({
            where: { teamId, userId: inviterId, status: 'active' },
        });
        if (!inviterMembership) {
            throw new ForbiddenException('Only team members can invite players');
        }

        // Check if player is already a member or invited
        const existing = await this.membersRepository.findOne({
            where: { teamId, userId: playerId },
        });
        if (existing) {
            if (existing.status === 'active') {
                throw new BadRequestException('Player is already a member');
            }
            if (existing.status === 'pending') {
                throw new BadRequestException('Player already has a pending invite');
            }
            // If declined, update to pending
            existing.status = 'pending';
            await this.membersRepository.save(existing);
            return;
        }

        // Check team size limits
        const memberCount = await this.membersRepository.count({
            where: { teamId, status: 'active' },
        });
        const maxMembers = team.teamType === '3v3' ? 5 : 10;
        if (memberCount >= maxMembers) {
            throw new BadRequestException(`Team is full (max ${maxMembers} members)`);
        }

        // Create invite
        const invite = this.membersRepository.create({
            teamId,
            userId: playerId,
            status: 'pending',
            role: 'member',
        });
        await this.membersRepository.save(invite);
    }

    /**
     * Remove member from team (owner only)
     */
    async removeMember(teamId: string, ownerId: string, memberId: string): Promise<void> {
        const team = await this.teamsRepository.findOne({ where: { id: teamId } });
        if (!team) {
            throw new NotFoundException('Team not found');
        }

        if (team.ownerId !== ownerId) {
            throw new ForbiddenException('Only the owner can remove members');
        }

        if (memberId === ownerId) {
            throw new BadRequestException('Cannot remove yourself as owner');
        }

        await this.membersRepository.delete({ teamId, userId: memberId });
    }

    /**
     * Get team chats for a user (returns team info for each team they're in)
     */
    async getTeamChats(userId: string): Promise<any[]> {
        const memberships = await this.membersRepository.find({
            where: { userId, status: 'active' },
            relations: ['team'],
        });

        // Get last message for each team
        const results: any[] = [];
        for (const m of memberships) {
            if (!m.team) continue;

            const lastMsg = await this.messagesRepository.findOne({
                where: { teamId: m.team.id },
                order: { createdAt: 'DESC' },
            });

            results.push({
                teamId: m.team.id,
                teamName: m.team.name,
                teamType: m.team.teamType,
                threadId: `team_${m.team.id}`,
                lastMessage: lastMsg?.content || null,
                lastSenderName: null,  // Could lookup sender name
                lastMessageAt: lastMsg?.createdAt || null,
            });
        }
        return results;
    }

    /**
     * Get messages for a team chat
     */
    async getTeamMessages(teamId: string, userId: string): Promise<any[]> {
        // Verify user is a member
        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You are not a member of this team');
        }

        // Get messages
        const messages = await this.messagesRepository.find({
            where: { teamId },
            order: { createdAt: 'ASC' },
            take: 100,  // Limit to last 100 messages
        });

        return messages.map(m => ({
            id: m.id,
            senderId: m.senderId,
            content: m.content,
            createdAt: m.createdAt,
            senderName: null,  // Could lookup from users
            senderPhotoUrl: null,
        }));
    }

    /**
     * Send a message to a team chat
     */
    async sendTeamMessage(teamId: string, userId: string, content: string): Promise<TeamMessage> {
        // Verify user is a member
        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You are not a member of this team');
        }

        // Get team info for notification
        const team = await this.teamsRepository.findOne({ where: { id: teamId } });
        if (!team) {
            throw new NotFoundException('Team not found');
        }

        // Save message
        const message = this.messagesRepository.create({
            teamId,
            senderId: userId,
            content,
        });
        await this.messagesRepository.save(message);

        // Send push notifications to other team members
        this.sendTeamMessageNotification(teamId, userId, team.name, content).catch(err => {
            console.error('Failed to send team message notifications:', err);
        });

        return message;
    }

    /**
     * Send push notification to team members about new message
     */
    private async sendTeamMessageNotification(
        teamId: string,
        senderId: string,
        teamName: string,
        messagePreview: string,
    ): Promise<void> {
        // Get FCM tokens for all team members except sender
        const result = await this.dataSource.query(`
            SELECT u.fcm_token 
            FROM users u
            JOIN team_members tm ON u.id = tm.user_id
            WHERE tm.team_id = $1 
              AND tm.status = 'active' 
              AND tm.user_id != $2
              AND u.fcm_token IS NOT NULL
        `, [teamId, senderId]);

        const tokens = result.map((r: any) => r.fcm_token).filter((t: string) => t);
        if (tokens.length === 0) return;

        const admin = require('firebase-admin');
        try {
            const message = {
                tokens,
                notification: {
                    title: `💬 ${teamName}`,
                    body: messagePreview.substring(0, 100),
                },
                data: {
                    type: 'team_message',
                    teamId,
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1,
                        },
                    },
                },
            };

            const response = await admin.messaging().sendEachForMulticast(message);
            console.log(`Team message notifications: ${response.successCount} sent, ${response.failureCount} failed`);
        } catch (error) {
            console.error('Error sending team message notifications:', error);
        }
    }

    // ====================
    // TEAM CHALLENGES
    // ====================

    /**
     * Create a challenge from one team to another
     */
    async createTeamChallenge(fromTeamId: string, toTeamId: string, userId: string, message?: string): Promise<any> {
        // Verify user is a member of the challenging team
        const membership = await this.membersRepository.findOne({
            where: { teamId: fromTeamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You must be a member of the team to send challenges');
        }

        // Verify target team exists
        const toTeam = await this.teamsRepository.findOne({ where: { id: toTeamId } });
        if (!toTeam) {
            throw new NotFoundException('Target team not found');
        }

        // Check for existing pending challenge
        const existing = await this.dataSource.query(`
            SELECT id FROM team_challenges 
            WHERE from_team_id = $1 AND to_team_id = $2 AND status = 'pending'
        `, [fromTeamId, toTeamId]);
        if (existing.length > 0) {
            throw new BadRequestException('A pending challenge already exists');
        }

        // Create challenge
        const result = await this.dataSource.query(`
            INSERT INTO team_challenges (from_team_id, to_team_id, message, status, created_by)
            VALUES ($1, $2, $3, 'pending', $4)
            RETURNING *
        `, [fromTeamId, toTeamId, message || 'Team challenge!', userId]);

        console.log(`[TeamsService] Created team challenge: ${fromTeamId} -> ${toTeamId}`);
        return result[0];
    }

    /**
     * Get challenges for a team (both incoming and outgoing)
     */
    async getTeamChallenges(teamId: string, userId: string): Promise<any[]> {
        // Verify user is a member
        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You must be a member of the team');
        }

        const challenges = await this.dataSource.query(`
            SELECT 
                tc.*,
                ft.name as from_team_name,
                ft.team_type as from_team_type,
                tt.name as to_team_name,
                tt.team_type as to_team_type
            FROM team_challenges tc
            JOIN teams ft ON tc.from_team_id = ft.id
            JOIN teams tt ON tc.to_team_id = tt.id
            WHERE (tc.from_team_id = $1 OR tc.to_team_id = $1)
              AND tc.status = 'pending'
            ORDER BY tc.created_at DESC
        `, [teamId]);

        return challenges.map((c: any) => ({
            id: c.id,
            fromTeamId: c.from_team_id,
            fromTeamName: c.from_team_name,
            toTeamId: c.to_team_id,
            toTeamName: c.to_team_name,
            teamType: c.from_team_type,
            message: c.message,
            status: c.status,
            createdAt: c.created_at,
            direction: c.to_team_id === teamId ? 'incoming' : 'outgoing',
        }));
    }

    /**
     * Accept a team challenge - creates a team match
     */
    async acceptTeamChallenge(challengeId: string, teamId: string, userId: string): Promise<any> {
        // Verify user is a member of the receiving team
        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You must be a member of the team');
        }

        // Get challenge
        const challenges = await this.dataSource.query(`
            SELECT * FROM team_challenges WHERE id = $1 AND status = 'pending'
        `, [challengeId]);
        if (challenges.length === 0) {
            throw new NotFoundException('Challenge not found or already resolved');
        }
        const challenge = challenges[0];

        // Verify this team is the target
        if (challenge.to_team_id !== teamId) {
            throw new ForbiddenException('Only the challenged team can accept');
        }

        // Ensure team match columns exist (migration might not have run)
        await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_match BOOLEAN DEFAULT false`);
        await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS creator_team_id UUID`);
        await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent_team_id UUID`);

        // Create team match - generate UUID explicitly, creator_id is required (NOT NULL)
        const matchResult = await this.dataSource.query(`
            INSERT INTO matches (id, match_type, status, team_match, creator_team_id, opponent_team_id, creator_id)
            VALUES (gen_random_uuid(), '3v3', 'accepted', true, $1, $2, $3)
            RETURNING *
        `, [challenge.from_team_id, challenge.to_team_id, userId]);
        const match = matchResult[0];

        // Update challenge
        await this.dataSource.query(`
            UPDATE team_challenges SET status = 'accepted', match_id = $1, updated_at = NOW()
            WHERE id = $2
        `, [match.id, challengeId]);

        console.log(`[TeamsService] Accepted team challenge ${challengeId}, created match ${match.id}`);
        return { challenge: { ...challenge, status: 'accepted' }, match };
    }

    /**
     * Decline a team challenge
     */
    async declineTeamChallenge(challengeId: string, teamId: string, userId: string): Promise<void> {
        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You must be a member of the team');
        }

        const result = await this.dataSource.query(`
            UPDATE team_challenges SET status = 'declined', updated_at = NOW()
            WHERE id = $1 AND to_team_id = $2 AND status = 'pending'
            RETURNING id
        `, [challengeId, teamId]);

        if (result.length === 0) {
            throw new NotFoundException('Challenge not found or already resolved');
        }
    }

    /**
     * Cancel a team challenge (only challenger can cancel)
     */
    async cancelTeamChallenge(challengeId: string, teamId: string, userId: string): Promise<void> {
        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You must be a member of the team');
        }

        const result = await this.dataSource.query(`
            UPDATE team_challenges SET status = 'cancelled', updated_at = NOW()
            WHERE id = $1 AND from_team_id = $2 AND status = 'pending'
            RETURNING id
        `, [challengeId, teamId]);

        if (result.length === 0) {
            throw new NotFoundException('Challenge not found or cannot be cancelled');
        }
    }

    /**
     * Submit scores for a team match and update team ratings
     */
    async submitTeamMatchScore(
        matchId: string,
        teamId: string,
        userId: string,
        myScore: number,
        opponentScore: number,
    ): Promise<any> {
        // Verify user is a member of this team
        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You must be a member of the team');
        }

        // Get match
        const matches = await this.dataSource.query(`
            SELECT * FROM matches WHERE id = $1 AND team_match = true
        `, [matchId]);
        if (matches.length === 0) {
            throw new NotFoundException('Team match not found');
        }
        const match = matches[0];

        // Determine which team submitted and set scores
        const isCreatorTeam = match.creator_team_id === teamId;
        const creatorScore = isCreatorTeam ? myScore : opponentScore;
        const opponentTeamScore = isCreatorTeam ? opponentScore : myScore;
        const winnerTeamId = myScore > opponentScore ? teamId : (isCreatorTeam ? match.opponent_team_id : match.creator_team_id);

        // Get current team ratings
        const teams = await this.dataSource.query(`
            SELECT id, rating FROM teams WHERE id IN ($1, $2)
        `, [match.creator_team_id, match.opponent_team_id]);

        const creatorTeam = teams.find((t: any) => t.id === match.creator_team_id);
        const opponentTeam = teams.find((t: any) => t.id === match.opponent_team_id);

        const creatorRating = parseFloat(creatorTeam?.rating || '3.0');
        const opponentRating = parseFloat(opponentTeam?.rating || '3.0');

        // Calculate new Elo ratings (same formula as 1v1)
        const K = 0.2;
        const expectedCreator = 1 / (1 + Math.pow(10, (opponentRating - creatorRating) / 1));
        const creatorWon = match.creator_team_id === winnerTeamId ? 1 : 0;

        const newCreatorRating = Math.max(1, Math.min(5, creatorRating + K * (creatorWon - expectedCreator)));
        const newOpponentRating = Math.max(1, Math.min(5, opponentRating + K * ((1 - creatorWon) - (1 - expectedCreator))));

        // Update match
        await this.dataSource.query(`
            UPDATE matches SET 
                status = 'completed',
                winner_id = $1,
                score_creator = $2,
                score_opponent = $3,
                completed_at = NOW()
            WHERE id = $4
        `, [winnerTeamId, creatorScore, opponentTeamScore, matchId]);

        // Update team ratings and W/L records
        await this.dataSource.query(`
            UPDATE teams SET 
                rating = $1,
                wins = wins + CASE WHEN id = $3 THEN 1 ELSE 0 END,
                losses = losses + CASE WHEN id != $3 THEN 1 ELSE 0 END
            WHERE id = $2
        `, [newCreatorRating.toFixed(2), match.creator_team_id, winnerTeamId]);

        await this.dataSource.query(`
            UPDATE teams SET 
                rating = $1,
                wins = wins + CASE WHEN id = $3 THEN 1 ELSE 0 END,
                losses = losses + CASE WHEN id != $3 THEN 1 ELSE 0 END
            WHERE id = $2
        `, [newOpponentRating.toFixed(2), match.opponent_team_id, winnerTeamId]);

        console.log(`[TeamsService] Team match ${matchId} completed. Winner: ${winnerTeamId}`);
        console.log(`[TeamsService] Rating changes: ${match.creator_team_id}: ${creatorRating} -> ${newCreatorRating.toFixed(2)}, ${match.opponent_team_id}: ${opponentRating} -> ${newOpponentRating.toFixed(2)}`);

        return {
            matchId,
            winnerTeamId,
            scores: { creator: creatorScore, opponent: opponentTeamScore },
            ratingChanges: {
                [match.creator_team_id]: { old: creatorRating, new: newCreatorRating },
                [match.opponent_team_id]: { old: opponentRating, new: newOpponentRating },
            },
        };
    }
}


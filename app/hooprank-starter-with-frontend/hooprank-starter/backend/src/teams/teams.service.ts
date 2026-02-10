import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThanOrEqual } from 'typeorm';
import { Team, TeamMember, TeamMessage } from './team.entity';
import { TeamEvent, TeamEventAttendance } from './team-event.entity';
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
        @InjectRepository(TeamEvent)
        private eventsRepository: Repository<TeamEvent>,
        @InjectRepository(TeamEventAttendance)
        private attendanceRepository: Repository<TeamEventAttendance>,
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

        const result: any[] = [];
        for (const m of memberships) {
            if (!m.team) continue;

            // Get pending members for this team
            const pendingMembers = await this.dataSource.query(`
                SELECT tm.user_id, u.name, u.avatar_url
                FROM team_members tm
                LEFT JOIN users u ON u.id = tm.user_id
                WHERE tm.team_id = $1 AND tm.status = 'pending'
            `, [m.team.id]);

            // Get active member count
            const activeCount = await this.membersRepository.count({
                where: { teamId: m.team.id, status: 'active' },
            });

            result.push({
                id: m.team.id,
                name: m.team.name,
                teamType: m.team.teamType,
                ageGroup: m.team.ageGroup,
                gender: m.team.gender,
                skillLevel: m.team.skillLevel,
                homeCourtId: m.team.homeCourtId,
                city: m.team.city,
                description: m.team.description,
                rating: m.team.rating,
                wins: m.team.wins,
                losses: m.team.losses,
                logoUrl: m.team.logoUrl,
                isOwner: m.team.ownerId === userId,
                memberCount: activeCount,
                pendingCount: pendingMembers.length,
                pendingMembers: pendingMembers.map(p => ({
                    id: p.user_id,
                    name: p.name || 'Unknown',
                    photoUrl: p.avatar_url,
                })),
            });
        }
        return result;
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
    async createTeam(userId: string, name: string, teamType: string, ageGroup?: string, gender?: string, skillLevel?: string, homeCourtId?: string, city?: string, description?: string): Promise<Team> {
        console.log(`[TeamsService.createTeam] userId=${userId}, name=${name}, teamType=${teamType}, ageGroup=${ageGroup}, gender=${gender}, skillLevel=${skillLevel}`);

        // Validate userId
        if (!userId || userId.trim() === '') {
            console.log('[TeamsService.createTeam] ERROR: userId is empty');
            throw new BadRequestException('User ID is required');
        }

        // Validate team type
        if (!['3v3', '5v5'].includes(teamType)) {
            throw new BadRequestException('Team type must be 3v3 or 5v5');
        }

        // Validate age group if provided
        const validAgeGroups = ['U10', 'U12', 'U14', 'U18', 'HS', 'College', 'Open'];
        if (ageGroup && !validAgeGroups.includes(ageGroup)) {
            throw new BadRequestException(`Age group must be one of: ${validAgeGroups.join(', ')}`);
        }

        // Validate gender if provided
        const validGenders = ['Mens', 'Womens', 'Coed'];
        if (gender && !validGenders.includes(gender)) {
            throw new BadRequestException(`Gender must be one of: ${validGenders.join(', ')}`);
        }

        // Validate skill level if provided
        const validSkillLevels = ['Recreational', 'Competitive', 'Elite'];
        if (skillLevel && !validSkillLevels.includes(skillLevel)) {
            throw new BadRequestException(`Skill level must be one of: ${validSkillLevels.join(', ')}`);
        }

        // Validate description length
        if (description && description.length > 200) {
            throw new BadRequestException('Description must be 200 characters or less');
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
            ageGroup: ageGroup || null,
            gender: gender || null,
            skillLevel: skillLevel || null,
            homeCourtId: homeCourtId || null,
            city: city || null,
            description: description || null,
            rating: 3.0,
            wins: 0,
            losses: 0,
        } as Partial<Team>);
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

        // Get members with real names from users table
        const activeMembers = await this.dataSource.query(`
            SELECT tm.user_id as "userId", tm.role, COALESCE(u.name, 'Player') as name,
                   u.avatar_url as "photoUrl"
            FROM team_members tm
            LEFT JOIN users u ON u.id = tm.user_id
            WHERE tm.team_id = $1 AND tm.status = 'active'
        `, [teamId]);

        const pendingMembers = await this.dataSource.query(`
            SELECT tm.user_id as "userId", COALESCE(u.name, 'Player') as name,
                   u.avatar_url as "photoUrl"
            FROM team_members tm
            LEFT JOIN users u ON u.id = tm.user_id
            WHERE tm.team_id = $1 AND tm.status = 'pending'
        `, [teamId]);

        // Get owner name
        const ownerResult = await this.dataSource.query(`
            SELECT name FROM users WHERE id = $1
        `, [team.ownerId]);
        const ownerName = ownerResult[0]?.name || 'Team Owner';

        // Get recent matches (last 10)
        const recentMatches = await this.dataSource.query(`
            SELECT m.id, m.status, m.score_creator, m.score_opponent,
                   m.creator_team_id, m.opponent_team_id,
                   m.winner_id as winner_team_id,
                   m.completed_at,
                   t1.name as "creatorTeamName",
                   COALESCE(t2.name, m.opponent_name, 'Unknown') as "opponentTeamName"
            FROM matches m
            LEFT JOIN teams t1 ON t1.id = m.creator_team_id::uuid
            LEFT JOIN teams t2 ON t2.id = m.opponent_team_id::uuid
            WHERE m.team_match = true
              AND (m.creator_team_id = $1 OR m.opponent_team_id = $1)
              AND m.status = 'completed'
            ORDER BY m.completed_at DESC
            LIMIT 10
        `, [teamId]);

        return {
            id: team.id,
            name: team.name,
            teamType: team.teamType,
            ageGroup: team.ageGroup,
            gender: team.gender,
            skillLevel: team.skillLevel,
            homeCourtId: team.homeCourtId,
            city: team.city,
            description: team.description,
            rating: team.rating,
            wins: team.wins,
            losses: team.losses,
            logoUrl: team.logoUrl,
            ownerId: team.ownerId,
            ownerName,
            isOwner: team.ownerId === userId,
            memberCount,
            pendingCount,
            members: activeMembers.map(m => ({
                id: m.userId,
                name: m.name,
                photoUrl: m.photoUrl,
                role: m.role,
            })),
            pending: pendingMembers.map(m => ({
                id: m.userId,
                name: m.name,
                photoUrl: m.photoUrl,
            })),
            recentMatches: recentMatches.map(m => ({
                id: m.id,
                creatorTeamName: m.creatorTeamName,
                opponentTeamName: m.opponentTeamName,
                scoreCreator: m.score_creator,
                scoreOpponent: m.score_opponent,
                won: m.winner_team_id === teamId,
                completedAt: m.completed_at,
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
     * Update team details (owner only)
     */
    async updateTeam(
        teamId: string,
        userId: string,
        updates: {
            name?: string;
            description?: string;
            city?: string;
            ageGroup?: string;
            gender?: string;
            skillLevel?: string;
            homeCourtId?: string;
        },
    ): Promise<any> {
        const team = await this.teamsRepository.findOne({ where: { id: teamId } });
        if (!team) {
            throw new NotFoundException('Team not found');
        }
        if (team.ownerId !== userId) {
            throw new ForbiddenException('Only the owner can update the team');
        }

        // Build dynamic update
        const setClauses: string[] = [];
        const params: any[] = [];
        let paramIndex = 1;

        const fieldMap: Record<string, string> = {
            name: 'name',
            description: 'description',
            city: 'city',
            ageGroup: 'age_group',
            gender: 'gender',
            skillLevel: 'skill_level',
            homeCourtId: 'home_court_id',
        };

        for (const [key, column] of Object.entries(fieldMap)) {
            if (updates[key] !== undefined) {
                setClauses.push(`${column} = $${paramIndex}`);
                params.push(updates[key]);
                paramIndex++;
            }
        }

        if (setClauses.length === 0) {
            return team;
        }

        setClauses.push(`updated_at = NOW()`);
        params.push(teamId);

        await this.dataSource.query(
            `UPDATE teams SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
            params,
        );

        // Return updated team
        return this.getTeamDetail(teamId, userId);
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
     * Get all pending team challenges across all of the user's teams.
     * Used by the mobile app which calls GET /teams/challenges without a team ID.
     */
    async getAllUserTeamChallenges(userId: string): Promise<any[]> {
        // Get all team IDs where the user is an active member
        const memberships = await this.membersRepository.find({
            where: { userId, status: 'active' },
        });

        if (memberships.length === 0) return [];

        const teamIds = memberships.map(m => m.teamId);

        // Build dynamic IN clauses with separate placeholder indices for each
        const placeholders1 = teamIds.map((_, i) => `$${i + 1}`).join(', ');
        const offset = teamIds.length;
        const placeholders2 = teamIds.map((_, i) => `$${i + 1 + offset}`).join(', ');
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
        WHERE (tc.from_team_id IN (${placeholders1}) OR tc.to_team_id IN (${placeholders2}))
          AND tc.status = 'pending'
        ORDER BY tc.created_at DESC
    `, [...teamIds, ...teamIds]);

        return challenges.map((c: any) => {
            // Determine which of the user's teams is involved
            const userTeamId = teamIds.find(id => id === c.from_team_id || id === c.to_team_id);
            return {
                id: c.id,
                fromTeamId: c.from_team_id,
                fromTeamName: c.from_team_name,
                toTeamId: c.to_team_id,
                toTeamName: c.to_team_name,
                teamType: c.from_team_type,
                message: c.message,
                status: c.status,
                createdAt: c.created_at,
                direction: teamIds.includes(c.to_team_id) ? 'incoming' : 'outgoing',
            };
        });
    }

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

        // Log actual column types for debugging
        const colTypes = await this.dataSource.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'matches' 
            AND column_name IN ('creator_team_id', 'opponent_team_id', 'creator_id', 'id')
        `);
        console.log('[TeamsService] Column types before fix:', JSON.stringify(colTypes));

        // Ensure team_match column exists
        await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_match BOOLEAN DEFAULT false`);

        // Force drop and recreate columns with correct UUID type
        // This is necessary because ALTER TYPE doesn't always work
        await this.dataSource.query(`ALTER TABLE matches DROP COLUMN IF EXISTS creator_team_id`);
        await this.dataSource.query(`ALTER TABLE matches DROP COLUMN IF EXISTS opponent_team_id`);
        await this.dataSource.query(`ALTER TABLE matches ADD COLUMN creator_team_id UUID`);
        await this.dataSource.query(`ALTER TABLE matches ADD COLUMN opponent_team_id UUID`);
        console.log('[TeamsService] Recreated team id columns as UUID');

        // Create team match - let database handle id generation
        const matchResult = await this.dataSource.query(`
            INSERT INTO matches (match_type, status, team_match, creator_team_id, opponent_team_id, creator_id)
            VALUES ('3v3', 'accepted', true, $1, $2, $3)
            RETURNING *
        `, [challenge.from_team_id, challenge.to_team_id, userId]);
        const match = matchResult[0];

        // Fix team_challenges.match_id column type from INTEGER to UUID 
        // This is the root cause of the "invalid input syntax for type integer" error
        await this.dataSource.query(`ALTER TABLE team_challenges DROP COLUMN IF EXISTS match_id`);
        await this.dataSource.query(`ALTER TABLE team_challenges ADD COLUMN match_id UUID`);
        console.log('[TeamsService] Fixed team_challenges.match_id column to UUID');

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
     * Submit scores for a team match.
     * If opponent is a registered team, sets status to pending_confirmation.
     * If opponent is unregistered, finalizes immediately.
     */
    async submitTeamMatchScore(
        matchId: string,
        teamId: string,
        userId: string,
        myScore: number,
        opponentScore: number,
    ): Promise<any> {
        console.log(`[TeamsService] submitTeamMatchScore called: matchId=${matchId}, teamId=${teamId}, userId=${userId}, myScore=${myScore}, oppScore=${opponentScore}`);

        try {
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

            // Determine scores relative to creator/opponent
            const isCreatorTeam = match.creator_team_id === teamId;
            const creatorScore = isCreatorTeam ? myScore : opponentScore;
            const opponentTeamScore = isCreatorTeam ? opponentScore : myScore;

            if (match.opponent_team_id) {
                // Registered opponent → pending confirmation
                await this.dataSource.query(`
                    UPDATE matches SET
                        status = 'pending_confirmation',
                        score_creator = $1,
                        score_opponent = $2,
                        submitted_by_team_id = $3
                    WHERE id = $4
                `, [creatorScore, opponentTeamScore, teamId, matchId]);

                console.log(`[TeamsService] Match ${matchId} set to pending_confirmation, awaiting opponent team ${match.opponent_team_id}`);
                return {
                    matchId,
                    status: 'pending_confirmation',
                    scores: { creator: creatorScore, opponent: opponentTeamScore },
                };
            } else {
                // Unregistered opponent → finalize immediately
                return await this._finalizeTeamMatch(matchId, match, creatorScore, opponentTeamScore, teamId);
            }
        } catch (error) {
            console.error(`[TeamsService] submitTeamMatchScore ERROR:`, error);
            throw error;
        }
    }

    /**
     * Opponent confirms the submitted score → finalize the match
     */
    async confirmTeamMatchScore(matchId: string, teamId: string, userId: string): Promise<any> {
        console.log(`[TeamsService] confirmTeamMatchScore: matchId=${matchId}, teamId=${teamId}`);

        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You must be a member of the team');
        }

        const matches = await this.dataSource.query(`
            SELECT * FROM matches WHERE id = $1 AND team_match = true AND status = 'pending_confirmation'
        `, [matchId]);
        if (matches.length === 0) {
            throw new NotFoundException('No pending team match found');
        }
        const match = matches[0];

        // Ensure this team is NOT the one that submitted
        if (match.submitted_by_team_id === teamId) {
            throw new ForbiddenException('You cannot confirm your own score submission');
        }

        return await this._finalizeTeamMatch(matchId, match, match.score_creator, match.score_opponent, null);
    }

    /**
     * Opponent proposes amended scores
     */
    async amendTeamMatchScore(
        matchId: string, teamId: string, userId: string,
        myScore: number, opponentScore: number,
    ): Promise<any> {
        console.log(`[TeamsService] amendTeamMatchScore: matchId=${matchId}, teamId=${teamId}, myScore=${myScore}, oppScore=${opponentScore}`);

        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You must be a member of the team');
        }

        const matches = await this.dataSource.query(`
            SELECT * FROM matches WHERE id = $1 AND team_match = true AND status = 'pending_confirmation'
        `, [matchId]);
        if (matches.length === 0) {
            throw new NotFoundException('No pending team match found');
        }
        const match = matches[0];

        if (match.submitted_by_team_id === teamId) {
            throw new ForbiddenException('You cannot amend your own score submission');
        }

        // Store amended scores relative to creator/opponent
        const isCreatorTeam = match.creator_team_id === teamId;
        const amendedCreator = isCreatorTeam ? myScore : opponentScore;
        const amendedOpponent = isCreatorTeam ? opponentScore : myScore;

        await this.dataSource.query(`
            UPDATE matches SET
                status = 'pending_amendment',
                amended_score_creator = $1,
                amended_score_opponent = $2,
                amended_by_team_id = $3
            WHERE id = $4
        `, [amendedCreator, amendedOpponent, teamId, matchId]);

        return { matchId, status: 'pending_amendment' };
    }

    /**
     * Original submitter accepts the amendment → finalize with amended scores
     */
    async confirmAmendment(matchId: string, teamId: string, userId: string): Promise<any> {
        console.log(`[TeamsService] confirmAmendment: matchId=${matchId}, teamId=${teamId}`);

        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You must be a member of the team');
        }

        const matches = await this.dataSource.query(`
            SELECT * FROM matches WHERE id = $1 AND team_match = true AND status = 'pending_amendment'
        `, [matchId]);
        if (matches.length === 0) {
            throw new NotFoundException('No pending amendment found');
        }
        const match = matches[0];

        // Only the original submitter can accept the amendment
        if (match.submitted_by_team_id !== teamId) {
            throw new ForbiddenException('Only the original score submitter can accept amendments');
        }

        // Finalize with amended scores
        return await this._finalizeTeamMatch(matchId, match, match.amended_score_creator, match.amended_score_opponent, null);
    }

    /**
     * Original submitter rejects the amendment → revert to pending_confirmation
     */
    async rejectAmendment(matchId: string, teamId: string, userId: string): Promise<any> {
        console.log(`[TeamsService] rejectAmendment: matchId=${matchId}, teamId=${teamId}`);

        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You must be a member of the team');
        }

        const matches = await this.dataSource.query(`
            SELECT * FROM matches WHERE id = $1 AND team_match = true AND status = 'pending_amendment'
        `, [matchId]);
        if (matches.length === 0) {
            throw new NotFoundException('No pending amendment found');
        }
        const match = matches[0];

        if (match.submitted_by_team_id !== teamId) {
            throw new ForbiddenException('Only the original score submitter can reject amendments');
        }

        // Revert to pending_confirmation with original scores
        await this.dataSource.query(`
            UPDATE matches SET
                status = 'pending_confirmation',
                amended_score_creator = NULL,
                amended_score_opponent = NULL,
                amended_by_team_id = NULL
            WHERE id = $1
        `, [matchId]);

        return { matchId, status: 'pending_confirmation' };
    }

    /**
     * Get pending team scores (pending_confirmation or pending_amendment) for teams user belongs to
     */
    async getPendingTeamScores(userId: string): Promise<any[]> {
        const results = await this.dataSource.query(`
            SELECT m.id as "matchId", m.status, m.score_creator, m.score_opponent,
                   m.creator_team_id, m.opponent_team_id, m.submitted_by_team_id,
                   m.amended_score_creator, m.amended_score_opponent, m.amended_by_team_id,
                   COALESCE(t1.name, 'Unknown') as "creatorTeamName",
                   COALESCE(t2.name, m.opponent_name, 'Unknown') as "opponentTeamName"
            FROM matches m
            LEFT JOIN teams t1 ON t1.id = m.creator_team_id::uuid
            LEFT JOIN teams t2 ON t2.id = m.opponent_team_id::uuid
            INNER JOIN team_members tm ON (tm.team_id = m.creator_team_id OR tm.team_id = m.opponent_team_id)
            WHERE m.team_match = true
              AND m.status IN ('pending_confirmation', 'pending_amendment')
              AND tm.user_id = $1
              AND tm.status = 'active'
        `, [userId]);

        return results;
    }

    /**
     * Private: Finalize a team match with given scores — updates ratings, W/L, and match status
     */
    private async _finalizeTeamMatch(
        matchId: string, match: any,
        creatorScore: number, opponentScore: number,
        submittingTeamId: string | null,
    ): Promise<any> {
        const winnerTeamId = creatorScore > opponentScore ? match.creator_team_id : match.opponent_team_id;

        // Get current team ratings
        const creatorTeamResult = await this.dataSource.query(`SELECT id, rating FROM teams WHERE id = $1`, [match.creator_team_id]);
        const opponentTeamResult = match.opponent_team_id
            ? await this.dataSource.query(`SELECT id, rating FROM teams WHERE id = $1`, [match.opponent_team_id])
            : [null];

        const creatorTeam = creatorTeamResult[0];
        const opponentTeam = opponentTeamResult[0];

        const creatorRating = parseFloat(creatorTeam?.rating || '3.0');
        const opponentRating = parseFloat(opponentTeam?.rating || '3.0');

        // Calculate new Elo ratings
        const K = 0.2;
        const expectedCreator = 1 / (1 + Math.pow(10, (opponentRating - creatorRating) / 1));
        const creatorWon = match.creator_team_id === winnerTeamId ? 1 : 0;

        const newCreatorRating = Math.max(1, Math.min(5, creatorRating + K * (creatorWon - expectedCreator)));
        const newOpponentRating = Math.max(1, Math.min(5, opponentRating + K * ((1 - creatorWon) - (1 - expectedCreator))));

        const winnerOldRating = match.creator_team_id === winnerTeamId ? creatorRating : opponentRating;
        const winnerNewRating = match.creator_team_id === winnerTeamId ? newCreatorRating : newOpponentRating;
        const loserOldRating = match.creator_team_id === winnerTeamId ? opponentRating : creatorRating;
        const loserNewRating = match.creator_team_id === winnerTeamId ? newOpponentRating : newCreatorRating;

        await this.dataSource.query(`
            UPDATE matches SET
                status = 'completed',
                winner_id = $1,
                score_creator = $2,
                score_opponent = $3,
                completed_at = NOW(),
                winner_old_rating = $5,
                winner_new_rating = $6,
                loser_old_rating = $7,
                loser_new_rating = $8
            WHERE id = $4
        `, [winnerTeamId, creatorScore, opponentScore, matchId,
            winnerOldRating.toFixed(2), winnerNewRating.toFixed(2),
            loserOldRating.toFixed(2), loserNewRating.toFixed(2)]);

        // Update team ratings and W/L records
        if (match.creator_team_id === winnerTeamId) {
            await this.dataSource.query(`UPDATE teams SET rating = $1, wins = COALESCE(wins, 0) + 1 WHERE id = $2`,
                [newCreatorRating.toFixed(2), match.creator_team_id]);
            if (match.opponent_team_id) {
                await this.dataSource.query(`UPDATE teams SET rating = $1, losses = COALESCE(losses, 0) + 1 WHERE id = $2`,
                    [newOpponentRating.toFixed(2), match.opponent_team_id]);
            }
        } else {
            await this.dataSource.query(`UPDATE teams SET rating = $1, losses = COALESCE(losses, 0) + 1 WHERE id = $2`,
                [newCreatorRating.toFixed(2), match.creator_team_id]);
            if (match.opponent_team_id) {
                await this.dataSource.query(`UPDATE teams SET rating = $1, wins = COALESCE(wins, 0) + 1 WHERE id = $2`,
                    [newOpponentRating.toFixed(2), match.opponent_team_id]);
            }
        }

        console.log(`[TeamsService] Match ${matchId} finalized. Winner: ${winnerTeamId}, Creator: ${creatorRating} → ${newCreatorRating.toFixed(2)}, Opponent: ${opponentRating} → ${newOpponentRating.toFixed(2)}`);

        return {
            matchId,
            status: 'completed',
            winnerTeamId,
            scores: { creator: creatorScore, opponent: opponentScore },
            ratingChanges: {
                [match.creator_team_id]: { old: creatorRating, new: newCreatorRating },
                ...(match.opponent_team_id ? { [match.opponent_team_id]: { old: opponentRating, new: newOpponentRating } } : {}),
            },
        };
    }

    // ====================
    // TEAM EVENTS (Practices & Games)
    // ====================

    /**
     * Create a team event (practice or game)
     */
    async createTeamEvent(teamId: string, userId: string, dto: {
        type: string;
        title: string;
        eventDate: string;
        endDate?: string;
        locationName?: string;
        courtId?: string;
        opponentTeamId?: string;
        opponentTeamName?: string;
        recurrenceRule?: string;
        notes?: string;
    }): Promise<TeamEvent> {
        // Verify user is a member
        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You must be a member of the team');
        }

        // Validate type
        if (!['practice', 'game'].includes(dto.type)) {
            throw new BadRequestException('Event type must be practice or game');
        }

        const event = new TeamEvent();
        event.teamId = teamId;
        event.type = dto.type;
        event.title = dto.title;
        event.eventDate = new Date(dto.eventDate);
        event.endDate = dto.endDate ? new Date(dto.endDate) : null;
        event.locationName = dto.locationName || null;
        event.courtId = dto.courtId || null;
        event.opponentTeamId = dto.opponentTeamId || null;
        event.opponentTeamName = dto.opponentTeamName || null;
        event.recurrenceRule = dto.recurrenceRule || null;
        event.notes = dto.notes || null;
        event.createdBy = userId;

        const saved = await this.eventsRepository.save(event);

        // Auto-mark creator as IN
        const attendance = new TeamEventAttendance();
        attendance.eventId = saved.id;
        attendance.userId = userId;
        attendance.status = 'in';
        await this.attendanceRepository.save(attendance);

        console.log(`[TeamsService] Created ${dto.type} event: ${saved.id} for team ${teamId}`);

        // If this is a game with an opponent, auto-create challenge + match
        // Per design: scheduled games are valid challenges (no acceptance needed)
        if (dto.type === 'game' && dto.opponentTeamId) {
            try {
                // Get team type for match_type
                const team = await this.teamsRepository.findOne({ where: { id: teamId } });
                const matchType = team?.teamType || '3v3';

                // Ensure required columns exist
                await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_match BOOLEAN DEFAULT false`);
                await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS creator_team_id UUID`);
                await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent_team_id UUID`);

                // Create match
                const matchResult = await this.dataSource.query(`
                    INSERT INTO matches (match_type, status, team_match, creator_team_id, opponent_team_id, creator_id, opponent_name)
                    VALUES ($1, 'accepted', true, $2, $3, $4, $5)
                    RETURNING *
                `, [matchType, teamId, dto.opponentTeamId, userId, dto.opponentTeamName || null]);
                const match = matchResult[0];

                // Create auto-accepted challenge
                await this.dataSource.query(`
                    INSERT INTO team_challenges (from_team_id, to_team_id, message, status, match_id, created_by)
                    VALUES ($1, $2, $3, 'accepted', $4, $5)
                `, [teamId, dto.opponentTeamId, `Scheduled game: ${saved.title}`, match.id, userId]);

                // Link event to match
                await this.dataSource.query(`UPDATE team_events SET match_id = $1 WHERE id = $2`, [match.id, saved.id]);
                saved.matchId = match.id;

                console.log(`[TeamsService] Auto-created challenge + match ${match.id} for game event ${saved.id}`);
            } catch (err) {
                console.error(`[TeamsService] Failed to auto-create match for game event: ${err.message}`);
                // Don't fail the event creation if match creation fails
            }
        }

        return saved;
    }

    /**
     * Get upcoming events for a team with attendance info
     */
    async getTeamEvents(teamId: string, userId: string): Promise<any[]> {
        // Verify user is a member
        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You must be a member of the team');
        }

        const events = await this.eventsRepository.find({
            where: {
                teamId,
                eventDate: MoreThanOrEqual(new Date()),
            },
            order: { eventDate: 'ASC' },
        });

        // Hydrate each event with attendance data
        const result: any[] = [];
        for (const event of events) {
            const allAttendance = await this.attendanceRepository.find({
                where: { eventId: event.id },
            });

            const inCount = allAttendance.filter(a => a.status === 'in').length;
            const outCount = allAttendance.filter(a => a.status === 'out').length;
            const myAttendance = allAttendance.find(a => a.userId === userId);

            // Get display names for attendees
            const inUserIds = allAttendance.filter(a => a.status === 'in').map(a => a.userId);
            const outUserIds = allAttendance.filter(a => a.status === 'out').map(a => a.userId);

            result.push({
                id: event.id,
                teamId: event.teamId,
                type: event.type,
                title: event.title,
                eventDate: event.eventDate,
                endDate: event.endDate,
                locationName: event.locationName,
                courtId: event.courtId,
                opponentTeamId: event.opponentTeamId,
                opponentTeamName: event.opponentTeamName,
                matchId: event.matchId || null,
                recurrenceRule: event.recurrenceRule,
                notes: event.notes,
                createdBy: event.createdBy,
                createdAt: event.createdAt,
                inCount,
                outCount,
                myStatus: myAttendance?.status || null,
                inUsers: inUserIds,
                outUsers: outUserIds,
            });
        }

        return result;
    }

    /**
     * Toggle attendance for a team event (IN / OUT)
     */
    async toggleAttendance(teamId: string, eventId: string, userId: string, status: string): Promise<any> {
        // Verify user is a member
        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You must be a member of the team');
        }

        // Verify event exists and belongs to team
        const event = await this.eventsRepository.findOne({
            where: { id: eventId, teamId },
        });
        if (!event) {
            throw new NotFoundException('Event not found');
        }

        if (!['in', 'out'].includes(status)) {
            throw new BadRequestException('Status must be in or out');
        }

        // Upsert attendance
        let attendance = await this.attendanceRepository.findOne({
            where: { eventId, userId },
        });

        if (attendance) {
            attendance.status = status;
            await this.attendanceRepository.save(attendance);
        } else {
            attendance = this.attendanceRepository.create({
                eventId,
                userId,
                status,
            });
            await this.attendanceRepository.save(attendance);
        }

        console.log(`[TeamsService] User ${userId} marked ${status} for event ${eventId}`);
        return { eventId, userId, status };
    }

    /**
     * Delete a team event (creator or team owner only)
     */
    async deleteTeamEvent(teamId: string, eventId: string, userId: string): Promise<void> {
        const event = await this.eventsRepository.findOne({
            where: { id: eventId, teamId },
        });
        if (!event) {
            throw new NotFoundException('Event not found');
        }

        // Only creator or team owner can delete
        const team = await this.teamsRepository.findOne({ where: { id: teamId } });
        if (event.createdBy !== userId && team?.ownerId !== userId) {
            throw new ForbiddenException('Only the event creator or team owner can delete events');
        }

        // Delete attendance records first
        await this.attendanceRepository.delete({ eventId });
        // Delete event
        await this.eventsRepository.delete({ id: eventId });

        console.log(`[TeamsService] Deleted event ${eventId} from team ${teamId}`);
    }

    /**
     * Get all upcoming events from all teams the user belongs to.
     * Used for the unified "Schedule" tab.
     */
    async getAllTeamEvents(userId: string): Promise<any[]> {
        // Get all teams user is member of
        const teams = await this.getUserTeams(userId);
        const result: any[] = [];

        for (const team of teams) {
            const teamId = team.id?.toString() ?? '';
            if (!teamId) continue;
            const events = await this.getTeamEvents(teamId, userId);
            for (const event of events) {
                event.teamName = team.name ?? 'Team';
            }
            result.push(...events);
        }

        // Sort by event date ascending
        result.sort((a: any, b: any) => {
            const aDate = new Date(a.eventDate || 0).getTime();
            const bDate = new Date(b.eventDate || 0).getTime();
            return aDate - bDate;
        });

        return result;
    }

    /**
     * Start a match from a scheduled game event.
     * If the event already has a match_id, return that match.
     * Otherwise create a new match record and link it to the event.
     */
    async startMatchFromEvent(teamId: string, eventId: string, userId: string): Promise<any> {
        // Verify membership
        const membership = await this.membersRepository.findOne({
            where: { teamId, userId, status: 'active' },
        });
        if (!membership) {
            throw new ForbiddenException('You must be a member of the team');
        }

        // Get event
        const event = await this.eventsRepository.findOne({
            where: { id: eventId, teamId },
        });
        if (!event) {
            throw new NotFoundException('Event not found');
        }
        if (event.type !== 'game') {
            throw new ForbiddenException('Only game events can start a match');
        }

        // If event already has a match, return it
        if (event.matchId) {
            const existingMatch = await this.dataSource.query(
                `SELECT * FROM matches WHERE id = $1`, [event.matchId]
            );
            if (existingMatch.length > 0) {
                console.log(`[TeamsService] Event ${eventId} already has match ${event.matchId}`);
                return { match: existingMatch[0], event };
            }
        }

        // Determine match type from team
        const team = await this.teamsRepository.findOne({ where: { id: teamId } });
        const matchType = team?.teamType || '5v5';

        // Ensure schema
        await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_match BOOLEAN DEFAULT false`);
        await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS creator_team_id UUID`);
        await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent_team_id UUID`);
        await this.dataSource.query(`ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent_name TEXT`);

        // Create match
        const matchResult = await this.dataSource.query(`
            INSERT INTO matches (match_type, status, team_match, creator_team_id, opponent_team_id, creator_id, opponent_name)
            VALUES ($1, 'accepted', true, $2, $3, $4, $5)
            RETURNING *
        `, [matchType, teamId, event.opponentTeamId || null, userId, event.opponentTeamName || null]);
        const match = matchResult[0];

        // Link event to match
        await this.dataSource.query(`UPDATE team_events SET match_id = $1 WHERE id = $2`, [match.id, eventId]);

        console.log(`[TeamsService] Started match ${match.id} from event ${eventId}`);
        return { match, event };
    }
}

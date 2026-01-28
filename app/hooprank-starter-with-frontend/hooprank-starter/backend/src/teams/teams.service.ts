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
}

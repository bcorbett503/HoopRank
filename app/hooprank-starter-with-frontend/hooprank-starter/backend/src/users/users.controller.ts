import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Headers,
  UseGuards,
  Request,
  Query,
  ForbiddenException,
  UnauthorizedException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { UsersService } from "./users.service";
import { AuthGuard } from "../auth/auth.guard";
import { User } from "./user.entity";
import { NotificationsService } from "../notifications/notifications.service";
import { DataSource } from "typeorm";
import { Public } from "../auth/public.decorator";
import { AuthenticateDto } from "./dto/authenticate.dto";

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Auth bootstrap endpoint — @Public so iOS can call without Bearer token.
   * Verifies Firebase token from header or body if available.
   */
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post("auth")
  async authenticate(@Request() req, @Body() body: AuthenticateDto) {
    // Try to verify Firebase token if provided (from header or body)
    let uid = "";
    let email = body.email || "";
    let photoUrl = "";
    let displayName = "";

    const authHeader = req.headers?.authorization;
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const firebaseToken = bearerToken || body.firebaseToken || body.idToken;

    if (!firebaseToken) {
      console.error("[AUTHENTICATE] No authentication token provided");
      throw new UnauthorizedException("Authentication token required");
    }

    try {
      const admin = require("firebase-admin");
      if (admin.apps.length === 0) {
        console.error("[AUTHENTICATE] Firebase Admin not initialized");
        throw new ServiceUnavailableException(
          "Authentication service unavailable",
        );
      }
      const decoded = await admin.auth().verifyIdToken(firebaseToken);
      uid = decoded.uid;
      email = email || decoded.email || "";
      photoUrl = decoded.picture || ""; // Google profile picture URL
      displayName = decoded.name || ""; // Google display name
    } catch (e) {
      // Re-throw NestJS exceptions as-is
      if (
        e instanceof UnauthorizedException ||
        e instanceof ServiceUnavailableException
      ) {
        throw e;
      }
      console.error("[AUTHENTICATE] Token verification failed:", e.message);
      throw new UnauthorizedException("Invalid authentication token");
    }

    if (!uid) {
      console.error("[AUTHENTICATE] No user ID from token");
      throw new UnauthorizedException("Authentication failed");
    }

    const user = await this.usersService.findOrCreate(uid, email);

    // Sync profile picture and display name from the auth provider.
    // Update if the DB value is empty, a base64 placeholder, or 'New Player'.
    const u = user as any;
    const currentPhoto = u.avatar_url || u.avatarUrl || "";
    const currentName = u.name || "";
    const needsPhotoSync =
      photoUrl && (!currentPhoto || currentPhoto.startsWith("data:"));
    const needsNameSync =
      displayName && (!currentName || currentName === "New Player");

    if (needsPhotoSync || needsNameSync) {
      try {
        const updates: Record<string, string> = {};
        if (needsPhotoSync) updates.avatar_url = photoUrl;
        if (needsNameSync) updates.name = displayName;
        await this.usersService.updateProfile(uid, updates as any);
        // Reflect in the response immediately
        if (needsPhotoSync) {
          u.avatar_url = photoUrl;
          u.avatarUrl = photoUrl;
        }
        if (needsNameSync) u.name = displayName;
        console.log(
          `[AUTHENTICATE] Synced profile for ${uid}:`,
          Object.keys(updates).join(", "),
        );
      } catch (syncErr) {
        console.error("[AUTHENTICATE] Profile sync failed:", syncErr.message);
      }
    }

    // Return with iOS-compatible aliases
    return {
      ...u,
      rating: parseFloat(u.hoopRank ?? u.hoop_rank) || 3.0,
      hoop_rank: parseFloat(u.hoopRank ?? u.hoop_rank) || 3.0,
      matchesPlayed: u.gamesPlayed ?? u.games_played ?? 0,
      games_played: u.gamesPlayed ?? u.games_played ?? 0,
      badges: u.badges || [],
      photoUrl: u.avatarUrl ?? u.avatar_url ?? null,
      avatar_url: u.avatarUrl ?? u.avatar_url ?? null,
      photo_url: u.avatarUrl ?? u.avatar_url ?? null,
    };
  }

  // Delete a specific user and all their data (for testing)
  @Delete("admin/user/:userId")
  async deleteUser(@Param("userId") userId: string) {
    return this.usersService.deleteUser(userId);
  }

  @Get()
  findAll() {
    return this.usersService.getAll();
  }

  // Public-safe endpoint returning only minimal profile fields for discovery.
  @Public()
  @Get("public")
  async findAllPublic() {
    const users = await this.usersService.getAll();
    return (users || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      position: u.position,
      badges: u.badges || [],
      photoUrl: u.photo_url ?? u.photoUrl,
      hoopRank: parseFloat(u.hoop_rank ?? u.hoopRank) || 3.0,
    }));
  }

  @Get("me")
  async getMe(@Headers("x-user-id") userId: string) {
    const user = await this.usersService.findOne(userId);
    if (!user) return user;
    const u = user as any;
    return {
      ...u,
      rating: parseFloat(u.hoopRank ?? u.hoop_rank) || 3.0,
      hoop_rank: parseFloat(u.hoopRank ?? u.hoop_rank) || 3.0,
      matchesPlayed: u.gamesPlayed ?? u.games_played ?? 0,
      games_played: u.gamesPlayed ?? u.games_played ?? 0,
      badges: u.badges || [],
      photoUrl: u.avatarUrl ?? u.avatar_url ?? null,
      avatar_url: u.avatarUrl ?? u.avatar_url ?? null,
      photo_url: u.avatarUrl ?? u.avatar_url ?? null,
      onboarding_progress: u.onboardingProgress ?? u.onboarding_progress ?? {},
    };
  }

  @Put("me")
  async updateMe(
    @Headers("x-user-id") userId: string,
    @Body() data: Partial<User>,
  ) {
    if (!userId) {
      return { success: false, error: "User ID required" };
    }
    try {
      const user = await this.usersService.updateProfile(userId, data);
      return user;
    } catch (error) {
      console.error("updateMe error:", error.message);
      // If user doesn't exist, try to create them first
      if (error.message === "User not found") {
        try {
          await this.usersService.findOrCreate(userId, data.email || "");
          const user = await this.usersService.updateProfile(userId, data);
          return user;
        } catch (createError) {
          console.error(
            "updateMe: failed to create user:",
            createError.message,
          );
          return { success: false, error: "Failed to create user profile" };
        }
      }
      return { success: false, error: "Failed to update profile" };
    }
  }

  @Get("me/follows")
  async getFollows(@Headers("x-user-id") userId: string) {
    if (!userId) {
      return { courts: [], players: [], teams: [] };
    }
    const result = await this.usersService.getFollows(userId);
    return result;
  }

  @Get("me/follows/activity")
  async getFollowedActivity(@Headers("x-user-id") userId: string) {
    if (!userId) {
      return { courtActivity: [], playerActivity: [] };
    }
    return this.usersService.getFollowedActivity(userId);
  }

  @Post("me/follows/courts")
  async followCourt(
    @Headers("x-user-id") userId: string,
    @Body() body: { courtId: string; alertsEnabled?: boolean },
  ) {
    if (!userId) {
      return { success: false, error: "User ID required" };
    }
    try {
      await this.usersService.followCourt(userId, body.courtId);
      // If alerts requested, also enable alerts (but don't fail if this throws)
      if (body.alertsEnabled) {
        try {
          await this.notificationsService.enableCourtAlert(
            userId,
            body.courtId,
          );
        } catch (alertError) {
          console.error("Error enabling court alert:", alertError.message);
        }
      }
      return { success: true };
    } catch (error) {
      console.error("followCourt error:", error);
      return {
        success: false,
        error: `Failed to follow court: ${error.message}`,
      };
    }
  }

  @Delete("me/follows/courts/:courtId")
  async unfollowCourt(
    @Headers("x-user-id") userId: string,
    @Param("courtId") courtId: string,
  ) {
    if (!userId) {
      return { success: false, error: "User ID required" };
    }
    try {
      await this.usersService.unfollowCourt(userId, courtId);
      // Also disable alerts when unfollowing (but don't fail if this throws)
      try {
        await this.notificationsService.disableCourtAlert(userId, courtId);
      } catch (alertError) {
        console.error("Error disabling court alert:", alertError.message);
      }
      return { success: true };
    } catch (error) {
      console.error("unfollowCourt error:", error.message);
      return { success: false, error: "Failed to unfollow court" };
    }
  }

  @Put("me/follows/courts/:courtId/alerts")
  async setCourtAlert(
    @Headers("x-user-id") userId: string,
    @Param("courtId") courtId: string,
    @Body() body: { enabled: boolean },
  ) {
    if (!userId) {
      return { success: false, error: "User ID required" };
    }

    if (body.enabled) {
      await this.notificationsService.enableCourtAlert(userId, courtId);
    } else {
      await this.notificationsService.disableCourtAlert(userId, courtId);
    }
    return { success: true };
  }

  @Post("me/follows/players")
  async followPlayer(
    @Headers("x-user-id") userId: string,
    @Body() body: { playerId: string },
  ) {
    if (!userId || !body.playerId) {
      return { success: false, error: "User ID and Player ID required" };
    }
    await this.usersService.followPlayer(userId, body.playerId);
    return { success: true };
  }

  @Delete("me/follows/players/:playerId")
  async unfollowPlayer(
    @Headers("x-user-id") userId: string,
    @Param("playerId") playerId: string,
  ) {
    if (!userId || !playerId) {
      return { success: false, error: "User ID and Player ID required" };
    }
    await this.usersService.unfollowPlayer(userId, playerId);
    return { success: true };
  }

  @Post("me/follows/teams")
  async followTeam(
    @Headers("x-user-id") userId: string,
    @Body() body: { teamId: string },
  ) {
    if (!userId || !body.teamId) {
      return { success: false, error: "User ID and Team ID required" };
    }
    try {
      await this.usersService.followTeam(userId, body.teamId);
      return { success: true };
    } catch (error) {
      console.error("followTeam error:", error);
      return {
        success: false,
        error: `Failed to follow team: ${error.message}`,
      };
    }
  }

  @Delete("me/follows/teams/:teamId")
  async unfollowTeam(
    @Headers("x-user-id") userId: string,
    @Param("teamId") teamId: string,
  ) {
    if (!userId || !teamId) {
      return { success: false, error: "User ID and Team ID required" };
    }
    try {
      await this.usersService.unfollowTeam(userId, teamId);
      return { success: true };
    } catch (error) {
      console.error("unfollowTeam error:", error.message);
      return { success: false, error: "Failed to unfollow team" };
    }
  }

  @Post("me/fcm-token")
  async saveFcmToken(
    @Headers("x-user-id") userId: string,
    @Body() body: { token: string },
  ) {
    if (!userId) {
      return { success: false, error: "User ID required" };
    }
    try {
      await this.notificationsService.saveFcmToken(userId, body.token);
      return { success: true };
    } catch (error) {
      console.error("saveFcmToken error:", error.message);
      return { success: false, error: "Failed to save FCM token" };
    }
  }

  @Delete("me/fcm-token")
  async clearFcmToken(@Headers("x-user-id") userId: string) {
    if (!userId) {
      return { success: false, error: "User ID required" };
    }
    try {
      await this.notificationsService.clearFcmToken(userId);
      return { success: true };
    } catch (error) {
      console.error("clearFcmToken error:", error.message);
      return { success: false, error: "Failed to clear FCM token" };
    }
  }

  /**
   * Privacy settings stub — returns sensible defaults.
   */
  @Get("me/privacy")
  async getPrivacy(@Headers("x-user-id") userId: string) {
    return {
      profileVisibility: "public",
      showLocation: true,
      showActivity: true,
      allowMessages: "everyone",
    };
  }

  @Put("me/privacy")
  async updatePrivacy(@Headers("x-user-id") userId: string, @Body() body: any) {
    // Stub: accept the payload but don't persist yet
    return { success: true, ...body };
  }

  // ==================== REPORT & BLOCK (Guideline 1.2) ====================

  @Post("me/report")
  async reportUser(
    @Headers("x-user-id") userId: string,
    @Body() body: { reportedUserId: string; reason: string },
  ) {
    if (!userId || !body.reportedUserId || !body.reason) {
      return {
        success: false,
        error: "userId, reportedUserId, and reason required",
      };
    }
    return this.usersService.reportUser(
      userId,
      body.reportedUserId,
      body.reason,
    );
  }

  @Post("me/blocked/:targetId")
  async blockUser(
    @Headers("x-user-id") userId: string,
    @Param("targetId") targetId: string,
  ) {
    if (!userId || !targetId) {
      return { success: false, error: "User ID and target ID required" };
    }
    return this.usersService.blockUser(userId, targetId);
  }

  @Delete("me/blocked/:targetId")
  async unblockUser(
    @Headers("x-user-id") userId: string,
    @Param("targetId") targetId: string,
  ) {
    if (!userId || !targetId) {
      return { success: false, error: "User ID and target ID required" };
    }
    return this.usersService.unblockUser(userId, targetId);
  }

  @Get("me/blocked")
  async getBlockedUsers(@Headers("x-user-id") userId: string) {
    if (!userId) return [];
    return this.usersService.getBlockedUsers(userId);
  }

  // ==================== ACCOUNT DELETION (Guideline 5.1.1(v)) ====================

  @Delete("me")
  async deleteMyAccount(@Headers("x-user-id") userId: string) {
    if (!userId) {
      return { success: false, error: "User ID required" };
    }
    return this.usersService.deleteMyAccount(userId);
  }

  @Get("nearby")
  async getNearbyUsers(
    @Headers("x-user-id") userId: string,
    @Query("radiusMiles") radiusMiles?: string,
  ) {
    if (!userId) {
      return [];
    }
    const radius = parseInt(radiusMiles || "25", 10);
    return this.usersService.getNearbyUsers(userId, radius);
  }

  @Get(":id/stats")
  async getUserStats(@Param("id") id: string) {
    return this.usersService.getUserStats(id);
  }

  @Get(":id/rating")
  async getUserRating(@Param("id") id: string) {
    const user = await this.usersService.findOne(id);
    if (!user) {
      return { error: "User not found" };
    }
    // Return camelCase keys for mobile compatibility
    // Raw SQL returns hoop_rank, games_played - convert to camelCase
    return {
      hoopRank: parseFloat((user as any).hoop_rank) || 3.0,
      gamesPlayed: parseInt((user as any).games_played) || 0,
    };
  }

  @Get(":id/rank-history")
  async getRankHistory(@Param("id") id: string) {
    // Rank history is derived from match completions.
    // Return the user's match history formatted as rating changes.
    try {
      const matches = await this.usersService.getMatches(id);
      return (matches || [])
        .filter((m: any) =>
          ["completed", "ended"].includes((m?.status || "").toString()),
        )
        .map((m: any) => ({
          date: m.completed_at || m.updated_at,
          rating: parseFloat(m.winner_id === id ? "3.1" : "2.9"),
          matchId: m.id,
        }))
        .slice(0, 50);
    } catch {
      return [];
    }
  }

  @Get(":id/teams")
  async getUserTeams(@Param("id") id: string) {
    try {
      const teams = await this.dataSource.query(
        `
        SELECT t.id, t.name, t.team_type as "teamType",
               COALESCE(t.rating, 3.0) as "rating",
               COALESCE(t.wins, 0) as "wins",
               COALESCE(t.losses, 0) as "losses",
               t.logo_url as "logoUrl",
               (t.owner_id = $1) as "isOwner"
        FROM teams t
        JOIN team_members tm ON tm.team_id = t.id
        WHERE tm.user_id = $1 AND tm.status = 'active'
        ORDER BY t.name
      `,
        [id],
      );
      return teams;
    } catch {
      return [];
    }
  }

  // Public-safe single profile (sanitized fields only).
  // Must be before :id route to avoid NestJS wildcard matching.
  @Public()
  @Get("public/:id")
  async findOnePublic(@Param("id") id: string) {
    const u: any = await this.usersService.findOne(id);
    if (!u) return { error: "User not found" };
    return {
      id: u.id,
      name: u.name,
      position: u.position,
      badges: u.badges || [],
      photoUrl: u.photo_url ?? u.photoUrl,
      hoopRank: parseFloat(u.hoop_rank ?? u.hoopRank) || 3.0,
    };
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    const user = await this.usersService.findOne(id);
    if (!user) return user;
    const stats = await this.usersService.getUserStats(id).catch(() => null);
    const kingCourtsCount = await this.usersService
      .getKingCourtsCount(id)
      .catch(() => 0);
    // Return both native camelCase and iOS-expected aliases
    const u = user as any;
    const matchesPlayed =
      stats?.matchesPlayed ?? u.gamesPlayed ?? u.games_played ?? 0;
    const wins = stats?.wins ?? 0;
    const losses = stats?.losses ?? 0;
    return {
      ...u,
      // iOS User.swift expects these fields
      rating: parseFloat(u.hoopRank ?? u.hoop_rank) || 3.0,
      hoop_rank: parseFloat(u.hoopRank ?? u.hoop_rank) || 3.0,
      matchesPlayed,
      games_played: matchesPlayed,
      wins,
      losses,
      kingCourtsCount,
      king_courts_count: kingCourtsCount,
      badges: u.badges || [],
      photoUrl: u.avatarUrl ?? u.avatar_url ?? null,
      avatar_url: u.avatarUrl ?? u.avatar_url ?? null,
      photo_url: u.avatarUrl ?? u.avatar_url ?? null,
    };
  }

  /**
   * Device token alias — saves FCM/APNs token for push notifications.
   */
  @Post(":id/device-token")
  async saveDeviceToken(
    @Param("id") id: string,
    @Headers("x-user-id") userId: string,
    @Body() body: { token: string },
  ) {
    const resolvedId = userId || id;
    if (!resolvedId || !body.token) {
      return { success: false, error: "User ID and token required" };
    }
    try {
      await this.notificationsService.saveFcmToken(resolvedId, body.token);
      return { success: true };
    } catch (error) {
      return { success: false, error: "Failed to save device token" };
    }
  }

  /**
   * FCM token alias (same as device-token)
   */
  @Post(":id/fcm-token")
  async saveFcmTokenById(
    @Param("id") id: string,
    @Headers("x-user-id") userId: string,
    @Body() body: { token: string },
  ) {
    const resolvedId = userId || id;
    if (!resolvedId || !body.token) {
      return { success: false, error: "User ID and token required" };
    }
    try {
      await this.notificationsService.saveFcmToken(resolvedId, body.token);
      return { success: true };
    } catch (error) {
      return { success: false, error: "Failed to save FCM token" };
    }
  }

  @Post(":id/profile")
  async updateProfile(
    @Param("id") id: string,
    @Headers("x-user-id") userId: string,
    @Body() data: Partial<User>,
  ) {
    if (!id || !userId) {
      return { success: false, error: "User ID required" };
    }
    if (id !== userId) {
      throw new ForbiddenException("You can only update your own profile");
    }
    try {
      const user = await this.usersService.updateProfile(id, data);
      return user;
    } catch (error) {
      console.error("updateProfile error:", error.message);
      // If user doesn't exist, try to create them first
      if (error.message === "User not found") {
        try {
          await this.usersService.findOrCreate(id, data.email || "");
          const user = await this.usersService.updateProfile(id, data);
          return user;
        } catch (createError) {
          console.error(
            "updateProfile: failed to create user:",
            createError.message,
          );
          return { success: false, error: "Failed to create user profile" };
        }
      }
      return { success: false, error: "Failed to update profile" };
    }
  }

  @Post(":id/friends/:friendId")
  @UseGuards(AuthGuard)
  addFriend(
    @Param("id") id: string,
    @Param("friendId") friendId: string,
    @Headers("x-user-id") userId: string,
  ) {
    if (id !== userId) {
      throw new ForbiddenException("You can only modify your own friends");
    }
    return this.usersService.addFriend(id, friendId);
  }

  @Post(":id/friends/:friendId/remove")
  @UseGuards(AuthGuard)
  removeFriend(
    @Param("id") id: string,
    @Param("friendId") friendId: string,
    @Headers("x-user-id") userId: string,
  ) {
    if (id !== userId) {
      throw new ForbiddenException("You can only modify your own friends");
    }
    return this.usersService.removeFriend(id, friendId);
  }

  @Get(":id/friends")
  getFriends(@Param("id") id: string) {
    return this.usersService.getFriends(id);
  }

  @Get(":id/matches")
  getMatches(@Param("id") id: string) {
    return this.usersService.getMatches(id);
  }

  @Get(":id/recent-games")
  getRecentGames(@Param("id") id: string) {
    return this.usersService.getRecentGames(id);
  }
}

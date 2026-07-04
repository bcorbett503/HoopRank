import { Injectable, OnModuleInit } from "@nestjs/common";
import { DataSource } from "typeorm";
import { isPostgres } from "../common/db-utils";

type MapHubArgs = {
  userId?: string;
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
  includePlayers?: boolean;
};

@Injectable()
export class MapHubService implements OnModuleInit {
  private readonly postgres: boolean;
  private schemaReady = false;

  constructor(private readonly dataSource: DataSource) {
    this.postgres = isPostgres(dataSource);
  }

  async onModuleInit() {
    await this.ensureMapHubSchema();
  }

  async getHub(args: MapHubArgs) {
    const privacy = args.userId
      ? await this.getPrivacySettings(args.userId)
      : this.defaultPrivacy();
    const radiusMiles = this.clampRadius(
      args.radiusMiles ?? privacy.discoverRadiusMi,
    );

    const [courts, players] = await Promise.all([
      this.getCourts({ ...args, radiusMiles }),
      args.includePlayers === false
        ? Promise.resolve([])
        : this.getPlayers({ ...args, radiusMiles }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      privacy,
      courts,
      players,
    };
  }

  async getPrivacySettings(userId: string) {
    await this.ensurePrivacyRow(userId);

    if (this.postgres) {
      const rows = await this.dataSource.query(
        `
        SELECT
          push_enabled AS "pushEnabled",
          public_profile AS "publicProfile",
          public_location AS "publicLocation",
          map_visibility_enabled AS "mapVisibilityEnabled",
          discover_radius_mi AS "discoverRadiusMi",
          discover_mode AS "discoverMode",
          updated_at AS "updatedAt"
        FROM user_privacy
        WHERE user_id = $1
        LIMIT 1
        `,
        [userId],
      );
      return this.normalizePrivacy(rows[0]);
    }

    const rows = await this.dataSource.query(
      `
      SELECT
        push_enabled AS pushEnabled,
        public_profile AS publicProfile,
        public_location AS publicLocation,
        map_visibility_enabled AS mapVisibilityEnabled,
        discover_radius_mi AS discoverRadiusMi,
        discover_mode AS discoverMode,
        updated_at AS updatedAt
      FROM user_privacy
      WHERE user_id = ?
      LIMIT 1
      `,
      [userId],
    );
    return this.normalizePrivacy(rows[0]);
  }

  private async getCourts(args: MapHubArgs) {
    if (!this.postgres) {
      const rows = await this.dataSource
        .query(
          `
        SELECT
          id,
          name,
          city AS address,
          indoor,
          access,
          venue_type AS venueType,
          signature,
          lat,
          lng
        FROM courts
        WHERE lat IS NOT NULL AND lng IS NOT NULL
        LIMIT 250
      `,
        )
        .catch(() => []);
      return (rows || []).map((row: any) => this.normalizeCourt(row));
    }

    const values: any[] = [];
    const param = (value: any) => {
      values.push(value);
      return `$${values.length}`;
    };

    const where = [`c.geog IS NOT NULL`];
    let orderBy = `c.signature DESC, c.name ASC`;

    if (this.hasCenter(args)) {
      const lngParam = param(args.lng);
      const latParam = param(args.lat);
      const radiusParam = param(this.milesToMeters(args.radiusMiles));
      const center = `ST_SetSRID(ST_MakePoint(${lngParam}, ${latParam}), 4326)::geography`;
      where.push(`ST_DWithin(c.geog, ${center}, ${radiusParam})`);
      orderBy = `ST_Distance(c.geog, ${center}) ASC`;
    } else if (this.hasBounds(args)) {
      where.push(
        `ST_Y(c.geog::geometry) BETWEEN ${param(args.minLat)} AND ${param(args.maxLat)}`,
      );
      where.push(
        `ST_X(c.geog::geometry) BETWEEN ${param(args.minLng)} AND ${param(args.maxLng)}`,
      );
    }

    const rows = await this.dataSource.query(
      `
      SELECT
        c.id,
        c.name,
        COALESCE(c.address, c.city) AS address,
        c.city,
        c.indoor,
        c.access,
        c.venue_type AS "venueType",
        c.signature,
        ST_Y(c.geog::geometry) AS lat,
        ST_X(c.geog::geometry) AS lng,
        (
          SELECT COUNT(*)::int
          FROM check_ins ci
          WHERE ci.court_id::text = c.id::text
            AND ci.checked_out_at IS NULL
        ) AS "activeCheckInCount",
        (
          SELECT COUNT(*)::int
          FROM user_followed_courts ufc
          WHERE ufc.court_id::text = c.id::text
        ) AS "followerCount",
        EXISTS (
          SELECT 1
          FROM scheduled_runs sr
          WHERE sr.court_id::text = c.id::text
            AND sr.scheduled_at >= NOW()
            AND COALESCE(sr.visibility, 'public') = 'public'
        ) AS "hasUpcomingRun",
        (
          SELECT json_build_object(
            'id', sr.id,
            'title', sr.title,
            'gameMode', sr.game_mode,
            'scheduledAt', sr.scheduled_at,
            'maxPlayers', sr.max_players,
            'attendeeCount', (
              SELECT COUNT(*)::int
              FROM run_attendees ra
              WHERE ra.run_id = sr.id
                AND COALESCE(ra.status, 'going') = 'going'
            )
          )
          FROM scheduled_runs sr
          WHERE sr.court_id::text = c.id::text
            AND sr.scheduled_at >= NOW()
            AND COALESCE(sr.visibility, 'public') = 'public'
          ORDER BY sr.scheduled_at ASC
          LIMIT 1
        ) AS "nextRun",
        (
          SELECT json_build_object(
            'id', u.id,
            'name', u.name,
            'photoUrl', u.avatar_url,
            'avatarConfig', u.avatar_config,
            'rating', u.hoop_rank
          )
          FROM user_followed_courts ufc
          JOIN users u ON u.id::text = ufc.user_id::text
          WHERE ufc.court_id::text = c.id::text
          ORDER BY u.hoop_rank DESC NULLS LAST, u.name ASC
          LIMIT 1
        ) AS "topFollower"
      FROM courts c
      WHERE ${where.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT 350
      `,
      values,
    );

    return rows.map((row: any) => this.normalizeCourt(row));
  }

  private async getPlayers(args: MapHubArgs) {
    if (!args.userId) return [];

    if (!this.postgres) {
      const rows = await this.dataSource
        .query(
          `
        SELECT
          u.id,
          u.name,
          u.avatar_url AS avatarUrl,
          u.hoop_rank AS rating,
          u.position,
          u.accepting_challenges AS acceptingChallenges,
          u.games_played AS gamesPlayed,
          u.city,
          u.lat,
          u.lng
        FROM users u
        LEFT JOIN user_privacy up ON up.user_id = u.id
        WHERE u.id = ?
          OR (
            COALESCE(up.map_visibility_enabled, 0) = 1
            AND COALESCE(up.public_profile, 1) = 1
            AND COALESCE(up.public_location, 0) = 1
          )
        LIMIT 75
        `,
          [args.userId],
        )
        .catch(() => []);
      return (rows || []).map((row: any) =>
        this.normalizePlayer(row, args.userId),
      );
    }

    const values: any[] = [];
    const param = (value: any) => {
      values.push(value);
      return `$${values.length}`;
    };

    const userParam = param(args.userId);
    const where = [
      `(
        u.id::text = ${userParam}
        OR (
          COALESCE(up.map_visibility_enabled, FALSE) = TRUE
          AND COALESCE(up.public_profile, TRUE) = TRUE
          AND COALESCE(up.public_location, FALSE) = TRUE
        )
      )`,
      `COALESCE(u.loc_enabled, FALSE) = TRUE`,
      `COALESCE(u.lat, ST_Y(cc.geog::geometry)) IS NOT NULL`,
      `COALESCE(u.lng, ST_X(cc.geog::geometry)) IS NOT NULL`,
    ];
    let orderBy = `u.name ASC`;

    if (this.hasCenter(args)) {
      const lngParam = param(args.lng);
      const latParam = param(args.lat);
      const radiusParam = param(this.milesToMeters(args.radiusMiles));
      const point = `ST_SetSRID(ST_MakePoint(COALESCE(u.lng, ST_X(cc.geog::geometry)), COALESCE(u.lat, ST_Y(cc.geog::geometry))), 4326)::geography`;
      const center = `ST_SetSRID(ST_MakePoint(${lngParam}, ${latParam}), 4326)::geography`;
      where.push(`ST_DWithin(${point}, ${center}, ${radiusParam})`);
      orderBy = `ST_Distance(${point}, ${center}) ASC`;
    } else if (this.hasBounds(args)) {
      where.push(
        `COALESCE(u.lat, ST_Y(cc.geog::geometry)) BETWEEN ${param(args.minLat)} AND ${param(args.maxLat)}`,
      );
      where.push(
        `COALESCE(u.lng, ST_X(cc.geog::geometry)) BETWEEN ${param(args.minLng)} AND ${param(args.maxLng)}`,
      );
    }

    const rows = await this.dataSource.query(
      `
      WITH latest_status AS (
        SELECT DISTINCT ON (ps.user_id)
          ps.user_id,
          ps.content,
          ps.court_id,
          ps.created_at
        FROM player_statuses ps
        WHERE ps.created_at >= NOW() - INTERVAL '24 hours'
          AND ps.scheduled_at IS NULL
        ORDER BY ps.user_id, ps.created_at DESC
      ),
      active_check_in AS (
        SELECT DISTINCT ON (ci.user_id)
          ci.user_id,
          ci.court_id,
          ci.checked_in_at
        FROM check_ins ci
        WHERE ci.checked_out_at IS NULL
        ORDER BY ci.user_id, ci.checked_in_at DESC
      )
      SELECT
        u.id,
        u.name,
        u.avatar_url AS "avatarUrl",
        u.avatar_config AS "avatarConfig",
        u.hoop_rank AS rating,
        u.position,
        COALESCE(u.accepting_challenges, TRUE) AS "acceptingChallenges",
        COALESCE(u.games_played, 0) AS "gamesPlayed",
        u.city,
        COALESCE(u.lat, ST_Y(cc.geog::geometry)) AS lat,
        COALESCE(u.lng, ST_X(cc.geog::geometry)) AS lng,
        latest.content AS "customStatus",
        latest.created_at AS "statusCreatedAt",
        aci.court_id AS "checkedInCourtId",
        cc.name AS "checkedInCourtName",
        ST_Y(cc.geog::geometry) AS "checkedInCourtLat",
        ST_X(cc.geog::geometry) AS "checkedInCourtLng"
      FROM users u
      LEFT JOIN user_privacy up ON up.user_id::text = u.id::text
      LEFT JOIN latest_status latest ON latest.user_id::text = u.id::text
      LEFT JOIN active_check_in aci ON aci.user_id::text = u.id::text
      LEFT JOIN courts cc ON cc.id::text = aci.court_id::text
      WHERE ${where.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT 120
      `,
      values,
    );

    return rows.map((row: any) => this.normalizePlayer(row, args.userId));
  }

  private normalizeCourt(row: any) {
    const activeCheckInCount = this.toInt(
      row.activeCheckInCount ?? row.active_check_in_count,
    );
    const followerCount = this.toInt(row.followerCount ?? row.follower_count);
    const nextRun = row.nextRun ?? row.next_run ?? null;
    const hasUpcomingRun =
      row.hasUpcomingRun ?? row.has_upcoming_run ?? !!nextRun;
    let statusLabel: string | null = null;

    if (activeCheckInCount > 0) {
      statusLabel =
        activeCheckInCount === 1
          ? "1 player here"
          : `${activeCheckInCount} players here`;
    } else if (nextRun) {
      const mode = nextRun.gameMode || nextRun.game_mode || "Run";
      statusLabel = `${mode} scheduled`;
    } else if (followerCount > 0) {
      statusLabel = `${followerCount} following`;
    }

    return {
      id: row.id?.toString() ?? "",
      name: row.name ?? "Court",
      lat: this.toNumber(row.lat),
      lng: this.toNumber(row.lng),
      address: row.address ?? row.city ?? null,
      city: row.city ?? null,
      indoor: row.indoor === true,
      access: row.access ?? "public",
      venueType: row.venueType ?? row.venue_type ?? null,
      signature: row.signature === true,
      followerCount,
      activeCheckInCount,
      hasUpcomingRun: hasUpcomingRun === true,
      hasUpcomingActivity: activeCheckInCount > 0 || hasUpcomingRun === true,
      statusLabel,
      nextRun,
      topFollower: row.topFollower ?? row.top_follower ?? null,
    };
  }

  private normalizePlayer(row: any, currentUserId?: string) {
    const customStatus = row.customStatus ?? row.custom_status ?? null;
    const checkedInCourtName =
      row.checkedInCourtName ?? row.checked_in_court_name ?? null;
    const acceptingChallenges = this.toBool(
      row.acceptingChallenges ?? row.accepting_challenges,
      true,
    );
    const isNewPlayer =
      this.toInt(row.gamesPlayed ?? row.games_played, 0) === 0;
    const statusLabel =
      customStatus ||
      (checkedInCourtName
        ? `At ${checkedInCourtName}`
        : isNewPlayer
          ? "New to HoopRank"
          : acceptingChallenges
            ? "Accepting challenges"
            : "Available nearby");

    return {
      id: row.id?.toString() ?? "",
      name: row.name ?? "Player",
      avatarUrl: row.avatarUrl ?? row.avatar_url ?? null,
      avatarConfig: this.parseJson(row.avatarConfig ?? row.avatar_config),
      rating: this.toNumber(row.rating ?? row.hoop_rank, 3.0),
      position: row.position ?? null,
      acceptingChallenges,
      isNewPlayer,
      city: row.city ?? null,
      lat: this.toNumber(row.lat),
      lng: this.toNumber(row.lng),
      customStatus,
      statusLabel,
      checkedInCourtId: row.checkedInCourtId ?? row.checked_in_court_id ?? null,
      checkedInCourtName,
      isCurrentUser: !!currentUserId && row.id?.toString() === currentUserId,
    };
  }

  private async ensureMapHubSchema() {
    if (this.schemaReady) return;
    if (this.postgres) {
      await this.dataSource.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_config JSONB DEFAULT '{}'::jsonb`,
      );
      await this.dataSource.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS accepting_challenges BOOLEAN DEFAULT TRUE`,
      );
      await this.dataSource.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS loc_enabled BOOLEAN DEFAULT FALSE`,
      );
      await this.dataSource.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION`,
      );
      await this.dataSource.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION`,
      );
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS user_privacy (
          user_id VARCHAR(255) PRIMARY KEY,
          push_enabled BOOLEAN DEFAULT TRUE,
          public_profile BOOLEAN DEFAULT TRUE,
          public_location BOOLEAN DEFAULT FALSE,
          map_visibility_enabled BOOLEAN DEFAULT FALSE,
          discover_radius_mi NUMERIC(5,1) DEFAULT 25.0,
          discover_mode TEXT DEFAULT 'open',
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await this.dataSource.query(
        `ALTER TABLE user_privacy ADD COLUMN IF NOT EXISTS map_visibility_enabled BOOLEAN DEFAULT FALSE`,
      );
      await this.dataSource.query(
        `ALTER TABLE user_privacy ADD COLUMN IF NOT EXISTS discover_radius_mi NUMERIC(5,1) DEFAULT 25.0`,
      );
      await this.dataSource.query(
        `ALTER TABLE user_privacy ADD COLUMN IF NOT EXISTS discover_mode TEXT DEFAULT 'open'`,
      );
      await this.dataSource.query(
        `ALTER TABLE user_privacy ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
      );
      await this.dataSource.query(
        `CREATE INDEX IF NOT EXISTS idx_users_map_lat_lng ON users (lat, lng)`,
      );
      await this.dataSource.query(
        `CREATE INDEX IF NOT EXISTS idx_user_privacy_map_visibility ON user_privacy (map_visibility_enabled, public_location)`,
      );
      this.schemaReady = true;
      return;
    }

    await this.dataSource.query(`CREATE TABLE IF NOT EXISTS user_privacy (
      user_id TEXT PRIMARY KEY,
      push_enabled INTEGER DEFAULT 1,
      public_profile INTEGER DEFAULT 1,
      public_location INTEGER DEFAULT 0,
      map_visibility_enabled INTEGER DEFAULT 0,
      discover_radius_mi REAL DEFAULT 25.0,
      discover_mode TEXT DEFAULT 'open',
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    await this.safeSqliteAlter(
      `ALTER TABLE users ADD COLUMN avatar_config TEXT`,
    );
    await this.safeSqliteAlter(
      `ALTER TABLE users ADD COLUMN accepting_challenges INTEGER DEFAULT 1`,
    );
    await this.safeSqliteAlter(
      `ALTER TABLE users ADD COLUMN loc_enabled INTEGER DEFAULT 0`,
    );
    await this.safeSqliteAlter(`ALTER TABLE users ADD COLUMN lat REAL`);
    await this.safeSqliteAlter(`ALTER TABLE users ADD COLUMN lng REAL`);
    this.schemaReady = true;
  }

  private async ensurePrivacyRow(userId: string) {
    await this.ensureMapHubSchema();
    if (this.postgres) {
      await this.dataSource.query(
        `
        INSERT INTO user_privacy (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
        `,
        [userId],
      );
      return;
    }
    await this.dataSource.query(
      `INSERT OR IGNORE INTO user_privacy (user_id) VALUES (?)`,
      [userId],
    );
  }

  private defaultPrivacy() {
    return {
      pushEnabled: true,
      publicProfile: true,
      publicLocation: false,
      mapVisibilityEnabled: false,
      discoverRadiusMi: 25.0,
      discoverMode: "open",
    };
  }

  private normalizePrivacy(row: any) {
    const defaults = this.defaultPrivacy();
    if (!row) return defaults;
    return {
      pushEnabled: this.toBool(
        row.pushEnabled ?? row.push_enabled,
        defaults.pushEnabled,
      ),
      publicProfile: this.toBool(
        row.publicProfile ?? row.public_profile,
        defaults.publicProfile,
      ),
      publicLocation: this.toBool(
        row.publicLocation ?? row.public_location,
        defaults.publicLocation,
      ),
      mapVisibilityEnabled: this.toBool(
        row.mapVisibilityEnabled ?? row.map_visibility_enabled,
        defaults.mapVisibilityEnabled,
      ),
      discoverRadiusMi: this.toNumber(
        row.discoverRadiusMi ?? row.discover_radius_mi,
        defaults.discoverRadiusMi,
      ),
      discoverMode:
        row.discoverMode ?? row.discover_mode ?? defaults.discoverMode,
      updatedAt: row.updatedAt ?? row.updated_at,
    };
  }

  private hasCenter(
    args: MapHubArgs,
  ): args is MapHubArgs & { lat: number; lng: number } {
    return Number.isFinite(args.lat) && Number.isFinite(args.lng);
  }

  private hasBounds(args: MapHubArgs): boolean {
    return [args.minLat, args.maxLat, args.minLng, args.maxLng].every(
      Number.isFinite,
    );
  }

  private milesToMeters(miles?: number) {
    return this.clampRadius(miles ?? 25) * 1609.344;
  }

  private clampRadius(radiusMiles: number) {
    if (!Number.isFinite(radiusMiles)) return 25;
    return Math.min(Math.max(radiusMiles, 1), 100);
  }

  private toNumber(value: any, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private toInt(value: any, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private toBool(value: any, fallback = false) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string")
      return ["true", "1", "yes"].includes(value.toLowerCase());
    return fallback;
  }

  private parseJson(value: any) {
    if (!value) return null;
    if (typeof value === "object") return value;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private async safeSqliteAlter(sql: string) {
    try {
      await this.dataSource.query(sql);
    } catch (_) {
      // SQLite has no ADD COLUMN IF NOT EXISTS; duplicate-column errors are safe here.
    }
  }
}

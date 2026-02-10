// src/server.ts
import "dotenv/config";
import express from "express";
import type { ErrorRequestHandler } from "express";
import cors from "cors";
import morgan from "morgan";
import { Pool, PoolClient } from "pg";
import { z } from "zod";
import { randomUUID, randomBytes } from "node:crypto";
import { finalizeAndRateMatch, getUserRating, getUserRankHistory, revertMatchRating } from "./rating.js";
import { lookupZipCode, formatCityState } from "./services/zipLookup.js";
import teamsRoutes from "./routes/teams.js";

const PORT = Number(process.env.PORT || 4000);
const DEV_CORS_OPEN = process.env.DEV_CORS_OPEN === "true";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@db:5432/hooprank";
const IS_DEV = process.env.NODE_ENV !== "production";
const ADMIN_KEY = process.env.ADMIN_KEY ?? (IS_DEV ? "dev-admin-key" : "");

// Firebase Admin SDK - optional, will be initialized if credentials are provided
let firebaseAdmin: any = null;
let firebaseInitialized = false;
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;

async function initializeFirebase() {
  if (!FIREBASE_SERVICE_ACCOUNT) {
    console.warn("FIREBASE_SERVICE_ACCOUNT not set - push notifications disabled");
    return;
  }

  try {
    // Dynamic import to avoid build issues when firebase-admin is not available
    const admin = await import("firebase-admin");
    const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount),
    });
    firebaseAdmin = admin.default;
    firebaseInitialized = true;
    console.log("Firebase Admin SDK initialized successfully");
  } catch (e) {
    console.warn("Firebase Admin SDK not available - push notifications disabled:", e);
  }
}

// Initialize Firebase asynchronously
initializeFirebase();

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Push notification helper
async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  if (!firebaseInitialized || !firebaseAdmin) {
    console.log("Push notification skipped (Firebase not initialized):", { userId, title });
    return false;
  }

  try {
    // Get user's FCM token
    const result = await pool.query(
      `SELECT fcm_token FROM users WHERE id = $1 AND fcm_token IS NOT NULL`,
      [userId]
    );

    if (result.rowCount === 0 || !result.rows[0].fcm_token) {
      console.log("No FCM token for user:", userId);
      return false;
    }

    const token = result.rows[0].fcm_token;

    await firebaseAdmin.messaging().send({
      token,
      notification: { title, body },
      data: data || {},
      android: {
        priority: "high",
        notification: {
          sound: "default",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
    });

    console.log("Push notification sent:", { userId, title });
    return true;
  } catch (e: any) {
    // Handle invalid token
    if (e.code === "messaging/invalid-registration-token" ||
      e.code === "messaging/registration-token-not-registered") {
      // Clear invalid token
      await pool.query(`UPDATE users SET fcm_token = NULL WHERE id = $1`, [userId]);
      console.log("Cleared invalid FCM token for user:", userId);
    } else {
      console.error("Push notification error:", e);
    }
    return false;
  }
}

const app = express();

/* =========================
 * CORS
 * =======================*/
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/postman
      if (/^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
      if (DEV_CORS_OPEN && /^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)\d+\.\d+:\d+$/.test(origin)) {
        return cb(null, true);
      }
      return cb(new Error("CORS blocked for origin: " + origin));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "x-user-id"],
  })
);
app.use(express.json({ limit: '10mb' })); // Increased limit for base64 images
app.use(morgan("dev"));

// Request timing middleware - logs slow requests for performance monitoring
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 500) {
      console.warn(`⚠️ Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  next();
});


// ================================
// Health Check Endpoint (for Railway/production monitoring)
// ================================
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ================================
// Image Upload Endpoint
// ================================
app.post("/upload", async (req, res) => {
  try {
    const uid = getUserId(req);
    const { type, targetId, imageData } = req.body;

    if (!type || !targetId || !imageData) {
      return res.status(400).json({ error: "Missing type, targetId, or imageData" });
    }

    if (type === 'profile') {
      // Update user avatar
      await pool.query("UPDATE users SET avatar_url = $2 WHERE id = $1", [targetId, imageData]);
      console.log(`Updated avatar for user ${targetId}`);
    } else if (type === 'team') {
      // Verify user owns or is member of the team
      const { rows } = await pool.query(
        `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2
         UNION
         SELECT 1 FROM teams WHERE id = $1 AND owner_id = $2`,
        [targetId, uid]
      );
      if (rows.length === 0) {
        return res.status(403).json({ error: "Not a member or owner of this team" });
      }
      await pool.query("UPDATE teams SET logo_url = $2 WHERE id = $1", [targetId, imageData]);
      console.log(`Updated logo for team ${targetId}`);
    } else {
      return res.status(400).json({ error: "Invalid type. Use 'profile' or 'team'" });
    }

    res.json({ success: true });
  } catch (e: any) {
    console.error("Upload error:", e);
    res.status(500).json({ error: e.message || "Upload failed" });
  }
});

// Mount team routes
app.use(teamsRoutes);

function getUserId(req: express.Request): string {
  const uid = req.header("x-user-id");
  if (!uid) {
    // Only allow fallback in development mode
    if (IS_DEV) {
      return "00000000-0000-0000-0000-000000000001";
    }
    throw Object.assign(new Error("unauthorized"), { http: 401 });
  }
  return uid;
}






type Handler = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => Promise<any> | any;

const asyncH =
  (fn: Handler): Handler =>
    (req, res, next) =>
      Promise.resolve(fn(req, res, next)).catch(next);

// POST /auth/dev (development only)
const DevAuthSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});

app.post(
  "/auth/dev",
  asyncH(async (req, res) => {
    if (!IS_DEV) {
      return res.status(403).json({ error: "dev_auth_disabled" });
    }
    const body = DevAuthSchema.parse(req.body);
    const { id, name } = body;

    // Upsert user
    await pool.query(
      `insert into users (id, name, email, username, loc_enabled)
       values ($1, $2, $3, $4, true)
       on conflict (id) do update set name = excluded.name`,
      [id, name, `dev_${id.substring(0, 8)}@hooprank.dev`, `dev_${id.substring(0, 8)}`]
    );

    // Ensure privacy settings
    await pool.query(
      `insert into user_privacy (user_id) values ($1) on conflict (user_id) do nothing`,
      [id]
    );

    // Fetch user
    const r = await pool.query(`select * from users where id = $1`, [id]);
    const u = r.rows[0];

    res.json({
      id: u.id,
      name: u.name,
      photoUrl: u.avatar_url,
      rating: Number(u.hoop_rank),
      position: u.position,
      matchesPlayed: 0, // TODO: count matches
    });
  })
);

// POST /users/auth
app.post(
  "/users/auth",
  asyncH(async (req, res) => {
    const { id, email, name, photoUrl, provider } = req.body;
    const authHeader = req.headers.authorization;
    const authToken = authHeader ? authHeader.split(' ')[1] : null;

    if (!id) {
      return res.status(400).json({ error: "missing_id" });
    }

    // Upsert user
    await pool.query(
      `insert into users (id, name, email, username, avatar_url, loc_enabled, auth_token, auth_provider)
       values ($1, $2, $3, $4, $5, true, $6, $7)
       on conflict (id) do update set 
         name = coalesce(excluded.name, users.name),
         email = coalesce(excluded.email, users.email),
         avatar_url = coalesce(excluded.avatar_url, users.avatar_url),
         auth_token = excluded.auth_token,
         auth_provider = excluded.auth_provider,
         updated_at = now()`,
      [
        id,
        name || 'New User',
        email || null,
        `user_${id.substring(0, 8)}`, // Default username
        photoUrl || null,
        authToken,
        provider || 'unknown'
      ]
    );

    // Ensure privacy settings
    await pool.query(
      `insert into user_privacy (user_id) values ($1) on conflict (user_id) do nothing`,
      [id]
    );

    // Fetch user
    const r = await pool.query(`select * from users where id = $1`, [id]);
    const u = r.rows[0];

    res.json({
      id: u.id,
      name: u.name,
      photoUrl: u.avatar_url,
      rating: Number(u.hoop_rank),
      position: u.position,
      matchesPlayed: 0,
    });
  })
);

// GET /users/nearby - List users within radius miles (MUST be before /users/:userId to avoid shadowing)
const NearbyUsersQuery = z.object({
  radiusMiles: z.coerce.number().min(1).max(100).default(25),
});

app.get(
  "/users/nearby",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const { radiusMiles } = NearbyUsersQuery.parse(req.query);

    // Get current user's location
    const userResult = await pool.query(
      `SELECT lat, lng FROM users WHERE id = $1`,
      [uid]
    );

    if (userResult.rowCount === 0 || !userResult.rows[0].lat || !userResult.rows[0].lng) {
      console.log(`[nearby] User ${uid} has no lat/lng, returning empty`);
      return res.json([]); // No location available
    }

    const { lat, lng } = userResult.rows[0];
    const radiusMeters = radiusMiles * 1609.34;
    console.log(`[nearby] User ${uid} at lat=${lat}, lng=${lng}, radius=${radiusMeters}m`);

    const r = await pool.query(`
      SELECT id, name, avatar_url, hoop_rank, city, position, lat, lng, games_played, games_contested, birthdate
      FROM users
      WHERE id != $1
        AND lat IS NOT NULL
        AND lng IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
          $4
        )
      ORDER BY hoop_rank DESC
      LIMIT 100
    `, [uid, lat, lng, radiusMeters]);

    console.log(`[nearby] Found ${r.rows.length} nearby users:`, r.rows.map(u => `${u.name} at ${u.lat},${u.lng}`));

    const users = r.rows.map(row => {
      const gamesPlayed = row.games_played || 0;
      const gamesContested = row.games_contested || 0;
      const contestRate = gamesPlayed > 0 ? gamesContested / gamesPlayed : 0;

      // Calculate age from birthdate
      let age: number | null = null;
      if (row.birthdate) {
        const birthdate = new Date(row.birthdate);
        const today = new Date();
        age = today.getFullYear() - birthdate.getFullYear();
        const monthDiff = today.getMonth() - birthdate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
          age--;
        }
      }

      return {
        id: row.id,
        name: row.name,
        photoUrl: row.avatar_url,
        rating: row.hoop_rank ?? 3.0,
        city: row.city,
        position: row.position,
        gamesPlayed,
        gamesContested,
        contestRate,
        age,
      };
    });

    res.json(users);
  })
);

// GET /users/me - Get current user's data (MUST be before /users/:userId)
app.get(
  "/users/me",
  asyncH(async (req, res) => {
    const userId = getUserId(req);

    // Single optimized query combining user data + match stats
    const r = await pool.query(`
      SELECT u.*,
        COUNT(m.id) FILTER (WHERE m.result IS NOT NULL) as matches_played,
        COUNT(m.id) FILTER (WHERE m.result IS NOT NULL AND (m.result->>'winner') = $1) as wins
      FROM users u
      LEFT JOIN matches m ON (m.creator_id = $1 OR m.opponent_id = $1)
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "user_not_found" });
    }
    const u = r.rows[0];
    const matchesPlayed = parseInt(u.matches_played || '0');
    const wins = parseInt(u.wins || '0');
    const losses = matchesPlayed - wins;

    // Get user's most recently joined team (either as member or owner)
    const teamResult = await pool.query(`
      SELECT name FROM (
        SELECT t.name, COALESCE(tm.joined_at, t.created_at) as sort_date
        FROM teams t
        JOIN team_members tm ON tm.team_id = t.id
        WHERE tm.user_id = $1 AND tm.status = 'accepted'
        UNION
        SELECT t.name, t.created_at as sort_date
        FROM teams t
        WHERE t.owner_id = $1
      ) subq
      ORDER BY sort_date DESC NULLS LAST
      LIMIT 1
    `, [userId]);
    const teamName = teamResult.rows[0]?.name || null;

    res.json({
      id: u.id,
      name: u.name,
      photoUrl: u.avatar_url,
      rating: Number(u.hoop_rank),
      position: u.position,
      height: u.height,
      weight: u.weight,
      city: u.city,
      zip: u.zip,
      team: teamName,
      matchesPlayed,
      wins,
      losses,
    });
  })
);

app.get(
  "/users/:userId",
  asyncH(async (req, res) => {
    const { userId } = req.params;

    // Single optimized query combining user data + match stats
    const r = await pool.query(`
      SELECT u.*,
        COUNT(m.id) FILTER (WHERE m.result IS NOT NULL) as matches_played,
        COUNT(m.id) FILTER (WHERE m.result IS NOT NULL AND (m.result->>'winner') = $1) as wins
      FROM users u
      LEFT JOIN matches m ON (m.creator_id = $1 OR m.opponent_id = $1)
      WHERE u.id = $1
      GROUP BY u.id
    `, [userId]);

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "user_not_found" });
    }
    const u = r.rows[0];
    const matchesPlayed = parseInt(u.matches_played || '0');
    const wins = parseInt(u.wins || '0');
    const losses = matchesPlayed - wins;

    // Get user's most recently joined team (either as member or owner)
    const teamResult = await pool.query(`
      SELECT name FROM (
        SELECT t.name, COALESCE(tm.joined_at, t.created_at) as sort_date
        FROM teams t
        JOIN team_members tm ON tm.team_id = t.id
        WHERE tm.user_id = $1 AND tm.status = 'accepted'
        UNION
        SELECT t.name, t.created_at as sort_date
        FROM teams t
        WHERE t.owner_id = $1
      ) subq
      ORDER BY sort_date DESC NULLS LAST
      LIMIT 1
    `, [userId]);
    const teamName = teamResult.rows[0]?.name || null;

    res.json({
      id: u.id,
      name: u.name,
      photoUrl: u.avatar_url,
      rating: Number(u.hoop_rank),
      position: u.position,
      height: u.height,
      weight: u.weight,
      city: u.city,
      zip: u.zip,
      team: teamName,
      matchesPlayed,
      wins,
      losses,
    });
  })
);


// POST /users/:userId/fcm-token - Register FCM token for push notifications
app.post(
  "/users/:userId/fcm-token",
  asyncH(async (req, res) => {
    const { userId } = req.params;
    const authUser = getUserId(req);

    if (userId !== authUser) {
      return res.status(403).json({ error: "forbidden" });
    }

    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "token_required" });
    }

    await pool.query(
      `UPDATE users SET fcm_token = $1 WHERE id = $2`,
      [token, userId]
    );

    console.log("FCM token registered for user:", userId);
    res.json({ success: true });
  })
);

// POST /users/:userId/profile
app.post(
  "/users/:userId/profile",
  asyncH(async (req, res) => {
    const { userId } = req.params;
    const { name, position, height, weight, zip, lat, lng, locEnabled, age, birthdate } = req.body;

    // Verify user exists
    const check = await pool.query(`select 1 from users where id = $1`, [userId]);
    if (check.rowCount === 0) {
      return res.status(404).json({ error: "user_not_found" });
    }

    // Lookup city and coordinates from zip code if zip is provided
    // ZIP coordinates are preferred over GPS because they represent the user's actual home location
    // (GPS from emulators/devices often gives wrong location like Google HQ)
    let city: string | null = null;
    let zipLat: number | null = null;
    let zipLng: number | null = null;
    if (zip) {
      const zipResult = await lookupZipCode(zip);
      if (zipResult) {
        city = formatCityState(zipResult.city, zipResult.stateAbbr);
        // Always use ZIP coordinates for location-based features
        zipLat = zipResult.lat;
        zipLng = zipResult.lng;
        console.log(`[profile] ZIP ${zip} resolved to ${city} at ${zipLat},${zipLng}`);
      }
    }
    // Fall back to GPS if no zip provided
    if (!zipLat && !zipLng && lat && lng) {
      zipLat = lat;
      zipLng = lng;
    }

    // Update user - now includes name, city, lat/lng from zip lookup, and birthdate
    await pool.query(
      `update users set 
       name = coalesce($2, name),
       position = coalesce($3, position),
       height = coalesce($4, height),
       weight = coalesce($5, weight),
       zip = coalesce($6, zip),
       city = coalesce($10, city),
       lat = coalesce($11, lat),
       lng = coalesce($12, lng),
       birthdate = coalesce($13, birthdate),
       last_loc = case when $7::numeric is not null and $8::numeric is not null 
                  then ST_SetSRID(ST_MakePoint($8::numeric, $7::numeric), 4326) 
                  else last_loc end,
       last_loc_at = case when $7::numeric is not null and $8::numeric is not null 
                     then now() 
                     else last_loc_at end,
       loc_enabled = coalesce($9, loc_enabled),
       updated_at = now()
       where id = $1`,
      [
        userId,
        name,
        position,
        height,
        weight ? parseInt(weight) : null,
        zip,
        zipLat,
        zipLng,
        locEnabled,
        city,
        zipLat,
        zipLng,
        birthdate || null
      ]
    );

    res.json({ success: true, city, lat: zipLat, lng: zipLng });
  })
);

/* =========================
 * Privacy
 * =======================*/
const PrivacySchema = z.object({
  pushEnabled: z.boolean(),
  publicProfile: z.boolean(),
  publicLocation: z.boolean(),
  discoverRadiusMi: z.number().min(0.25).max(25),
  discoverMode: z.enum(["open", "similar"]),
  discoverWindow: z.number().min(0.1).max(1.5).optional(),
  discoverMinReputation: z.number().min(0).max(5).optional(),
});

app.get(
  "/me/privacy",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const q = `
      select
        push_enabled as "pushEnabled",
      public_profile as "publicProfile",
      public_location as "publicLocation",
      discover_radius_mi as "discoverRadiusMi",
      discover_mode as "discoverMode",
      discover_window as "discoverWindow",
      discover_min_reputation as "discoverMinReputation"
      from user_privacy where user_id = $1
      `;
    const r = await pool.query(q, [uid]);
    if (r.rowCount === 0) {
      await pool.query(`insert into user_privacy(user_id) values($1) on conflict do nothing`, [uid]);
      const r2 = await pool.query(q, [uid]);
      return res.json(r2.rows[0]);
    }
    res.json(r.rows[0]);
  })
);

app.put(
  "/me/privacy",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const parsed = PrivacySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const p = parsed.data;

    await pool.query(
      `
      insert into user_privacy
      (user_id, push_enabled, public_profile, public_location, discover_radius_mi, discover_mode, discover_window, discover_min_reputation)
    values($1, $2, $3, $4, $5, $6, coalesce($7:: numeric, 0.5), coalesce($8:: numeric, 0))
      on conflict(user_id) do update set
        push_enabled = $2, public_profile = $3, public_location = $4, discover_radius_mi = $5,
      discover_mode = $6, discover_window = coalesce($7, 0.5), discover_min_reputation = coalesce($8, 0)
        `,
      [
        uid,
        p.pushEnabled,
        p.publicProfile,
        p.publicLocation,
        p.discoverRadiusMi,
        p.discoverMode,
        p.discoverWindow,
        p.discoverMinReputation,
      ]
    );

    const out = await pool.query(
      `
      select push_enabled as "pushEnabled", public_profile as "publicProfile",
      public_location as "publicLocation", discover_radius_mi as "discoverRadiusMi",
      discover_mode as "discoverMode", discover_window as "discoverWindow",
      discover_min_reputation as "discoverMinReputation"
      from user_privacy where user_id = $1
      `,
      [uid]
    );
    res.json(out.rows[0]);
  })
);

/* =========================
 * User Follows (Courts & Players)
 * =======================*/

// GET /users/me/follows - Get all follows (courts + players)
app.get(
  "/users/me/follows",
  asyncH(async (req, res) => {
    const uid = getUserId(req);

    // Get followed courts
    const courtsResult = await pool.query(
      `SELECT court_id, alerts_enabled, created_at 
       FROM user_followed_courts 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [uid]
    );

    // Get followed players
    const playersResult = await pool.query(
      `SELECT player_id, created_at 
       FROM user_followed_players 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [uid]
    );

    // Get followed teams
    const teamsResult = await pool.query(
      `SELECT ft.team_id, t.name as team_name, t.team_type, t.logo_url, ft.created_at 
       FROM user_followed_teams ft
       LEFT JOIN teams t ON t.id = ft.team_id
       WHERE ft.user_id = $1 
       ORDER BY ft.created_at DESC`,
      [uid]
    );

    res.json({
      courts: courtsResult.rows.map(r => ({
        courtId: r.court_id,
        alertsEnabled: r.alerts_enabled,
        createdAt: r.created_at,
      })),
      players: playersResult.rows.map(r => ({
        playerId: r.player_id,
        createdAt: r.created_at,
      })),
      teams: teamsResult.rows.map(r => ({
        teamId: r.team_id,
        teamName: r.team_name,
        teamType: r.team_type,
        logoUrl: r.logo_url,
        createdAt: r.created_at,
      })),
    });
  })
);

// POST /users/me/follows/courts - Follow a court
app.post(
  "/users/me/follows/courts",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const { courtId, alertsEnabled } = req.body;

    if (!courtId) {
      return res.status(400).json({ error: "courtId required" });
    }

    await pool.query(
      `INSERT INTO user_followed_courts (user_id, court_id, alerts_enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, court_id) DO UPDATE SET alerts_enabled = $3`,
      [uid, courtId, alertsEnabled ?? false]
    );

    res.json({ success: true });
  })
);

// DELETE /users/me/follows/courts/:courtId - Unfollow a court
app.delete(
  "/users/me/follows/courts/:courtId",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const { courtId } = req.params;

    await pool.query(
      `DELETE FROM user_followed_courts WHERE user_id = $1 AND court_id = $2`,
      [uid, courtId]
    );

    res.json({ success: true });
  })
);

// PUT /users/me/follows/courts/:courtId/alerts - Toggle court alerts
app.put(
  "/users/me/follows/courts/:courtId/alerts",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const { courtId } = req.params;
    const { enabled } = req.body;

    await pool.query(
      `UPDATE user_followed_courts SET alerts_enabled = $3 WHERE user_id = $1 AND court_id = $2`,
      [uid, courtId, enabled ?? false]
    );

    res.json({ success: true });
  })
);

// POST /users/me/follows/players - Follow a player
app.post(
  "/users/me/follows/players",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({ error: "playerId required" });
    }

    // Don't allow following yourself
    if (playerId === uid) {
      return res.status(400).json({ error: "cannot_follow_self" });
    }

    await pool.query(
      `INSERT INTO user_followed_players (user_id, player_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, player_id) DO NOTHING`,
      [uid, playerId]
    );

    res.json({ success: true });
  })
);

// DELETE /users/me/follows/players/:playerId - Unfollow a player
app.delete(
  "/users/me/follows/players/:playerId",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const { playerId } = req.params;

    await pool.query(
      `DELETE FROM user_followed_players WHERE user_id = $1 AND player_id = $2`,
      [uid, playerId]
    );

    res.json({ success: true });
  })
);

// POST /users/me/follows/teams - Follow a team
app.post(
  "/users/me/follows/teams",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const { teamId } = req.body;

    if (!teamId) {
      return res.status(400).json({ error: "teamId required" });
    }

    await pool.query(
      `INSERT INTO user_followed_teams (user_id, team_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, team_id) DO NOTHING`,
      [uid, teamId]
    );

    res.json({ success: true });
  })
);

// DELETE /users/me/follows/teams/:teamId - Unfollow a team
app.delete(
  "/users/me/follows/teams/:teamId",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const { teamId } = req.params;

    await pool.query(
      `DELETE FROM user_followed_teams WHERE user_id = $1 AND team_id = $2`,
      [uid, teamId]
    );

    res.json({ success: true });
  })
);


/* =========================
 * Scheduled Runs (Court-based pickup games)
 * =======================*/

// GET /courts/:courtId/runs - Get upcoming runs at a specific court
app.get(
  "/courts/:courtId/runs",
  asyncH(async (req, res) => {
    const { courtId } = req.params;
    const uid = getUserId(req);

    const result = await pool.query(`
      SELECT 
        sr.id,
        sr.court_id,
        sr.created_by,
        u.name as creator_name,
        u.avatar_url as creator_photo_url,
        sr.title,
        sr.game_mode,
        sr.scheduled_at,
        sr.duration_minutes,
        sr.max_players,
        sr.notes,
        sr.created_at,
        (SELECT COUNT(*) FROM scheduled_run_attendees WHERE run_id = sr.id AND status = 'going') as attendee_count,
        EXISTS(SELECT 1 FROM scheduled_run_attendees WHERE run_id = sr.id AND user_id = $2 AND status = 'going') as is_attending
      FROM scheduled_runs sr
      JOIN users u ON u.id = sr.created_by
      WHERE sr.court_id = $1 AND sr.scheduled_at > NOW()
      ORDER BY sr.scheduled_at ASC
      LIMIT 20
    `, [courtId, uid]);

    // Get attendees for each run
    const runs = await Promise.all(result.rows.map(async (run) => {
      const attendeesResult = await pool.query(`
        SELECT u.id, u.name, u.avatar_url
        FROM scheduled_run_attendees sra
        JOIN users u ON u.id = sra.user_id
        WHERE sra.run_id = $1 AND sra.status = 'going'
        ORDER BY sra.joined_at ASC
        LIMIT 10
      `, [run.id]);

      return {
        id: run.id,
        courtId: run.court_id,
        createdBy: run.created_by,
        creatorName: run.creator_name,
        creatorPhotoUrl: run.creator_photo_url,
        title: run.title,
        gameMode: run.game_mode,
        scheduledAt: run.scheduled_at,
        durationMinutes: run.duration_minutes,
        maxPlayers: run.max_players,
        notes: run.notes,
        createdAt: run.created_at,
        attendeeCount: parseInt(run.attendee_count || '0'),
        isAttending: run.is_attending,
        attendees: attendeesResult.rows.map(a => ({
          id: a.id,
          name: a.name,
          photoUrl: a.avatar_url,
        })),
      };
    }));

    res.json(runs);
  })
);

// GET /runs/nearby - Get runs near user's location (for discoverability)
app.get(
  "/runs/nearby",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const radiusMiles = parseFloat(req.query.radiusMiles as string) || 25;
    const radiusMeters = radiusMiles * 1609.34;

    // Get current user's location
    const userResult = await pool.query(
      `SELECT lat, lng FROM users WHERE id = $1`,
      [uid]
    );

    if (userResult.rowCount === 0 || !userResult.rows[0].lat || !userResult.rows[0].lng) {
      return res.json([]); // No location available
    }

    const { lat, lng } = userResult.rows[0];

    const result = await pool.query(`
      SELECT 
        sr.id,
        sr.court_id,
        c.name as court_name,
        c.city as court_city,
        ST_X(c.geog::geometry) as court_lng,
        ST_Y(c.geog::geometry) as court_lat,
        sr.created_by,
        u.name as creator_name,
        u.avatar_url as creator_photo_url,
        sr.title,
        sr.game_mode,
        sr.scheduled_at,
        sr.duration_minutes,
        sr.max_players,
        (SELECT COUNT(*) FROM scheduled_run_attendees WHERE run_id = sr.id AND status = 'going') as attendee_count,
        EXISTS(SELECT 1 FROM scheduled_run_attendees WHERE run_id = sr.id AND user_id = $1 AND status = 'going') as is_attending
      FROM scheduled_runs sr
      JOIN courts c ON c.id = sr.court_id
      JOIN users u ON u.id = sr.created_by
      WHERE sr.scheduled_at > NOW()
        AND ST_DWithin(c.geog, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, $4)
      ORDER BY sr.scheduled_at ASC
      LIMIT 50
    `, [uid, lat, lng, radiusMeters]);

    res.json(result.rows.map(run => ({
      id: run.id,
      courtId: run.court_id,
      courtName: run.court_name,
      courtCity: run.court_city,
      courtLat: run.court_lat,
      courtLng: run.court_lng,
      createdBy: run.created_by,
      creatorName: run.creator_name,
      creatorPhotoUrl: run.creator_photo_url,
      title: run.title,
      gameMode: run.game_mode,
      scheduledAt: run.scheduled_at,
      durationMinutes: run.duration_minutes,
      maxPlayers: run.max_players,
      attendeeCount: parseInt(run.attendee_count || '0'),
      isAttending: run.is_attending,
    })));
  })
);

// GET /runs/courts-with-runs - Get court IDs that have upcoming runs (for filter)
app.get(
  "/runs/courts-with-runs",
  asyncH(async (req, res) => {
    const today = req.query.today === 'true';

    let whereClause = 'WHERE scheduled_at > NOW()';
    if (today) {
      // Filter for runs happening today (between now and end of day)
      whereClause = `WHERE scheduled_at > NOW() AND scheduled_at < (CURRENT_DATE + INTERVAL '1 day')`;
    }

    const result = await pool.query(`
      SELECT DISTINCT court_id, COUNT(*) as run_count
      FROM scheduled_runs
      ${whereClause}
      GROUP BY court_id
    `);

    res.json(result.rows.map(r => ({
      courtId: r.court_id,
      runCount: parseInt(r.run_count),
    })));
  })
);

// POST /runs - Create a new scheduled run
const CreateRunSchema = z.object({
  courtId: z.string().uuid(),
  title: z.string().max(100).optional(),
  gameMode: z.enum(["1v1", "3v3", "5v5"]).default("5v5"),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(30).max(480).default(120),
  maxPlayers: z.number().int().min(2).max(30).default(10),
  notes: z.string().max(500).optional(),
});

app.post(
  "/runs",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const parsed = CreateRunSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const data = parsed.data;

    // Create the run
    const result = await pool.query(`
      INSERT INTO scheduled_runs (court_id, created_by, title, game_mode, scheduled_at, duration_minutes, max_players, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [data.courtId, uid, data.title, data.gameMode, data.scheduledAt, data.durationMinutes, data.maxPlayers, data.notes]);

    const runId = result.rows[0].id;

    // Auto-join creator as first attendee
    await pool.query(`
      INSERT INTO scheduled_run_attendees (run_id, user_id, status)
      VALUES ($1, $2, 'going')
    `, [runId, uid]);

    // Notify followers of this court
    const followersResult = await pool.query(`
      SELECT user_id FROM user_followed_courts 
      WHERE court_id = $1 AND alerts_enabled = true AND user_id != $2
    `, [data.courtId, uid]);

    const courtResult = await pool.query(`SELECT name FROM courts WHERE id = $1`, [data.courtId]);
    const courtName = courtResult.rows[0]?.name || 'a court';

    // Send push notifications to followers
    for (const follower of followersResult.rows) {
      sendPushNotification(
        follower.user_id,
        "New Run Scheduled 🏀",
        `A ${data.gameMode} run was scheduled at ${courtName}`,
        { type: "run_created", runId, courtId: data.courtId }
      );
    }

    res.json({ id: runId, success: true });
  })
);

// POST /runs/:runId/join - Join a scheduled run
app.post(
  "/runs/:runId/join",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const { runId } = req.params;
    const status = req.body.status || 'going';

    // Check if run exists and is in the future
    const runCheck = await pool.query(`
      SELECT id, max_players, created_by FROM scheduled_runs WHERE id = $1 AND scheduled_at > NOW()
    `, [runId]);

    if (runCheck.rowCount === 0) {
      return res.status(404).json({ error: "run_not_found_or_past" });
    }

    // Check current attendee count
    const countResult = await pool.query(`
      SELECT COUNT(*) as count FROM scheduled_run_attendees WHERE run_id = $1 AND status = 'going'
    `, [runId]);

    const currentCount = parseInt(countResult.rows[0].count);
    if (status === 'going' && currentCount >= runCheck.rows[0].max_players) {
      return res.status(400).json({ error: "run_full" });
    }

    // Upsert attendance
    await pool.query(`
      INSERT INTO scheduled_run_attendees (run_id, user_id, status)
      VALUES ($1, $2, $3)
      ON CONFLICT (run_id, user_id) DO UPDATE SET status = $3, joined_at = NOW()
    `, [runId, uid, status]);

    // Notify creator if someone new joins
    if (status === 'going' && runCheck.rows[0].created_by !== uid) {
      const userResult = await pool.query(`SELECT name FROM users WHERE id = $1`, [uid]);
      const userName = userResult.rows[0]?.name || 'Someone';

      sendPushNotification(
        runCheck.rows[0].created_by,
        "New Player Joined! 🙌",
        `${userName} joined your scheduled run`,
        { type: "run_joined", runId }
      );
    }

    res.json({ success: true });
  })
);

// DELETE /runs/:runId/leave - Leave a scheduled run
app.delete(
  "/runs/:runId/leave",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const { runId } = req.params;

    await pool.query(`
      DELETE FROM scheduled_run_attendees WHERE run_id = $1 AND user_id = $2
    `, [runId, uid]);

    res.json({ success: true });
  })
);

// DELETE /runs/:runId - Cancel a run (creator only)
app.delete(
  "/runs/:runId",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const { runId } = req.params;

    // Verify ownership
    const check = await pool.query(`SELECT id FROM scheduled_runs WHERE id = $1 AND created_by = $2`, [runId, uid]);
    if (check.rowCount === 0) {
      return res.status(403).json({ error: "not_owner_or_not_found" });
    }

    // Notify all attendees before deletion
    const attendeesResult = await pool.query(`
      SELECT user_id FROM scheduled_run_attendees WHERE run_id = $1 AND user_id != $2
    `, [runId, uid]);

    for (const attendee of attendeesResult.rows) {
      sendPushNotification(
        attendee.user_id,
        "Run Cancelled",
        "A scheduled run you were attending has been cancelled",
        { type: "run_cancelled", runId }
      );
    }

    // Delete (cascades to attendees)
    await pool.query(`DELETE FROM scheduled_runs WHERE id = $1`, [runId]);

    res.json({ success: true });
  })
);

/* =========================
 * Rankings (with mode filter)
 * =======================*/
const RankingsQuery = z.object({
  mode: z.enum(["1v1", "3v3", "5v5"]).default("1v1"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  ageGroup: z.string().optional(),
  gender: z.string().optional(),
});

app.get(
  "/rankings",
  asyncH(async (req, res) => {
    const { mode, limit, offset, ageGroup, gender } = RankingsQuery.parse(req.query);

    if (mode === "1v1") {
      // Individual rankings with team info (includes both member and owner teams)
      const result = await pool.query(
        `SELECT u.id, u.name, u.avatar_url, u.hoop_rank, u.position, u.city, u.birthdate,
           (SELECT id FROM (
              SELECT t.id, t.name, COALESCE(tm.joined_at, t.created_at) as sort_date
              FROM teams t
              JOIN team_members tm ON tm.team_id = t.id
              WHERE tm.user_id = u.id AND tm.status = 'accepted'
              UNION
              SELECT t.id, t.name, t.created_at as sort_date
              FROM teams t
              WHERE t.owner_id = u.id
           ) sub ORDER BY sort_date DESC NULLS LAST LIMIT 1) as team_id,
           (SELECT name FROM (
              SELECT t.id, t.name, COALESCE(tm.joined_at, t.created_at) as sort_date
              FROM teams t
              JOIN team_members tm ON tm.team_id = t.id
              WHERE tm.user_id = u.id AND tm.status = 'accepted'
              UNION
              SELECT t.id, t.name, t.created_at as sort_date
              FROM teams t
              WHERE t.owner_id = u.id
           ) sub ORDER BY sort_date DESC NULLS LAST LIMIT 1) as team_name
         FROM users u
         WHERE u.hoop_rank IS NOT NULL
         ORDER BY u.hoop_rank DESC, u.name ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      res.json({
        mode: "1v1",
        rankings: result.rows.map((u, idx) => {
          // Calculate age from birthdate
          let age: number | null = null;
          if (u.birthdate) {
            const birthdate = new Date(u.birthdate);
            const today = new Date();
            age = today.getFullYear() - birthdate.getFullYear();
            const monthDiff = today.getMonth() - birthdate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdate.getDate())) {
              age--;
            }
          }

          return {
            rank: offset + idx + 1,
            id: u.id,
            name: u.name,
            photoUrl: u.avatar_url,
            rating: Number(u.hoop_rank),
            position: u.position,
            city: u.city,
            team: u.team_name || null,
            teamId: u.team_id || null,
            age,
          };
        }),
      });
    } else {
      // Team rankings (3v3 or 5v5)
      // Get user ID to exclude user's own teams (for challenge flow)
      const uid = req.headers["x-user-id"] as string | undefined;

      // Build dynamic query with optional ageGroup/gender filters
      let query = `SELECT t.id, t.name, t.rating, t.matches_played, t.wins, t.losses,
           t.age_group, t.gender, t.skill_level, t.logo_url,
           (SELECT COUNT(*) FROM team_members WHERE team_id = t.id AND status = 'accepted') as member_count,
           u.name as owner_name
         FROM teams t
         JOIN users u ON u.id = t.owner_id
         WHERE t.team_type = $1
           AND ($4::text IS NULL OR t.owner_id != $4)
           AND ($4::text IS NULL OR t.id NOT IN (
             SELECT team_id FROM team_members WHERE user_id = $4 AND status = 'accepted'
           ))`;

      const params: any[] = [mode, limit, offset, uid || null];
      let paramIndex = 5;

      if (ageGroup) {
        query += ` AND t.age_group = $${paramIndex}`;
        params.push(ageGroup);
        paramIndex++;
      }
      if (gender) {
        query += ` AND t.gender = $${paramIndex}`;
        params.push(gender);
        paramIndex++;
      }

      query += ` ORDER BY t.rating DESC, t.name ASC LIMIT $2 OFFSET $3`;

      const result = await pool.query(query, params);

      res.json({
        mode,
        rankings: result.rows.map((t, idx) => ({
          rank: offset + idx + 1,
          id: t.id,
          name: t.name,
          rating: Number(t.rating),
          matchesPlayed: t.matches_played,
          wins: t.wins,
          losses: t.losses,
          ageGroup: t.age_group || null,
          gender: t.gender || null,
          skillLevel: t.skill_level || null,
          logoUrl: t.logo_url || null,
          memberCount: Number(t.member_count),
          ownerName: t.owner_name,
        })),
      });
    }
  })
);

/* =========================
 * Players Nearby
 * =======================*/
const NearbyQuery = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radiusMi: z.coerce.number().min(0.25).max(25),
  mode: z.enum(["open", "similar"]).default("open"),
  hrWindow: z.coerce.number().optional(),
  minRep: z.coerce.number().optional(),
});

app.get(
  "/players/nearby",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const qp = NearbyQuery.safeParse(req.query);
    if (!qp.success) return res.status(400).json({ error: qp.error.flatten() });

    const { lat, lng, radiusMi, mode, hrWindow, minRep } = qp.data;
    const sql = `
    with me as (
      select id, hoop_rank from users where id = $1
      )
      select
        u.id,
  u.name as "displayName",
  u.username,
  u.hoop_rank as "hoopRank",
  u.reputation,
  (ST_Distance(u.last_loc, ST_SetSRID(ST_MakePoint($2, $3), 4326):: geography) / 1609.344) as "distanceMi",
  u.last_loc_at as "lastActiveAt"
      from users u
      join user_privacy pr on pr.user_id = u.id
      join me on true
      where u.id <> me.id
        and pr.public_profile = true
        and pr.public_location = true
        and u.loc_enabled = true
        and u.last_loc is not null
        and ST_DWithin(u.last_loc, ST_SetSRID(ST_MakePoint($2, $3), 4326):: geography, $4 * 1609.344)
        and(
    $5 = 'open'
          or(
      abs(u.hoop_rank - me.hoop_rank) <= coalesce($6:: numeric, 0.5)
            and($7:: numeric is null or u.reputation >= $7:: numeric)
    )
  )
      order by "distanceMi" asc
      limit 100;
`;
    const r = await pool.query(sql, [uid, lng, lat, radiusMi, mode, hrWindow ?? null, minRep ?? null]);
    res.json(r.rows);
  })
);

/* =========================
 * Matches
 * =======================
 * 
 * ROUTE ORDERING HAZARD:
 * Express matches routes in definition order. Static path segments 
 * MUST be defined BEFORE parameterized routes to prevent shadowing.
 * 
 * CORRECT ORDER:
 *   1. POST /matches              (create)
 *   2. GET  /matches/pending-confirmation  (static path segment)
 *   3. GET  /matches/:id          (parameter route)
 *   4. POST /matches/:id/press-start
 *   5. POST /matches/:id/score
 *   6. POST /matches/:id/confirm
 *   7. POST /matches/:id/contest
 * 
 * WRONG ORDER (causes "/matches/pending-confirmation" to hit /matches/:id):
 *   GET /matches/:id              <- Matches "pending-confirmation" as :id
 *   GET /matches/pending-confirmation  <- NEVER REACHED
 * 
 * Similar patterns apply to /users/nearby vs /users/:userId
 */
const Uuid = z.string().uuid();

const CreateMatchSchema = z.object({
  opponentId: z.string().optional(),  // legacy
  guestId: z.string().optional(),     // from Flutter - same as opponentId
  hostId: z.string().optional(),      // from Flutter - we'll use auth user instead
  courtId: z.string().optional(),
  message: z.string().optional(),     // challenge message
  source: z.enum(["friend", "nearby", "qr"]).optional(),
  client: z.enum(["ios", "android", "web"]).optional(),
});

const ScoreSchema = z.object({
  me: z.number().int().min(0).max(21),
  opponent: z.number().int().min(0).max(21),
});

async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

// Create match (also handles challenge creation)
app.post(
  "/matches",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const body = CreateMatchSchema.parse(req.body ?? {});

    // Support both opponentId (legacy) and guestId (Flutter)
    const opponentId = body.opponentId || body.guestId || null;
    const parts = opponentId ? [uid, opponentId] : [uid];

    // Create match - using only columns that exist in matches table
    const r = await pool.query(
      `INSERT INTO matches(status, creator_id, opponent_id, court_id)
       VALUES('waiting', $1, $2, $3)
       RETURNING *`,
      [uid, opponentId, body.courtId ?? null]
    );

    const match = r.rows[0];

    // If a message was provided, create a challenge record
    if (body.message && opponentId) {
      await pool.query(
        `INSERT INTO challenges (from_id, to_id, message, status)
         VALUES ($1, $2, $3, 'pending')`,
        [uid, opponentId, body.message]
      );
    }

    res.status(201).json(match);
  })
);

// GET /matches/pending-confirmation - matches where current user needs to confirm score
// NOTE: This route MUST be defined BEFORE /matches/:id to avoid route shadowing
app.get(
  "/matches/pending-confirmation",
  asyncH(async (req, res) => {
    const uid = getUserId(req);

    // Find matches where:
    // - User is a participant (creator or opponent)
    // - Match status is 'ended'
    // - Score exists but result.finalized is false
    // - result.submittedBy is NOT the current user (other player submitted)
    const query = `
      SELECT 
        m.id,
        m.creator_id,
        m.opponent_id,
        m.score,
        m.result,
        m.status,
        m.updated_at,
        CASE 
          WHEN m.creator_id = $1 THEN u_opp.name 
          ELSE u_creator.name 
        END as opponent_name,
        CASE 
          WHEN m.creator_id = $1 THEN u_opp.avatar_url 
          ELSE u_creator.avatar_url 
        END as opponent_avatar
      FROM matches m
      LEFT JOIN users u_creator ON u_creator.id = m.creator_id
      LEFT JOIN users u_opp ON u_opp.id = m.opponent_id
      WHERE (m.creator_id = $1 OR m.opponent_id = $1)
        AND m.status = 'ended'
        AND m.score IS NOT NULL
        AND (m.result->>'finalized')::boolean IS NOT TRUE
        AND m.result->>'submittedBy' IS NOT NULL
        AND m.result->>'submittedBy' != $1
      ORDER BY m.updated_at DESC
    `;

    const r = await pool.query(query, [uid]);

    const pendingConfirmations = r.rows.map(row => ({
      matchId: row.id,
      opponentName: row.opponent_name || 'Opponent',
      opponentAvatar: row.opponent_avatar,
      score: row.score,
      submittedAt: row.result?.submittedAt,
    }));

    res.json(pendingConfirmations);
  })
);

// Read
app.get(
  "/matches/:id",
  asyncH(async (req, res) => {
    const id = Uuid.parse(req.params.id);
    const r = await pool.query(`select * from matches where id = $1`, [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
    res.json(r.rows[0]);
  })
);

// Press start
app.post(
  "/matches/:id/press-start",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const id = Uuid.parse(req.params.id);

    const updated = await withTx(async (c) => {
      const r0 = await c.query(`select * from matches where id = $1 for update`, [id]);
      if (r0.rowCount === 0) throw Object.assign(new Error("not_found"), { http: 404 });
      const m = r0.rows[0];

      // Use creator_id and opponent_id instead of participants array
      const creatorId = m.creator_id;
      const opponentId = m.opponent_id;
      if (uid !== creatorId && uid !== opponentId) {
        throw Object.assign(new Error("forbidden"), { http: 403 });
      }

      const startedBy = { ...(m.started_by ?? {}) };
      startedBy[uid] = true;

      // Check if both participants have started (requires opponent to exist)
      const allStarted = opponentId && startedBy[creatorId] === true && startedBy[opponentId] === true;
      const newStatus = allStarted && !m.timer_start ? "live" : m.status;
      const newTimer = allStarted && !m.timer_start ? new Date().toISOString() : m.timer_start;

      const r1 = await c.query(
        `update matches set started_by = $2, status = $3, timer_start = $4, updated_at = now() where id = $1 returning * `,
        [id, startedBy, newStatus, newTimer]
      );
      return r1.rows[0];
    });

    // Send notification to other participant if this is first to press start
    const creatorId = updated.creator_id;
    const opponentId = updated.opponent_id;
    const otherId = uid === creatorId ? opponentId : creatorId;
    if (otherId && !updated.timer_start) {
      // Only notify if game hasn't started yet (waiting for other player)
      const startedBy = updated.started_by ?? {};
      const otherStarted = startedBy[otherId] === true;
      if (!otherStarted) {
        const senderResult = await pool.query(`SELECT name FROM users WHERE id = $1`, [uid]);
        const senderName = senderResult.rows[0]?.name || "Your opponent";
        await sendPushNotification(
          otherId,
          "🎮 Game Ready!",
          `${senderName} is ready to start! Confirm to begin the match.`,
          { type: "game_start", matchId: id }
        );
      }
    }

    res.json(updated);
  })
);

// Score
app.post(
  "/matches/:id/score",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const id = Uuid.parse(req.params.id);

    const sc = ScoreSchema.safeParse(req.body);
    if (!sc.success) return res.status(400).json({ error: sc.error.flatten() });

    const updated = await withTx(async (c) => {
      const r0 = await c.query(`select * from matches where id = $1 for update`, [id]);
      if (r0.rowCount === 0) throw Object.assign(new Error("not_found"), { http: 404 });
      const m = r0.rows[0];

      // Use creator_id and opponent_id instead of participants array
      const creatorId = m.creator_id;
      const opponentId = m.opponent_id;

      if (uid !== creatorId && uid !== opponentId) {
        throw Object.assign(new Error("forbidden"), { http: 403 });
      }
      if (!creatorId || !opponentId) {
        throw Object.assign(new Error("opponent_required"), { http: 400 });
      }

      const other = uid === creatorId ? opponentId : creatorId;
      const score: Record<string, number> = { [uid]: sc.data.me, [other]: sc.data.opponent };

      const nowIso = new Date().toISOString();
      // Changed from 48hr to 24hr contest window
      const deadlineIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const result = {
        submittedBy: uid,
        submittedAt: nowIso,
        confirmedBy: null as string | null,
        contestedBy: null as string | null,
        finalized: false,
        deadlineAt: deadlineIso,
        provisionalRatingApplied: true, // Track that rating was applied provisionally
      };

      const r1 = await c.query(
        `update matches
         set score = $2, result = $3, status = 'ended', updated_at = now()
         where id = $1
returning * `,
        [id, score, result]
      );
      return r1.rows[0];
    });

    // Apply rating immediately on score submission (provisional)
    try {
      await finalizeAndRateMatch(pool, id, true); // provisional=true to skip finalized check
      console.log(`Provisional rating applied for match ${id}`);
    } catch (e) {
      console.error("provisional rating failed", e);
    }

    // Notify opponent that score was submitted
    const otherId = uid === updated.creator_id ? updated.opponent_id : updated.creator_id;
    if (otherId) {
      const senderResult = await pool.query(`SELECT name FROM users WHERE id = $1`, [uid]);
      const senderName = senderResult.rows[0]?.name || "Your opponent";
      await sendPushNotification(
        otherId,
        "📊 Score Submitted",
        `${senderName} submitted a score. Confirm or contest!`,
        { type: "score_pending", matchId: id }
      );
    }

    res.json(updated);
  })
);

// Confirm (finalize & rate)
app.post(
  "/matches/:id/confirm",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const id = Uuid.parse(req.params.id);

    const updated = await withTx(async (c) => {
      const r0 = await c.query(`select * from matches where id = $1 for update`, [id]);
      if (r0.rowCount === 0) throw Object.assign(new Error("not_found"), { http: 404 });

      const m = r0.rows[0];
      // Use creator_id and opponent_id instead of participants array
      const creatorId = m.creator_id;
      const opponentId = m.opponent_id;
      if (uid !== creatorId && uid !== opponentId) {
        throw Object.assign(new Error("forbidden"), { http: 403 });
      }

      const submittedBy = m.result?.submittedBy;
      const finalized = m.result?.finalized === true;
      if (!submittedBy) throw Object.assign(new Error("no_pending_result"), { http: 400 });
      if (finalized) throw Object.assign(new Error("already_finalized"), { http: 400 });
      if (submittedBy === uid) throw Object.assign(new Error("poster_cannot_confirm"), { http: 400 });

      const result = { ...m.result, confirmedBy: uid, finalized: true };
      const r1 = await c.query(`update matches set result = $2, updated_at = now() where id = $1 returning * `, [id, result]);
      return r1.rows[0];
    });

    // Rating already applied on score submission (provisional)
    // No need to apply again on confirm - just log that we're finalizing
    console.log(`Match ${id} confirmed by ${uid} - ratings already applied provisionally`);

    res.json(updated);
  })
);

// Contest (finalize as contested & rate)
app.post(
  "/matches/:id/contest",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const id = Uuid.parse(req.params.id);

    const updated = await withTx(async (c) => {
      const r0 = await c.query(`select * from matches where id = $1 for update`, [id]);
      if (r0.rowCount === 0) throw Object.assign(new Error("not_found"), { http: 404 });
      const m = r0.rows[0];

      // Use creator_id and opponent_id instead of participants array
      const creatorId = m.creator_id;
      const opponentId = m.opponent_id;
      if (uid !== creatorId && uid !== opponentId) {
        throw Object.assign(new Error("forbidden"), { http: 403 });
      }

      const submittedBy = m.result?.submittedBy;
      const finalized = m.result?.finalized === true;
      if (!submittedBy) throw Object.assign(new Error("no_pending_result"), { http: 400 });
      if (finalized) throw Object.assign(new Error("already_finalized"), { http: 400 });
      if (submittedBy === uid) throw Object.assign(new Error("poster_cannot_contest"), { http: 400 });

      const result = { ...m.result, contestedBy: uid, finalized: true };
      const r1 = await c.query(`update matches set result = $2, updated_at = now() where id = $1 returning * `, [id, result]);
      return r1.rows[0];
    });

    // Revert provisional ratings since match was contested
    try {
      const revertResult = await revertMatchRating(pool, id);
      console.log(`Match ${id} contested - ratings reverted:`, revertResult);
    } catch (e) {
      console.error("rating revert failed", e);
    }

    // Increment games_contested for the contesting user (community rating tracking)
    try {
      await pool.query(
        "UPDATE users SET games_contested = COALESCE(games_contested, 0) + 1 WHERE id = $1",
        [uid]
      );
      console.log(`Incremented games_contested for user ${uid}`);
    } catch (e) {
      console.error("games_contested increment failed", e);
    }

    res.json(updated);
  })
);

// GET /activity/local - Recent games from players within radius miles
const LocalActivityQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  radiusMiles: z.coerce.number().min(1).max(100).default(25),
});

app.get(
  "/activity/local",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const { limit, radiusMiles } = LocalActivityQuery.parse(req.query);

    // Get current user's location
    const userResult = await pool.query(
      `SELECT lat, lng FROM users WHERE id = $1`,
      [uid]
    );

    if (userResult.rowCount === 0 || !userResult.rows[0].lat || !userResult.rows[0].lng) {
      return res.json([]); // No location available
    }

    const { lat, lng } = userResult.rows[0];
    const radiusMeters = radiusMiles * 1609.34; // Convert miles to meters

    // Find recent games from players within radius
    // Uses PostGIS for distance calculation
    const query = `
      SELECT DISTINCT
        m.id as match_id,
        m.created_at,
        m.score,
        m.result,
        m.creator_id,
        m.opponent_id,
        u1.id as p1_id,
        u1.name as p1_name,
        u1.avatar_url as p1_avatar,
        u1.rating as p1_rating,
        u1.city as p1_city,
        u2.id as p2_id,
        u2.name as p2_name,
        u2.avatar_url as p2_avatar,
        u2.rating as p2_rating,
        u2.city as p2_city
      FROM matches m
      JOIN users u1 ON u1.id = m.creator_id
      JOIN users u2 ON u2.id = m.opponent_id
      WHERE m.score IS NOT NULL
        AND m.creator_id != $1
        AND m.opponent_id != $1
        AND (
          (u1.lat IS NOT NULL AND u1.lng IS NOT NULL AND
           ST_DWithin(
             ST_SetSRID(ST_MakePoint(u1.lng, u1.lat), 4326)::geography,
             ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
             $4
           ))
          OR
          (u2.lat IS NOT NULL AND u2.lng IS NOT NULL AND
           ST_DWithin(
             ST_SetSRID(ST_MakePoint(u2.lng, u2.lat), 4326)::geography,
             ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
             $4
           ))
        )
      ORDER BY m.created_at DESC
      LIMIT $5
    `;

    const gamesResult = await pool.query(query, [uid, lat, lng, radiusMeters, limit]);

    const activity = gamesResult.rows.map(row => {
      const p1Score = row.score ? row.score[row.p1_id] : null;
      const p2Score = row.score ? row.score[row.p2_id] : null;
      let winnerId = null;
      if (p1Score !== null && p2Score !== null) {
        winnerId = p1Score > p2Score ? row.p1_id : (p2Score > p1Score ? row.p2_id : null);
      }

      return {
        matchId: row.match_id,
        createdAt: row.created_at,
        player1: {
          id: row.p1_id,
          name: row.p1_name,
          avatarUrl: row.p1_avatar,
          rating: row.p1_rating,
          city: row.p1_city,
        },
        player2: {
          id: row.p2_id,
          name: row.p2_name,
          avatarUrl: row.p2_avatar,
          rating: row.p2_rating,
          city: row.p2_city,
        },
        score: {
          player1: p1Score,
          player2: p2Score,
        },
        winnerId,
      };
    });

    res.json(activity);
  })
);

// GET /activity/global - Most recent completed matches app-wide (no location filter)
app.get(
  "/activity/global",
  asyncH(async (req, res) => {
    const limitParam = req.query.limit;
    const limit = Math.min(Math.max(parseInt(String(limitParam)) || 3, 1), 10);

    // Get most recent completed matches with scores
    const query = `
      SELECT
        m.id as match_id,
        m.created_at,
        m.updated_at,
        m.score,
        m.result,
        m.creator_id,
        m.opponent_id,
        u1.id as p1_id,
        u1.name as p1_name,
        u1.avatar_url as p1_avatar,
        u1.hoop_rank as p1_rating,
        u1.city as p1_city,
        u2.id as p2_id,
        u2.name as p2_name,
        u2.avatar_url as p2_avatar,
        u2.hoop_rank as p2_rating,
        u2.city as p2_city
      FROM matches m
      LEFT JOIN users u1 ON u1.id = m.creator_id
      LEFT JOIN users u2 ON u2.id = m.opponent_id
      WHERE m.score IS NOT NULL
        AND m.status = 'ended'
      ORDER BY m.updated_at DESC
      LIMIT $1
    `;

    const gamesResult = await pool.query(query, [limit]);

    const activity = gamesResult.rows.map(row => {
      const p1Score = row.score ? row.score[row.p1_id] : null;
      const p2Score = row.score ? row.score[row.p2_id] : null;

      let winnerId = null;
      if (p1Score !== null && p2Score !== null) {
        winnerId = p1Score > p2Score ? row.p1_id : (p2Score > p1Score ? row.p2_id : null);
      }

      return {
        matchId: row.match_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        eventType: '1v1',
        player1: row.p1_id ? {
          id: row.p1_id,
          name: row.p1_name,
          avatarUrl: row.p1_avatar,
          rating: row.p1_rating,
          city: row.p1_city,
        } : null,
        player2: row.p2_id ? {
          id: row.p2_id,
          name: row.p2_name,
          avatarUrl: row.p2_avatar,
          rating: row.p2_rating,
          city: row.p2_city,
        } : null,
        score: {
          player1: p1Score,
          player2: p2Score,
        },
        winnerId,
      };
    });

    res.json(activity);
  })
);

// GET /users - List all users (for players screen)

app.get(
  "/users",
  asyncH(async (req, res) => {
    const uid = getUserId(req);

    const r = await pool.query(`
      SELECT id, name, avatar_url, hoop_rank, city, position
      FROM users
      WHERE id != $1
      ORDER BY hoop_rank DESC
      LIMIT 100
    `, [uid]);

    const users = r.rows.map(row => ({
      id: row.id,
      name: row.name,
      photoUrl: row.avatar_url,
      rating: row.hoop_rank ?? 3.0,
      city: row.city,
      position: row.position,
    }));

    res.json(users);
  })
);



/* =========================
 * Debug DB
 * =======================*/
app.get("/debug/db", async (_req, res, next) => {
  try {
    const r = await pool.query("select now(), current_user, inet_server_addr()::text as server_ip");
    res.json(r.rows[0]);
  } catch (e) {
    next(e);
  }
});

// Quick whoami/CORS test
app.get("/debug/whoami", (req, res) => {
  res.json({
    origin: req.headers.origin ?? null,
    ip: req.ip,
    userId: getUserId(req),
  });
});

/* =========================
 * Courts
 * =======================*/
const CourtsNearQuery = z.object({
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  radiusMi: z.coerce.number().min(0.1).max(50),
});

function rowToCourt(r: any) {
  return {
    id: r.id,
    name: r.name,
    city: r.city,
    indoor: r.indoor,
    rims: r.rims,
    source: r.source,
    signature: r.signature,
    lat: Number(r.lat),
    lng: Number(r.lng),
    distanceMi: r.distanceMi !== undefined ? Number(r.distanceMi) : undefined,
  };
}

app.get(
  "/courts/near",
  asyncH(async (req, res) => {
    const qp = CourtsNearQuery.safeParse(req.query);
    if (!qp.success) return res.status(400).json({ error: qp.error.flatten() });

    const { lat, lng, radiusMi } = qp.data;
    const sql = `
with pt as (select ST_SetSRID(ST_MakePoint($1, $2), 4326):: geography as g)
select
c.id, c.name, c.city, c.indoor, c.rims, c.source, c.signature,
  ST_Y(c.geog:: geometry) as lat,
  ST_X(c.geog:: geometry) as lng,
  ST_Distance(c.geog, (select g from pt)) / 1609.344 as "distanceMi"
      from courts c
      where ST_DWithin(c.geog, (select g from pt), $3 * 1609.344)
      order by "distanceMi" asc
      limit 200;
`;
    const r = await pool.query(sql, [lng, lat, radiusMi]);
    res.json(r.rows.map(rowToCourt));
  })
);

app.get(
  "/courts",
  asyncH(async (req, res) => {
    const bbox = String(req.query.bbox ?? "");
    const parts = bbox.split(",").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
      return res.status(400).json({ error: "invalid_bbox" });
    }
    const [minLat, minLng, maxLat, maxLng] = parts;

    const sql = `
      select id, name, city, indoor, rims, source, signature,
  ST_Y(geog:: geometry) as lat,
  ST_X(geog:: geometry) as lng
      from courts
      where ST_Intersects(
    geog:: geometry,
    ST_MakeEnvelope($1, $2, $3, $4, 4326)
  )
      limit 500;
`;
    const r = await pool.query(sql, [minLng, minLat, maxLng, maxLat]);
    res.json(r.rows.map(rowToCourt));
  })
);

app.get(
  "/courts/signature",
  asyncH(async (_req, res) => {
    const r = await pool.query(`
      select id, name, city, indoor, rims, source, signature,
  ST_Y(geog:: geometry) as lat,
  ST_X(geog:: geometry) as lng
      from courts
      where signature = true
      order by city, name
      limit 200
  `);
    res.json(r.rows.map(rowToCourt));
  })
);

app.get(
  "/courts/:id",
  asyncH(async (req, res) => {
    const id = Uuid.parse(req.params.id);
    const r = await pool.query(
      `
      select id, name, city, indoor, rims, source, signature,
  ST_Y(geog:: geometry) as lat,
  ST_X(geog:: geometry) as lng
      from courts where id = $1
  `,
      [id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
    res.json(rowToCourt(r.rows[0]));
  })
);

/* ======== Court Kings (current) ======== */
const BRACKETS = ["10u", "12u", "14u", "18u", "Open", "35plus"] as const;
type Bracket = (typeof BRACKETS)[number];

type CourtKingView = {
  userId: string;
  displayName: string;
  username: string;
  hoopRank: number;
  lastWinAt: string | null;
};

app.get(
  "/courts/:id/kings",
  asyncH(async (req, res) => {
    const courtId = Uuid.parse(req.params.id);

    const r = await pool.query(
      `
select
ck.bracket,
  ck.user_id as "userId",
  ck.hoop_rank as "hoopRank",
  ck.last_win_at as "lastWinAt",
  u.name as "displayName",
  u.username
      from court_kings_current ck
      join users u on u.id = ck.user_id
      where ck.court_id = $1
  `,
      [courtId]
    );

    const map: Record<Bracket, CourtKingView | null> = {
      "10u": null,
      "12u": null,
      "14u": null,
      "18u": null,
      Open: null,
      "35plus": null,
    };

    for (const row of r.rows) {
      const b = row.bracket as Bracket;
      map[b] = {
        userId: row.userId,
        displayName: row.displayName,
        username: row.username,
        hoopRank: Number(row.hoopRank),
        lastWinAt: row.lastWinAt,
      };
    }

    res.json(map);
  })
);

/* =========================
 * Users / Profile
 * =======================*/
function shapeUser(r: any) {
  return {
    id: r.id,
    displayName: r.name,
    username: r.username,
    avatarUrl: r.avatar_url,
    hoopRank: Number(r.hoop_rank),
    reputation: Number(r.reputation),
    position: r.position,
    height: r.height,
    weight: r.weight,
    zip: r.zip,
  };
}

// GET /me
app.get(
  "/me",
  asyncH(async (req, res) => {
    const uid = getUserId(req);
    const r = await pool.query(
      `
      select id, name, username, avatar_url, hoop_rank, reputation, position, height, weight, zip
      from users where id = $1
  `,
      [uid]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
    res.json(shapeUser(r.rows[0]));
  })
);

// GET /users
app.get(
  "/users",
  asyncH(async (req, res) => {
    const r = await pool.query(
      `
      select id, name, username, avatar_url, hoop_rank, position, zip
      from users
      order by hoop_rank desc
      limit 50
  `
    );

    const users = r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      username: row.username,
      photoUrl: row.avatar_url,
      rating: Number(row.hoop_rank),
      position: row.position,
      team: row.zip, // Using team field for zip code (for distance filtering)
      matchesPlayed: 0 // Placeholder as we don't have this easily available yet
    }));

    res.json(users);
  })
);

// GET /users/:id (privacy-aware)
app.get(
  "/users/:id",
  asyncH(async (req, res) => {
    const viewer = getUserId(req);
    const id = Uuid.parse(req.params.id);
    const r = await pool.query(
      `
      select u.id, u.name, u.username, u.avatar_url, u.hoop_rank, u.reputation, u.position, u.height, u.weight, u.zip,
  coalesce(p.public_profile, true) as public_profile
      from users u
      left join user_privacy p on p.user_id = u.id
      where u.id = $1
  `,
      [id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
    const row = r.rows[0];

    if (row.public_profile !== true && viewer !== row.id) {
      return res.json({
        id: row.id,
        displayName: row.name,
        username: row.username,
        publicProfile: false,
      });
    }
    res.json({ ...shapeUser(row), publicProfile: true });
  })
);

// GET /users/:id/recent-games?limit=
const RecentGamesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

app.get(
  "/users/:id/recent-games",
  asyncH(async (req, res) => {
    const subjectId = req.params.id; // Accept any string ID (Firebase UIDs)
    const viewer = getUserId(req);
    const { limit } = RecentGamesQuery.parse(req.query);

    const r = await pool.query(
      `
select
  m.id, m.status, m.creator_id, m.opponent_id,
  m.started_by, m.timer_start, m.score, m.result,
  m.created_at, m.updated_at,
  (m.result->>'submittedBy' = $2) as "isHost",
    (
      m.result is not null
          and coalesce((m.result ->> 'finalized'):: boolean, false) = false
and m.result->>'submittedBy' is not null
          and m.result->>'submittedBy' != $2
          ) as "canContest",
  -- Include opponent name: if I'm the creator, opponent is opponent_id, else creator_id
  CASE 
    WHEN m.creator_id = $1 THEN opponent.name
    ELSE creator.name
  END as opponent_name
      from matches m
      LEFT JOIN users creator ON creator.id = m.creator_id
      LEFT JOIN users opponent ON opponent.id = m.opponent_id
      where (m.creator_id = $1 OR m.opponent_id = $1)
        AND m.score IS NOT NULL
      order by coalesce(m.updated_at, m.created_at) desc
      limit $3
  `,
      [subjectId, viewer, limit]
    );

    res.json(r.rows);
  })
);

// GET /users/:id/stats
app.get(
  "/users/:id/stats",
  asyncH(async (req, res) => {
    const uid = req.params.id; // Support both UUID and text IDs (Firebase)

    // Use creator_id/opponent_id pattern instead of legacy participants array
    // Uses FILTER clause for efficient single-pass aggregation
    const r = await pool.query(
      `
      WITH valid_matches AS (
        SELECT
          m.id,
          m.created_at,
          m.creator_id,
          m.opponent_id,
          m.score,
          m.result,
          CASE 
            WHEN m.creator_id = $1 THEN m.opponent_id 
            ELSE m.creator_id 
          END as opp_id,
          (m.score->>$1)::int as my_score,
          CASE 
            WHEN m.creator_id = $1 THEN (m.score->>m.opponent_id)::int
            ELSE (m.score->>m.creator_id)::int
          END as opp_score,
          m.result->>'submittedBy' as submitted_by,
          m.result->>'contestedBy' as contested_by
        FROM matches m
        WHERE (m.creator_id = $1 OR m.opponent_id = $1)
          AND m.score IS NOT NULL
          AND m.result IS NOT NULL
          AND COALESCE((m.result->>'finalized')::boolean, false) = true
      )
      SELECT
        COUNT(*) FILTER (WHERE my_score > opp_score) as wins,
        COUNT(*) FILTER (WHERE my_score < opp_score) as losses,
        COUNT(*) as played,
        COUNT(*) FILTER (
          WHERE created_at >= now() - interval '365 days'
            AND submitted_by = $1
        ) as posted12mo,
        COUNT(*) FILTER (
          WHERE created_at >= now() - interval '365 days'
            AND submitted_by = $1
            AND contested_by IS NOT NULL
        ) as contested12mo
      FROM valid_matches
      `,
      [uid]
    );

    const row =
      r.rows[0] ?? { wins: 0, losses: 0, played: 0, posted12mo: 0, contested12mo: 0 };

    const posted = Number(row.posted12mo || 0);
    const contested = Number(row.contested12mo || 0);
    const rep12mo = posted === 0 ? 5.0 : Math.round((5 - 4 * (contested / posted)) * 10) / 10;

    res.json({
      wins: Number(row.wins || 0),
      losses: Number(row.losses || 0),
      played: Number(row.played || 0),
      posted12mo: posted,
      contested12mo: contested,
      rep12mo,
    });
  })
);

/* =========================
 * Friends & Friend Requests
 * =======================*/
const FriendRequestCreate = z.object({
  toUserId: z.string().uuid(),
});
const FriendReqIdParam = z.object({ id: z.string().uuid() });

function sortPair(a: string, b: string): [string, string] {
  return [a, b].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)) as [string, string];
}



app.post(
  "/challenges/:id/decline",
  asyncH(async (req, res) => {
    const me = getUserId(req);
    const id = Uuid.parse(req.params.id);

    const r0 = await pool.query(`select id, from_id, to_id, status from challenges where id = $1`, [id]);
    if ((r0.rowCount ?? 0) === 0) return res.status(404).json({ error: "not_found" });

    const ch = r0.rows[0];
    if (ch.to_id !== me) return res.status(403).json({ error: "forbidden" });
    if (ch.status !== "pending") return res.status(400).json({ error: "not_pending" });

    const r1 = await pool.query(
      `update challenges set status = 'declined', updated_at = now()
       where id = $1
       returning id, from_id as "fromId", to_id as "ToId", message, status,
  expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"`,
      [id]
    );
    res.json(r1.rows[0]);
  })
);

/* =========================
 * Admin sweeps
 * =======================*/
function requireAdmin(req: express.Request, res: express.Response): boolean {
  const key = req.header("x-admin-key");
  if (!key || key !== ADMIN_KEY) {
    res.status(403).json({ error: "admin_key_required" });
    return false;
  }
  return true;
}

app.get(
  "/admin/sweep",
  asyncH(async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const inv = await pool.query(
      `
      update invites
        set status = 'expired', updated_at = now()
      where status = 'open' and now() > expires_at
      returning token
  `
    );
    const ch = await pool.query(
      `
      update challenges
        set status = 'expired', updated_at = now()
      where status = 'pending' and now() > expires_at
      returning id
  `
    );
    res.json({ invitesExpired: inv.rowCount ?? 0, challengesExpired: ch.rowCount ?? 0 });
  })
);

// Auto-accept matches past 48h, then rate
app.get("/admin/match-sweep", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { rows } = await pool.query(`
      update matches
         set result = jsonb_set(coalesce(result, '{}':: jsonb), '{finalized}', 'true':: jsonb)
  || jsonb_build_object('autoAcceptedAt', now()),
  status = 'ended',
  updated_at = now()
       where status = 'ended'
         and result is not null
         and coalesce((result ->> 'finalized'):: boolean, false) = false
         and now() > (result ->> 'deadlineAt'):: timestamptz
      returning id
  `);

    let rated = 0;
    for (const r of rows) {
      try {
        const out = await finalizeAndRateMatch(pool, r.id);
        if (out.applied) rated++;
      } catch (e) {
        console.error(e);
      }
    }
    res.json({ matchesAutoAccepted: rows.length, rated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* =========================
 * Messaging
 * =======================*/
const MessageSchema = z.object({
  senderId: z.string(),
  receiverId: z.string(),
  content: z.string().min(1).max(500),
  matchId: z.string().optional(),
  isChallenge: z.boolean().optional(),
});


// GET /messages/challenges - returns both sent and received challenges
app.get(
  "/messages/challenges",
  asyncH(async (req, res) => {
    const userId = getUserId(req);

    // First, auto-expire any pending challenges older than 7 days
    await pool.query(`
      UPDATE challenges 
      SET status = 'expired', updated_at = now()
      WHERE status = 'pending' 
        AND created_at < now() - interval '7 days'
    `);

    // Get all challenges where user is sender OR receiver (exclude expired for visibility)
    const q = `
      SELECT 
        c.id,
        c.from_id,
        c.to_id,
        c.message as body,
        c.created_at,
        c.status as challenge_status,
        CASE WHEN c.from_id = $1 THEN 'sent' ELSE 'received' END as direction,
        -- Get the OTHER user's info (opponent)
        CASE WHEN c.from_id = $1 THEN u_to.id ELSE u_from.id END as other_id,
        CASE WHEN c.from_id = $1 THEN COALESCE(u_to.name, 'Unknown Player') ELSE COALESCE(u_from.name, 'Unknown Player') END as other_name,
        CASE WHEN c.from_id = $1 THEN u_to.avatar_url ELSE u_from.avatar_url END as other_avatar,
        CASE WHEN c.from_id = $1 THEN COALESCE(u_to.hoop_rank, 50) ELSE COALESCE(u_from.hoop_rank, 50) END as other_rank,
        CASE WHEN c.from_id = $1 THEN u_to.position ELSE u_from.position END as other_position
      FROM challenges c
      LEFT JOIN users u_from ON u_from.id = c.from_id
      LEFT JOIN users u_to ON u_to.id = c.to_id
      WHERE (c.from_id = $1 OR c.to_id = $1)
        AND c.status NOT IN ('expired', 'cancelled', 'accepted', 'declined')
      ORDER BY c.created_at DESC
    `;

    const r = await pool.query(q, [userId]);

    const challenges = r.rows.map((row) => ({
      message: {
        id: row.id,
        senderId: row.from_id,
        receiverId: row.to_id,
        content: row.body || "Challenge!",
        createdAt: row.created_at,
        matchId: null,
        isChallenge: true,
        challengeStatus: row.challenge_status,
      },
      direction: row.direction, // 'sent' or 'received'
      sender: {
        id: row.other_id,
        name: row.other_name,
        photoUrl: row.other_avatar,
        rating: Number(row.other_rank),
        position: row.other_position,
      },
    }));

    res.json(challenges);
  })
);

// DELETE /challenges/:id - cancel a challenge (only by sender)
app.delete(
  "/challenges/:id",
  asyncH(async (req, res) => {
    const userId = getUserId(req);
    const challengeId = req.params.id;

    // Verify the user is the sender and challenge is still pending
    const check = await pool.query(
      `SELECT from_id, status FROM challenges WHERE id = $1`,
      [challengeId]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    const challenge = check.rows[0];

    if (challenge.from_id !== userId) {
      return res.status(403).json({ error: "Only the challenger can cancel" });
    }

    if (challenge.status !== 'pending') {
      return res.status(400).json({ error: "Can only cancel pending challenges" });
    }

    // Cancel the challenge
    await pool.query(
      `UPDATE challenges SET status = 'cancelled', updated_at = now() WHERE id = $1`,
      [challengeId]
    );

    res.json({ success: true, message: "Challenge cancelled" });
  })
);

// GET /messages/team-chats - Get user's team chat threads
app.get(
  "/messages/team-chats",
  asyncH(async (req, res) => {
    const uid = getUserId(req);

    // Get teams the user is an accepted member of, with their thread info
    const result = await pool.query(
      `SELECT t.id as team_id, t.name as team_name, t.team_type, t.thread_id,
              th.last_message_at,
              (SELECT m.body FROM messages m WHERE m.thread_id = th.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
              (SELECT u.name FROM messages m JOIN users u ON u.id = m.from_id WHERE m.thread_id = th.id ORDER BY m.created_at DESC LIMIT 1) as last_sender_name
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       LEFT JOIN threads th ON th.id = t.thread_id
       WHERE tm.user_id = $1 AND tm.status = 'accepted'
       ORDER BY th.last_message_at DESC NULLS LAST`,
      [uid]
    );

    res.json(result.rows.map(row => ({
      teamId: row.team_id,
      teamName: row.team_name,
      teamType: row.team_type,
      threadId: row.thread_id,
      lastMessage: row.last_message || null,
      lastSenderName: row.last_sender_name || null,
      lastMessageAt: row.last_message_at || null,
    })));
  })
);

// GET /messages/conversations/:userId
app.get(
  "/messages/conversations/:userId",
  asyncH(async (req, res) => {
    const userId = req.params.userId;
    const authUser = getUserId(req);

    if (userId !== authUser) {
      return res.status(403).json({ error: "forbidden" });
    }

    const q = `
select
t.id as thread_id,
  u.id as user_id,
  u.name,
  u.avatar_url,
  u.hoop_rank,
  u.position,
  m.id as msg_id,
  m.from_id,
  m.to_id,
  m.body,
  m.created_at,
  m.read,
  (SELECT COUNT(*) FROM messages WHERE thread_id = t.id AND to_id = $1 AND read = false) as unread_count
      from threads t
      join users u on u.id = (case when t.user_a = $1 then t.user_b else t.user_a end)
      left join lateral(
    select * from messages
        where thread_id = t.id
        order by created_at desc
        limit 1
  ) m on true
      where t.user_a = $1 or t.user_b = $1
      order by t.last_message_at desc nulls last
  `;

    const r = await pool.query(q, [userId]);

    const conversations = r.rows.map((row) => ({
      threadId: row.thread_id, // Add thread ID for deletion
      user: {
        id: row.user_id,
        name: row.name,
        photoUrl: row.avatar_url,
        rating: Number(row.hoop_rank),
        position: row.position,
      },
      lastMessage: row.msg_id
        ? {
          id: row.msg_id,
          senderId: row.from_id,
          receiverId: row.to_id,
          content: row.body,
          createdAt: row.created_at,
        }
        : null,
      unreadCount: Number(row.unread_count || 0),
    }));

    res.json(conversations);
  })
);

// GET /messages/unread-count - Get count of unread messages for badge display
app.get(
  "/messages/unread-count",
  asyncH(async (req, res) => {
    const userId = getUserId(req);

    // Count unread messages where the user is the recipient
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM messages 
       WHERE to_id = $1 AND read = false`,
      [userId]
    );

    const count = Number(result.rows[0]?.count || 0);
    res.json({ unreadCount: count });
  })
);

// DELETE /threads/:threadId - delete a conversation thread
app.delete(
  "/threads/:threadId",
  asyncH(async (req, res) => {
    const userId = getUserId(req);
    const threadId = req.params.threadId;

    // Verify user is part of this thread
    const check = await pool.query(
      `SELECT user_a, user_b FROM threads WHERE id = $1`,
      [threadId]
    );

    if (check.rowCount === 0) {
      return res.status(404).json({ error: "Thread not found" });
    }

    const thread = check.rows[0];
    if (thread.user_a !== userId && thread.user_b !== userId) {
      return res.status(403).json({ error: "Not authorized to delete this thread" });
    }

    // Delete messages first (due to foreign key), then thread
    await pool.query(`DELETE FROM messages WHERE thread_id = $1`, [threadId]);
    await pool.query(`DELETE FROM threads WHERE id = $1`, [threadId]);

    res.json({ success: true, message: "Thread deleted" });
  })
);

// GET /messages/:userId/:otherUserId
app.get(
  "/messages/:userId/:otherUserId",
  asyncH(async (req, res) => {
    const userId = req.params.userId;
    const otherUserId = req.params.otherUserId;
    const authUser = getUserId(req);

    if (userId !== authUser) {
      return res.status(403).json({ error: "forbidden" });
    }

    const q = `
      select id, from_id, to_id, body, created_at, read
      from messages
where(from_id = $1 and to_id = $2)
or(from_id = $2 and to_id = $1)
      order by created_at asc
    `;

    const r = await pool.query(q, [userId, otherUserId]);

    // Mark messages from the other user as read
    await pool.query(
      `UPDATE messages SET read = true 
       WHERE from_id = $1 AND to_id = $2 AND read = false`,
      [otherUserId, userId]
    );

    const messages = r.rows.map((row) => ({
      id: row.id,
      senderId: row.from_id,
      receiverId: row.to_id,
      content: row.body,
      createdAt: row.created_at,
    }));
    res.json(messages);
  })
);

// POST /messages
app.post(
  "/messages",
  asyncH(async (req, res) => {
    const body = MessageSchema.parse(req.body);
    const authUser = getUserId(req);

    if (body.senderId !== authUser) {
      return res.status(403).json({ error: "forbidden_sender_mismatch" });
    }

    // If this is a challenge, create it in the challenges table instead
    if (body.isChallenge) {
      // Check pending challenges count
      const pendingCount = await pool.query(
        `SELECT COUNT(*) as count FROM challenges 
         WHERE from_id = $1 AND status = 'pending'`,
        [body.senderId]
      );

      const count = Number(pendingCount.rows[0]?.count || 0);
      if (count >= 5) {
        return res.status(429).json({
          error: "max_pending_challenges",
          message: "You have reached the maximum of 5 pending challenges. Please wait for responses before sending more."
        });
      }

      // Insert into challenges table
      const cRes = await pool.query(
        `INSERT INTO challenges (from_id, to_id, message, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING id, created_at`,
        [body.senderId, body.receiverId, body.content]
      );

      return res.status(201).json({
        id: cRes.rows[0].id,
        senderId: body.senderId,
        receiverId: body.receiverId,
        content: body.content,
        createdAt: cRes.rows[0].created_at,
        matchId: body.matchId,
        isChallenge: true,
        challengeStatus: 'pending'
      });
    }

    // Regular message - insert into messages table
    const result = await withTx(async (c) => {
      const [u1, u2] = sortPair(body.senderId, body.receiverId);
      let threadId: string;

      const tRes = await c.query(
        `SELECT id FROM threads WHERE user_a = $1 AND user_b = $2`,
        [u1, u2]
      );

      if (tRes.rowCount === 0) {
        const newT = await c.query(
          `INSERT INTO threads(user_a, user_b, last_message_at) VALUES($1, $2, now()) RETURNING id`,
          [u1, u2]
        );
        threadId = newT.rows[0].id;
      } else {
        threadId = tRes.rows[0].id;
        await c.query(`UPDATE threads SET last_message_at = now() WHERE id = $1`, [threadId]);
      }

      const mRes = await c.query(
        `INSERT INTO messages(thread_id, from_id, to_id, body)
         VALUES($1, $2, $3, $4)
         RETURNING id, created_at`,
        [threadId, body.senderId, body.receiverId, body.content]
      );

      // Truncate messages: Keep only last 50 per thread
      await c.query(
        `DELETE FROM messages 
         WHERE thread_id = $1 
         AND id NOT IN (
           SELECT id FROM messages 
           WHERE thread_id = $1 
           ORDER BY created_at DESC 
           LIMIT 50
         )`,
        [threadId]
      );

      return {
        id: mRes.rows[0].id,
        senderId: body.senderId,
        receiverId: body.receiverId,
        content: body.content,
        createdAt: mRes.rows[0].created_at,
        matchId: body.matchId,
        isChallenge: false,
        challengeStatus: null
      };
    });

    // Send push notification for regular messages
    const senderResult = await pool.query(`SELECT name FROM users WHERE id = $1`, [body.senderId]);
    const senderName = senderResult.rows[0]?.name || "Someone";
    await sendPushNotification(
      body.receiverId,
      "💬 New Message",
      `${senderName} sent you a message`,
      { type: "message", senderId: body.senderId }
    );

    res.status(201).json(result);
  })
);

/* =========================
 * Rating API
 * =======================*/
app.get("/users/:id/rating", async (req, res) => {
  try {
    const r = await getUserRating(pool, String(req.params.id));
    res.json(r);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /users/me - Get current user's data (including updated rating)
// NOTE: This route MUST be defined BEFORE /users/:id to avoid route shadowing
app.get(
  "/users/me",
  asyncH(async (req, res) => {
    const uid = getUserId(req);

    const r = await pool.query(
      `SELECT id, name, avatar_url, hoop_rank, position, city, matches_played, wins, losses
       FROM users WHERE id = $1`,
      [uid]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "user_not_found" });
    }

    const row = r.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      photoUrl: row.avatar_url,
      rating: row.hoop_rank ?? 3.0,
      position: row.position,
      city: row.city,
      matchesPlayed: row.matches_played ?? 0,
      wins: row.wins ?? 0,
      losses: row.losses ?? 0,
    });
  })
);

app.get("/users/:id/rank-history", async (req, res) => {
  try {
    const range = String(req.query.range || "all");
    const rows = await getUserRankHistory(pool, String(req.params.id), range);
    res.json({ series: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/admin/rate/:id", async (req, res) => {
  try {
    const out = await finalizeAndRateMatch(pool, String(req.params.id));
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* =========================
 * Invites
 * =======================*/
const InviteCreate = z.object({
  type: z.enum(["match"]),
  ttlSec: z.number().min(60).max(86400).optional().default(3600),
});

function makeToken(length: number) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

app.post(
  "/invites",
  asyncH(async (req, res) => {
    const hostId = getUserId(req);
    const body = InviteCreate.parse(req.body ?? {});
    const token = makeToken(12);

    const r = await pool.query(
      `insert into invites(token, type, host_id, expires_at)
values($1, $2, $3, now() + make_interval(secs => $4:: double precision))
       returning token, type, host_id as "hostId", status, expires_at as "expiresAt", created_at as "createdAt"`,
      [token, body.type, hostId, body.ttlSec]
    );

    const base = process.env.PUBLIC_BASE_URL ?? "https://hooprank.app";
    const joinUrl = `${base} /join/${token} `;
    const appUrl = `hooprank://join/${token}`;

    res.status(201).json({ ...r.rows[0], joinUrl, appUrl });
  })
);

app.get(
  "/invites/:token",
  asyncH(async (req, res) => {
    const token = String(req.params.token);
    const r = await pool.query(
      `select token, type, host_id as "hostId", status, accepted_by as "acceptedBy",
              expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"
       from invites where token=$1`,
      [token]
    );
    if ((r.rowCount ?? 0) === 0) return res.status(404).json({ error: "not_found" });

    const inv = r.rows[0];
    const now = Date.now();
    const expired = now > new Date(inv.expiresAt).getTime();

    if (expired && inv.status === "open") {
      await pool.query(`update invites set status='expired', updated_at=now() where token=$1`, [token]);
      inv.status = "expired";
    }

    res.json(inv);
  })
);

app.post(
  "/invites/:token/accept",
  asyncH(async (req, res) => {
    const viewer = getUserId(req);
    const token = String(req.params.token);

    const out = await withTx(async (c) => {
      const r0 = await c.query(
        `select token, type, host_id, status, expires_at, accepted_by
         from invites where token=$1 for update`,
        [token]
      );
      if ((r0.rowCount ?? 0) === 0) throw Object.assign(new Error("not_found"), { http: 404 });

      const inv = r0.rows[0];
      const expired = Date.now() > new Date(inv.expires_at).getTime();
      if (inv.status !== "open") throw Object.assign(new Error("not_open"), { http: 400 });
      if (expired) {
        await c.query(`update invites set status='expired', updated_at=now() where token=$1`, [token]);
        throw Object.assign(new Error("expired"), { http: 410 });
      }
      if (viewer === inv.host_id) throw Object.assign(new Error("host_cannot_accept"), { http: 400 });

      await c.query(
        `update invites set status='accepted', accepted_by=$2, updated_at=now() where token=$1`,
        [token, viewer]
      );

      const parts = [inv.host_id, viewer];
      const r1 = await c.query(
        `INSERT INTO matches (status, creator_id, opponent_id)
         VALUES ('waiting', $1, $2)
         RETURNING id`,
        [inv.host_id, viewer]
      );

      return { token, matchId: r1.rows[0].id };
    });

    res.json(out);
  })
);

/* =========================
 * Challenges
 * =======================*/
const ChallengeCreate = z.object({
  toUserId: z.string(), // Accept any string (Firebase UIDs are not UUIDs)
  message: z.string().max(280).optional(),
});

app.get(
  "/challenges",
  asyncH(async (req, res) => {
    const me = getUserId(req);
    const box = String(req.query.box ?? "incoming");

    const base = `
      select id, from_id as "fromId", to_id as "toId", message, status,
      expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"
      from challenges
    `;

    let sql = "";
    let args: any[] = [];
    if (box === "outgoing") {
      sql = `${base} where from_id=$1::uuid and status='pending' order by created_at desc limit 200`;
      args = [me];
    } else if (box === "all") {
      sql = `${base} where (from_id=$1::uuid or to_id=$1::uuid) order by created_at desc limit 400`;
      args = [me];
    } else {
      sql = `${base} where to_id=$1::uuid and status='pending' order by created_at desc limit 200`;
      args = [me];
    }

    const r = await pool.query(sql, args);
    const now = Date.now();
    const rows = r.rows.map((row) => {
      const expired = now > new Date(row.expiresAt).getTime();
      return expired && row.status === "pending" ? { ...row, status: "expired" } : row;
    });
    res.json(rows);
  })
);

app.post(
  "/challenges",
  asyncH(async (req, res) => {
    const fromId = getUserId(req);
    const { toUserId, message } = ChallengeCreate.parse(req.body ?? {});
    if (fromId === toUserId) return res.status(400).json({ error: "cannot_challenge_self" });

    // Check for existing pending challenge between these users
    const existing = await pool.query(
      `SELECT 1 FROM challenges
       WHERE ((from_id=$1 AND to_id=$2) OR (from_id=$2 AND to_id=$1))
         AND status='pending'
       LIMIT 1`,
      [fromId, toUserId]
    );
    if ((existing.rowCount ?? 0) > 0) return res.status(200).json({ ok: true, dedup: true });

    // Create challenge (no match yet - match created when accepted)
    const id = randomUUID();
    const ins = await pool.query(
      `INSERT INTO challenges (id, from_id, to_id, message) VALUES ($1, $2, $3, $4)
       RETURNING id, from_id as "fromId", to_id as "toId", message, status,
                 expires_at as "expiresAt", created_at as "createdAt", updated_at as "updatedAt"`,
      [id, fromId, toUserId, message ?? null]
    );

    // Also create a messaging thread so they can chat about the challenge
    const [a, b] = sortPair(fromId, toUserId);
    const threadResult = await pool.query(
      `INSERT INTO threads (user_a, user_b, last_message_at) VALUES ($1, $2, NOW())
       ON CONFLICT (user_a, user_b) DO UPDATE SET last_message_at = NOW()
       RETURNING id`,
      [a, b]
    );
    const threadId = threadResult.rows[0].id;

    // Insert the challenge message into the thread
    if (message) {
      await pool.query(
        `INSERT INTO messages (thread_id, from_id, to_id, body) VALUES ($1, $2, $3, $4)`,
        [threadId, fromId, toUserId, message]
      );
    }

    // Send push notification to challenged user
    const senderName = await pool.query(`SELECT name FROM users WHERE id = $1`, [fromId]);
    const challengerName = senderName.rows[0]?.name || "Someone";
    await sendPushNotification(
      toUserId,
      "🏀 New Challenge!",
      `${challengerName} challenged you to a 1v1!`,
      { type: "challenge", challengeId: id, fromUserId: fromId }
    );

    res.status(201).json({ ...ins.rows[0], threadId });
  })
);

app.post(
  "/challenges/:id/accept",
  asyncH(async (req, res) => {
    const me = getUserId(req);
    const id = req.params.id;

    const out = await withTx(async (c) => {
      const r0 = await c.query(
        `SELECT id, from_id, to_id, status, expires_at
         FROM challenges WHERE id=$1 FOR UPDATE`,
        [id]
      );
      if ((r0.rowCount ?? 0) === 0) throw Object.assign(new Error("not_found"), { http: 404 });

      const ch = r0.rows[0];
      if (ch.to_id !== me) throw Object.assign(new Error("forbidden"), { http: 403 });
      if (ch.status !== "pending") throw Object.assign(new Error("not_pending"), { http: 400 });

      if (Date.now() > new Date(ch.expires_at).getTime()) {
        await c.query(`UPDATE challenges SET status='expired', updated_at=now() WHERE id=$1`, [id]);
        throw Object.assign(new Error("expired"), { http: 410 });
      }

      // Mark challenge as accepted
      await c.query(`UPDATE challenges SET status='accepted', updated_at=now() WHERE id=$1`, [id]);

      // Create friendship
      const [a, b] = sortPair(ch.from_id, ch.to_id);
      await c.query(
        `INSERT INTO friendships (user_a, user_b)
         VALUES ($1,$2)
         ON CONFLICT (user_a, user_b) DO NOTHING`,
        [a, b]
      );

      // Create match now that challenge is accepted
      const matchResult = await c.query(
        `INSERT INTO matches (status, creator_id, opponent_id)
         VALUES ('waiting', $1, $2)
         RETURNING id`,
        [ch.from_id, ch.to_id]
      );
      const matchId = matchResult.rows[0].id;

      return { id, status: "accepted", matchId, fromId: ch.from_id };
    });

    // Notify the challenger that their challenge was accepted
    const accepterResult = await pool.query(`SELECT name FROM users WHERE id = $1`, [me]);
    const accepterName = accepterResult.rows[0]?.name || "Your opponent";
    await sendPushNotification(
      out.fromId,
      "✅ Challenge Accepted!",
      `${accepterName} accepted your challenge! Game on! 🏀`,
      { type: "challenge_accepted", matchId: out.matchId }
    );

    res.json(out);
  })
);

app.post(
  "/challenges/:id/decline",
  asyncH(async (req, res) => {
    const me = getUserId(req);
    const id = req.params.id;

    const fromId = await withTx(async (c) => {
      const r0 = await c.query(
        `select id, from_id, to_id, status from challenges where id=$1 for update`,
        [id]
      );
      if ((r0.rowCount ?? 0) === 0) throw Object.assign(new Error("not_found"), { http: 404 });
      const ch = r0.rows[0];
      if (ch.to_id !== me) throw Object.assign(new Error("forbidden"), { http: 403 });
      if (ch.status !== "pending") throw Object.assign(new Error("not_pending"), { http: 400 });

      await c.query(`update challenges set status='declined', updated_at=now() where id=$1`, [id]);
      return ch.from_id;
    });

    // Notify the challenger that their challenge was declined
    const declinerResult = await pool.query(`SELECT name FROM users WHERE id = $1`, [me]);
    const declinerName = declinerResult.rows[0]?.name || "A player";
    await sendPushNotification(
      fromId,
      "❌ Challenge Declined",
      `${declinerName} declined your challenge`,
      { type: "challenge_declined", challengeId: id }
    );

    res.json({ id, status: "declined" });
  })
);

/* Duplicate messaging endpoints removed - using the ones defined earlier in the file */

/* Duplicate /auth/dev route removed - using the one defined earlier in the file */





/* =========================
 * Error handler & Listen
 * =======================*/


// Helper to get or create a thread between two users
async function getOrCreateThread(userA: string, userB: string): Promise<string> {
  const [a, b] = [userA, userB].sort();

  // Try to find existing thread
  const existing = await pool.query(
    `SELECT id FROM threads WHERE user_a = $1 AND user_b = $2`,
    [a, b]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    return existing.rows[0].id;
  }

  // Create new thread
  const created = await pool.query(
    `INSERT INTO threads (user_a, user_b) VALUES ($1, $2) RETURNING id`,
    [a, b]
  );
  return created.rows[0].id;
}

// GET /messages/:userId/:otherUserId - Get messages between two users
app.get(
  "/messages/:userId/:otherUserId",
  asyncH(async (req, res) => {
    const { userId, otherUserId } = req.params;
    const [a, b] = [userId, otherUserId].sort();

    const sql = `
SELECT
m.id,
  m.from_id as "senderId",
  m.to_id as "receiverId",
  m.body as content,
  m.created_at as "createdAt",
  m.read
      FROM messages m
      JOIN threads t ON t.id = m.thread_id
      WHERE t.user_a = $1 AND t.user_b = $2
      ORDER BY m.created_at ASC
    `;

    const r = await pool.query(sql, [a, b]);

    // Mark messages as read if the current user is the receiver
    await pool.query(
      `UPDATE messages SET read = true 
       WHERE thread_id IN(SELECT id FROM threads WHERE user_a = $1 AND user_b = $2)
       AND to_id = $3 AND read = false`,
      [a, b, userId]
    );

    const messages = r.rows.map(row => ({
      id: row.id,
      senderId: row.senderId,
      receiverId: row.receiverId,
      content: row.content,
      createdAt: row.createdAt,
      isChallenge: false,
      challengeStatus: null,
    }));

    res.json(messages);
  })
);

// POST /messages - Send a message
app.post(
  "/messages",
  asyncH(async (req, res) => {
    const { senderId, receiverId, content, matchId } = req.body;

    if (!senderId || !receiverId || !content) {
      return res.status(400).json({ error: "missing_required_fields" });
    }

    // Get or create thread
    const threadId = await getOrCreateThread(senderId, receiverId);

    // Insert message
    const r = await pool.query(
      `INSERT INTO messages(thread_id, from_id, to_id, body)
VALUES($1, $2, $3, $4)
       RETURNING id, from_id as "senderId", to_id as "receiverId", body as content, created_at as "createdAt"`,
      [threadId, senderId, receiverId, content]
    );

    // Update thread's last_message_at
    await pool.query(
      `UPDATE threads SET last_message_at = NOW() WHERE id = $1`,
      [threadId]
    );

    const msg = r.rows[0];

    // Send push notification to receiver
    const senderResult = await pool.query(`SELECT name FROM users WHERE id = $1`, [senderId]);
    const senderName = senderResult.rows[0]?.name || "Someone";
    await sendPushNotification(
      receiverId,
      `💬 ${senderName}`,
      content.length > 50 ? content.substring(0, 50) + "..." : content,
      { type: "message", senderId, threadId }
    );

    res.status(201).json({
      id: msg.id,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      content: msg.content,
      createdAt: msg.createdAt,
      matchId: matchId || null,
      isChallenge: false,
      challengeStatus: null,
    });
  })
);

// GET /messages/challenges - Get pending challenges for a user
app.get(
  "/messages/challenges",
  asyncH(async (req, res) => {
    const userId = getUserId(req);

    const sql = `
SELECT
c.id,
  c.from_id as "senderId",
  c.to_id as "receiverId",
  c.message as content,
  c.status as "challengeStatus",
  c.created_at as "createdAt",
  u.id as "senderUserId",
  u.name as "senderName",
  u.avatar_url as "senderPhotoUrl",
  u.hoop_rank as "senderRating",
  u.position as "senderPosition"
      FROM challenges c
      JOIN users u ON u.id = c.from_id
      WHERE c.to_id = $1 AND c.status = 'pending'
      ORDER BY c.created_at DESC
    `;

    const r = await pool.query(sql, [userId]);

    const challenges = r.rows.map(row => ({
      message: {
        id: row.id,
        senderId: row.senderId,
        receiverId: row.receiverId,
        content: row.content || "Challenge!",
        createdAt: row.createdAt,
        isChallenge: true,
        challengeStatus: row.challengeStatus,
      },
      sender: {
        id: row.senderUserId,
        name: row.senderName,
        photoUrl: row.senderPhotoUrl,
        rating: Number(row.senderRating),
        position: row.senderPosition,
      }
    }));

    res.json(challenges);
  })
);

/* Duplicate /auth/dev route removed - using the one defined earlier in the file */

/* =========================
 * Error handler & Listen
 * =======================*/
app.use(((err: any, _req, res, _next) => {
  const http = err.http ?? 500;
  if (http >= 500) console.error(err);
  res.status(http).json({ error: err.message ?? "internal_error" });
}) as ErrorRequestHandler);

// Ensure follow tables exist (auto-migration)
async function ensureFollowTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_followed_courts (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        court_id TEXT NOT NULL,
        alerts_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, court_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_followed_players (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        player_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, player_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_followed_teams (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        team_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, team_id)
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_followed_courts_user ON user_followed_courts(user_id);
      CREATE INDEX IF NOT EXISTS idx_followed_players_user ON user_followed_players(user_id);
      CREATE INDEX IF NOT EXISTS idx_followed_teams_user ON user_followed_teams(user_id);
    `);

    // Team events tables (practices & games)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        event_date TIMESTAMPTZ NOT NULL,
        end_date TIMESTAMPTZ,
        location_name TEXT,
        court_id VARCHAR(255),
        opponent_team_id UUID,
        opponent_team_name TEXT,
        recurrence_rule TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_event_attendance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT DEFAULT 'in',
        responded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_events_team_id ON team_events(team_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_events_event_date ON team_events(event_date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_event_attendance_event_id ON team_event_attendance(event_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_team_event_attendance_user_id ON team_event_attendance(user_id)`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_team_event_attendance_unique ON team_event_attendance(event_id, user_id)`);

    console.log("✓ Follow tables ensured");
  } catch (e) {
    console.error("Error ensuring follow tables:", e);
  }
}

// Start server
ensureFollowTables().then(() => {
  app.listen(PORT, () => {
    console.log(`HoopRank API listening on http://0.0.0.0:${PORT}`);
  });
});

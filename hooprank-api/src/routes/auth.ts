// src/routes/auth.ts
// Authentication routes: /auth/*, /users/auth
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { asyncH, getUserId } from "../middleware/index.js";

const router = Router();

// Development auth schema
const DevAuthSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
});

const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * POST /auth/dev
 * Development-only endpoint for testing without Firebase
 */
router.post(
    "/auth/dev",
    asyncH(async (req, res) => {
        if (!IS_DEV) {
            return res.status(403).json({ error: "dev_only" });
        }
        const parsed = DevAuthSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() });
        }
        const { id, name } = parsed.data;

        // Upsert the test user
        await pool.query(
            `INSERT INTO users (id, name, hoop_rank, rating) 
       VALUES ($1, $2, 3.0, 3.0)
       ON CONFLICT (id) DO UPDATE SET name = $2, updated_at = now()`,
            [id, name]
        );

        const r = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
        const u = r.rows[0];

        const gamesPlayed = u.games_played || 0;
        const gamesContested = u.games_contested || 0;
        const contestRate = gamesPlayed > 0 ? gamesContested / gamesPlayed : 0;

        res.json({
            id: u.id,
            name: u.name,
            photoUrl: u.avatar_url,
            rating: Number(u.hoop_rank),
            position: u.position,
            matchesPlayed: gamesPlayed,
            gamesPlayed,
            gamesContested,
            contestRate,
        });
    })
);

/**
 * POST /users/auth
 * Social auth upsert from Firebase (Google/Facebook)
 */
router.post(
    "/users/auth",
    asyncH(async (req, res) => {
        const { id, email, name, photoUrl, provider } = req.body;
        const authHeader = req.headers.authorization;
        const authToken = authHeader ? authHeader.split(" ")[1] : null;

        if (!id) {
            return res.status(400).json({ error: "id_required" });
        }

        // Upsert the authenticated user
        await pool.query(
            `INSERT INTO users (id, email, name, avatar_url, auth_token, auth_provider, rating, hoop_rank)
       VALUES ($1, $2, $3, $4, $5, $6, 3.0, 3.0)
       ON CONFLICT (id) DO UPDATE SET
         email = COALESCE(EXCLUDED.email, users.email),
         name = COALESCE(EXCLUDED.name, users.name),
         avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
         auth_token = EXCLUDED.auth_token,
         auth_provider = EXCLUDED.auth_provider,
         updated_at = now()`,
            [id, email || null, name || null, photoUrl || null, authToken, provider || "unknown"]
        );

        // Ensure privacy record exists
        await pool.query(
            `INSERT INTO user_privacy (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
            [id]
        );

        // Return user data
        const r = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
        const u = r.rows[0];

        const gamesPlayed = u.games_played || 0;
        const gamesContested = u.games_contested || 0;
        const contestRate = gamesPlayed > 0 ? gamesContested / gamesPlayed : 0;

        res.json({
            id: u.id,
            name: u.name,
            photoUrl: u.avatar_url,
            rating: Number(u.hoop_rank),
            position: u.position,
            matchesPlayed: gamesPlayed,
            gamesPlayed,
            gamesContested,
            contestRate,
        });
    })
);

export default router;

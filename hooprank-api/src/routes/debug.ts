// src/routes/debug.ts
// Debug and diagnostic routes
import { Router } from "express";
import { pool } from "../db/index.js";
import { getUserId } from "../middleware/index.js";

const router = Router();

/**
 * GET /debug/db
 * Test database connectivity
 */
router.get("/debug/db", async (_req, res, next) => {
    try {
        const r = await pool.query(
            "SELECT now(), current_user, inet_server_addr()::text as server_ip"
        );
        res.json(r.rows[0]);
    } catch (e) {
        next(e);
    }
});

/**
 * GET /debug/whoami
 * Test CORS and user identification
 */
router.get("/debug/whoami", (req, res) => {
    let userId = null;
    try {
        userId = getUserId(req);
    } catch {
        // No user ID provided
    }

    res.json({
        origin: req.headers.origin ?? null,
        ip: req.ip,
        userId,
    });
});

export default router;

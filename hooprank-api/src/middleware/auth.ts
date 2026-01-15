// src/middleware/auth.ts
// Authentication middleware and user ID extraction
import type { Request } from "express";

/**
 * Extract user ID from request headers
 * Supports x-user-id header for authenticated requests
 */
export function getUserId(req: Request): string {
    const h = req.headers["x-user-id"];
    if (typeof h === "string" && h.length > 0) return h;
    throw Object.assign(new Error("missing_user_id"), { http: 401 });
}

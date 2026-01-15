// src/middleware/errorHandler.ts
// Error handling utilities and async handler wrapper
import type { Request, Response, NextFunction, RequestHandler } from "express";

// Type for async request handlers
type Handler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

/**
 * Wrap async handlers to properly catch and forward errors
 * Handles custom http status codes on error objects
 */
export function asyncH(fn: Handler): RequestHandler {
    return (req, res, next) => fn(req, res, next).catch(next);
}

/**
 * Global error handler middleware
 * Place at the end of middleware chain
 */
export const errorHandler = (
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction
) => {
    const status = typeof err?.http === "number" ? err.http : 500;
    console.error("API Error:", err);
    res.status(status).json({ error: err?.message ?? "internal_error" });
};

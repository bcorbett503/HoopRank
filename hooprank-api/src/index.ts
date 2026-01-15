// src/index.ts
// =============================================================================
// HoopRank API - Modular Entry Point
// =============================================================================
// This file serves as the new entry point using the modular architecture.
// The legacy server.ts remains available for backwards compatibility.
//
// Directory Structure:
//   src/
//   ├── index.ts           (this file - app setup and route registration)
//   ├── server.ts          (legacy monolithic file - being deprecated)
//   ├── db/                (database connection and transaction helpers)
//   ├── middleware/        (auth, error handling, request processing)
//   ├── routes/            (domain-specific route handlers)
//   ├── services/          (business logic and external integrations)
//   └── rating.ts          (rating algorithm - standalone module)
// =============================================================================

import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";

import { pool } from "./db/index.js";
import { errorHandler } from "./middleware/index.js";
import { initializeFirebase } from "./services/index.js";
import { authRoutes, debugRoutes } from "./routes/index.js";

// Initialize Firebase for push notifications
initializeFirebase();

const app = express();

/* =========================
 * CORS Configuration
 * =======================*/
app.use(
    cors({
        origin(origin, cb) {
            // Allow mobile apps (null origin) and development
            const allowed =
                !origin ||
                origin.includes("localhost") ||
                origin.includes("127.0.0.1") ||
                origin.includes("10.0.2.2");
            cb(null, allowed);
        },
        credentials: true,
        allowedHeaders: ["Content-Type", "x-user-id"],
    })
);

app.use(express.json());
app.use(morgan("dev"));

/* =========================
 * Route Registration
 * =========================
 * Routes are organized by domain. Static path segments MUST be
 * registered before parameterized routes to prevent shadowing.
 * See documentation in routes/matches.ts for detailed examples.
 */

// Auth routes: /auth/dev, /users/auth
app.use(authRoutes);

// Debug routes: /debug/*
app.use(debugRoutes);

// TODO: Add remaining route modules as they are extracted:
// app.use(usersRoutes);    // /users/nearby, /users/:id, /users
// app.use(matchesRoutes);  // /matches/*, match lifecycle
// app.use(messagesRoutes); // /messages/*, /challenges
// app.use(courtsRoutes);   // /courts/*, spatial queries
// app.use(activityRoutes); // /activity/*

// For now, legacy server.ts handles remaining routes
// This will be removed as routes are migrated

/* =========================
 * Error Handler
 * =======================*/
app.use(errorHandler);

/* =========================
 * Server Startup
 * =======================*/
const PORT = Number(process.env.PORT ?? 4000);

app.listen(PORT, "0.0.0.0", () => {
    console.log(`✓ HoopRank API (modular) listening on port ${PORT}`);
    pool.query("SELECT 1").then(() => {
        console.log("✓ Database connected");
    }).catch((err) => {
        console.error("✗ Database connection failed:", err.message);
    });
});

export default app;

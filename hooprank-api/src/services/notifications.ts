// src/services/notifications.ts
// Push notification service using Firebase Cloud Messaging
import { pool } from "../db/pool.js";

// Firebase Admin SDK - dynamically loaded
let firebaseAdmin: any = null;
let firebaseInitialized = false;

const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;

/**
 * Initialize Firebase Admin SDK for push notifications
 * Only initializes if service account credentials are provided
 */
export async function initializeFirebase(): Promise<void> {
    if (firebaseInitialized || !FIREBASE_SERVICE_ACCOUNT) return;

    try {
        const admin = await import("firebase-admin");
        firebaseAdmin = admin.default;

        const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
        firebaseAdmin.initializeApp({
            credential: firebaseAdmin.credential.cert(serviceAccount),
        });

        firebaseInitialized = true;
        console.log("Firebase Admin SDK initialized for push notifications");
    } catch (error) {
        console.error("Failed to initialize Firebase Admin SDK:", error);
    }
}

/**
 * Send a push notification to a specific user
 * Looks up the user's FCM token and sends via Firebase
 */
export async function sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>
): Promise<boolean> {
    if (!firebaseInitialized || !firebaseAdmin) {
        console.log("Push notification skipped - Firebase not initialized");
        return false;
    }

    try {
        // Get user's FCM token
        const result = await pool.query(
            `SELECT fcm_token FROM users WHERE id = $1`,
            [userId]
        );

        const fcmToken = result.rows[0]?.fcm_token;
        if (!fcmToken) {
            console.log(`No FCM token for user ${userId}`);
            return false;
        }

        // Send notification
        const message = {
            token: fcmToken,
            notification: { title, body },
            data: data || {},
            android: {
                priority: "high" as const,
                notification: {
                    sound: "default",
                    priority: "high" as const,
                },
            },
            apns: {
                payload: {
                    aps: {
                        badge: 1,
                        sound: "default",
                        "content-available": 1,
                    },
                },
            },
        };

        await firebaseAdmin.messaging().send(message);
        console.log(`Push sent to ${userId}: ${title}`);
        return true;
    } catch (error: any) {
        console.error(`Push notification failed for ${userId}:`, error?.message);

        // Clean up invalid tokens
        if (error?.code === "messaging/registration-token-not-registered") {
            await pool.query(`UPDATE users SET fcm_token = NULL WHERE id = $1`, [userId]);
            console.log(`Cleaned up invalid FCM token for ${userId}`);
        }
        return false;
    }
}

import { Module, Global, OnModuleInit, Inject, Optional } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

/**
 * Helper to normalize private key format
 * Railway and other platforms may store the key with various escape sequences
 */
function normalizePrivateKey(key: string | undefined): string | undefined {
    if (!key) return undefined;

    // Log the first 100 chars for debugging (obscures most of the key)
    console.log(`[Firebase] Raw private key preview: ${key.substring(0, 100)}...`);
    console.log(`[Firebase] Raw key length: ${key.length}`);

    // Handle JSON stringified format (key wrapped in quotes with escaped chars)
    if (key.startsWith('"') && key.endsWith('"')) {
        try {
            key = JSON.parse(key);
            console.log('[Firebase] Parsed JSON-wrapped private key');
        } catch (e) {
            // Not valid JSON, continue with original
        }
    }

    // Railway stores literal backslash-n as two characters: '\' followed by 'n'
    // We need to replace these with actual newline characters
    // Use split/join which is more reliable than regex for this case
    let normalized = (key as string)
        .split('\\n').join('\n');  // Replace literal \n with actual newline

    // Also handle double-escaped case (\\n becoming \n then newline)
    if (normalized.includes('\\n')) {
        normalized = normalized.split('\\n').join('\n');
    }

    // Count newlines to verify
    const newlineCount = (normalized.match(/\n/g) || []).length;
    console.log(`[Firebase] Normalized key has ${newlineCount} newlines`);
    console.log(`[Firebase] Normalized key preview: ${normalized.substring(0, 80).replace(/\n/g, '\\n')}...`);

    // Ensure proper PEM format with newlines
    if (newlineCount === 0) {
        // Key might be base64 without newlines, try to reconstruct
        console.log('[Firebase] Key appears to have no newlines, attempting to reconstruct PEM format');
        normalized = normalized
            .replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
            .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----\n');
    }

    return normalized;
}

@Global()
@Module({
    providers: [
        {
            provide: 'FIREBASE_APP',
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                // Check if already initialized (prevents re-initialization)
                if (admin.apps && admin.apps.length > 0) {
                    console.log('[Firebase] Already initialized, returning existing app');
                    return admin.apps[0];
                }

                const projectId = configService.get<string>('FIREBASE_PROJECT_ID');
                const clientEmail = configService.get<string>('FIREBASE_CLIENT_EMAIL');
                const privateKeyRaw = configService.get<string>('FIREBASE_PRIVATE_KEY');

                console.log(`[Firebase] Initializing with projectId=${projectId}, clientEmail=${clientEmail?.substring(0, 20)}...`);
                console.log(`[Firebase] privateKey length=${privateKeyRaw?.length || 0}, starts with -----BEGIN=${privateKeyRaw?.startsWith('-----BEGIN') || false}`);

                // Skip Firebase initialization only if using dev project or missing credentials
                if (projectId === 'hooprank-dev') {
                    console.log('[Firebase] Skipping initialization - dev project detected');
                    return null;
                }

                if (!privateKeyRaw || !clientEmail || !projectId) {
                    console.log('[Firebase] Skipping initialization - missing credentials');
                    return null;
                }

                const privateKey = normalizePrivateKey(privateKeyRaw);

                const firebaseConfig = {
                    projectId,
                    clientEmail,
                    privateKey,
                };

                try {
                    const app = admin.initializeApp({
                        credential: admin.credential.cert(firebaseConfig),
                    });
                    console.log('[Firebase] Successfully initialized Firebase Admin SDK');
                    return app;
                } catch (error) {
                    console.error('[Firebase] Failed to initialize:', error.message);
                    console.log('[Firebase] Falling back to dev-token authentication');
                    return null;
                }
            },
        },
    ],
    exports: ['FIREBASE_APP'],
})
export class FirebaseModule implements OnModuleInit {
    constructor(
        @Optional() @Inject('FIREBASE_APP') private firebaseApp: admin.app.App | null,
    ) { }

    onModuleInit() {
        // Force the provider to be initialized by accessing it
        if (this.firebaseApp) {
            console.log(`[Firebase] Module initialized with app: ${this.firebaseApp.name}`);
        } else {
            console.log('[Firebase] Module initialized but Firebase app is null (dev mode or init failed)');
        }
    }
}

import { Module, Global, OnModuleInit, Inject, Optional } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

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
                const privateKey = configService.get<string>('FIREBASE_PRIVATE_KEY');

                console.log(`[Firebase] Initializing with projectId=${projectId}, clientEmail=${clientEmail?.substring(0, 20)}...`);
                console.log(`[Firebase] privateKey length=${privateKey?.length || 0}, starts with -----BEGIN=${privateKey?.startsWith('-----BEGIN') || false}`);

                // Skip Firebase initialization only if using dev project or missing credentials
                if (projectId === 'hooprank-dev') {
                    console.log('[Firebase] Skipping initialization - dev project detected');
                    return null;
                }

                if (!privateKey || !clientEmail || !projectId) {
                    console.log('[Firebase] Skipping initialization - missing credentials');
                    return null;
                }

                const firebaseConfig = {
                    projectId,
                    clientEmail,
                    privateKey: privateKey?.replace(/\\n/g, '\n'),
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
            console.log('[Firebase] Module initialized but Firebase app is null (dev mode)');
        }
    }
}

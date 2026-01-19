import { Module, Global } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
    providers: [
        {
            provide: 'FIREBASE_APP',
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => {
                const projectId = configService.get<string>('FIREBASE_PROJECT_ID');
                const clientEmail = configService.get<string>('FIREBASE_CLIENT_EMAIL');
                const privateKey = configService.get<string>('FIREBASE_PRIVATE_KEY');

                // Skip Firebase initialization if using dev credentials
                if (projectId === 'hooprank-dev' || !privateKey || privateKey.includes('MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQD')) {
                    console.log('[Firebase] Skipping initialization - using dev-token authentication');
                    return null;
                }

                const firebaseConfig = {
                    projectId,
                    clientEmail,
                    privateKey: privateKey?.replace(/\\n/g, '\n'),
                };

                return admin.initializeApp({
                    credential: admin.credential.cert(firebaseConfig),
                });
            },
        },
    ],
    exports: ['FIREBASE_APP'],
})
export class FirebaseModule { }

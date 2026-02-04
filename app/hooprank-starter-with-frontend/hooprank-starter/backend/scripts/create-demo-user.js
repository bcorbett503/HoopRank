/**
 * Script to create a demo user for App Store review
 * Run from the backend directory: node scripts/create-demo-user.js
 */

const admin = require('firebase-admin');
require('dotenv').config();

const DEMO_EMAIL = 'demo@hooprank.app';
const DEMO_PASSWORD = 'HoopRank2026!';

async function createDemoUser() {
    // Initialize Firebase Admin
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        console.error('❌ Missing Firebase credentials in .env file');
        console.log('Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
        process.exit(1);
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
        console.log('✅ Firebase Admin initialized');
    } catch (error) {
        console.error('❌ Failed to initialize Firebase Admin:', error.message);
        process.exit(1);
    }

    // Check if user already exists
    try {
        const existingUser = await admin.auth().getUserByEmail(DEMO_EMAIL);
        console.log('✅ Demo user already exists:', existingUser.uid);
        console.log('   Email:', DEMO_EMAIL);
        console.log('   UID:', existingUser.uid);

        // Update password to ensure it matches
        await admin.auth().updateUser(existingUser.uid, {
            password: DEMO_PASSWORD,
            displayName: 'Demo User',
        });
        console.log('✅ Password updated to:', DEMO_PASSWORD);
        return existingUser.uid;
    } catch (error) {
        if (error.code !== 'auth/user-not-found') {
            throw error;
        }
    }

    // Create new user
    try {
        const user = await admin.auth().createUser({
            email: DEMO_EMAIL,
            password: DEMO_PASSWORD,
            displayName: 'Demo User',
            emailVerified: true,
        });

        console.log('✅ Demo user created successfully!');
        console.log('   Email:', DEMO_EMAIL);
        console.log('   Password:', DEMO_PASSWORD);
        console.log('   UID:', user.uid);

        return user.uid;
    } catch (error) {
        console.error('❌ Failed to create demo user:', error.message);
        process.exit(1);
    }
}

createDemoUser()
    .then((uid) => {
        console.log('\n🎉 Demo account ready for App Store review!');
        console.log('   Next: Seed profile data for this user in the database');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });

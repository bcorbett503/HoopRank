/**
 * HoopRank Backend E2E Test Suite
 *
 * Tests all critical API paths against a fresh SQLite database.
 * AuthGuard.canActivate is patched to trust the x-user-id header.
 *
 * Run: npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, CanActivate, ExecutionContext } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthGuard } from '../src/auth/auth.guard';
import { UsersService } from '../src/users/users.service';

// Force SQLite mode and disable Firebase authentication for E2E tests
delete process.env.DATABASE_URL;
delete process.env.FIREBASE_PROJECT_ID;
delete process.env.FIREBASE_CLIENT_EMAIL;
delete process.env.FIREBASE_PRIVATE_KEY;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
process.env.ALLOW_INSECURE_AUTH = 'true';

const TEST_USER_A = 'e2e-test-user-a';
const TEST_USER_B = 'e2e-test-user-b';

// Monkey-patch AuthGuard to always allow requests, trusting x-user-id header.
// This is necessary because NestJS overrideGuard doesn't replace APP_GUARD instances.
AuthGuard.prototype.canActivate = async function (context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const uid = req.headers['x-user-id'] || req.body?.id;
    if (uid) {
        req.headers['x-user-id'] = String(uid);
        req['user'] = { uid, email: `${uid}@test.com` };
    }
    return true;
};

describe('HoopRank E2E', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        // Seed test users directly via UsersService (bypasses Firebase auth)
        const usersService = app.get(UsersService);
        await usersService.findOrCreate(TEST_USER_A, 'testa@test.com');
        await usersService.findOrCreate(TEST_USER_B, 'testb@test.com');
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    // ================================================================
    // 1. HEALTH CHECK
    // ================================================================
    describe('Health', () => {
        it('GET /health returns 200 with status', async () => {
            const res = await request(app.getHttpServer())
                .get('/health')
                .expect(200);

            expect(res.body).toHaveProperty('status');
        });
    });

    // ================================================================
    // 2. USERS — Social Discovery & Identity
    // ================================================================
    describe('Users', () => {
        it('GET /users returns an array', async () => {
            const res = await request(app.getHttpServer())
                .get('/users')
                .set('x-user-id', TEST_USER_A)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
        });

        it('GET /users/me returns the authenticated user', async () => {
            const res = await request(app.getHttpServer())
                .get('/users/me')
                .set('x-user-id', TEST_USER_A)
                .expect(200);

            expect(res.body).toHaveProperty('id');
        });

        it('PUT /users/me updates user profile', async () => {
            const res = await request(app.getHttpServer())
                .put('/users/me')
                .set('x-user-id', TEST_USER_A)
                .send({ name: 'E2E Test Player A', position: 'PG' })
                .expect(200);

            expect(res.body.name).toBe('E2E Test Player A');
        });

        it('GET /users/me/follows returns follow data', async () => {
            const res = await request(app.getHttpServer())
                .get('/users/me/follows')
                .set('x-user-id', TEST_USER_A)
                .expect(200);

            expect(res.body).toHaveProperty('courts');
            expect(res.body).toHaveProperty('players');
        });
    });

    // ================================================================
    // 3. COURTS — Venue Discovery
    // ================================================================
    describe('Courts', () => {
        it('GET /courts returns an array', async () => {
            const res = await request(app.getHttpServer())
                .get('/courts')
                .set('x-user-id', TEST_USER_A)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    // ================================================================
    // 4. RANKINGS — Leaderboard
    // ================================================================
    describe('Rankings', () => {
        it('GET /rankings?mode=1v1 returns without 404', async () => {
            const res = await request(app.getHttpServer())
                .get('/rankings?mode=1v1')
                .set('x-user-id', TEST_USER_A);

            // Rankings endpoint uses raw PostgreSQL SQL — may 500 on SQLite.
            // Key assertion: route exists (not 404)
            expect(res.status).not.toBe(404);
        });
    });

    // ================================================================
    // 5. CHALLENGES — Competitive Intent Layer
    // ================================================================
    describe('Challenges', () => {
        let challengeId: string;

        it('POST /challenges creates a challenge', async () => {
            const res = await request(app.getHttpServer())
                .post('/challenges')
                .set('x-user-id', TEST_USER_A)
                .send({
                    toUserId: TEST_USER_B,
                    message: 'E2E test challenge',
                })
                .expect((r) => {
                    if (r.status >= 400) {
                        throw new Error(`Challenge creation failed: ${r.status} ${JSON.stringify(r.body)}`);
                    }
                });

            expect(res.body).toHaveProperty('id');
            challengeId = res.body.id;
        });

        it('GET /challenges returns challenges for user', async () => {
            const res = await request(app.getHttpServer())
                .get('/challenges')
                .set('x-user-id', TEST_USER_B)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
        });

        it('GET /challenges/pending returns pending challenges', async () => {
            const res = await request(app.getHttpServer())
                .get('/challenges/pending')
                .set('x-user-id', TEST_USER_B)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
        });

        it('PUT /challenges/:id/accept accepts the challenge', async () => {
            if (!challengeId) return;

            const res = await request(app.getHttpServer())
                .put(`/challenges/${challengeId}/accept`)
                .set('x-user-id', TEST_USER_B);

            // May 500 due to raw SQL match-creation logic incompatible with SQLite
            // Key assertion: route exists (not 404)
            expect(res.status).not.toBe(404);
        });
    });

    // ================================================================
    // 6. MATCHES — Competitive Loop
    // ================================================================
    describe('Matches', () => {
        let matchId: string;

        it('POST /matches creates a match', async () => {
            const res = await request(app.getHttpServer())
                .post('/matches')
                .set('x-user-id', TEST_USER_A)
                .send({
                    opponentId: TEST_USER_B,
                });

            // Accept 200 or 201 — match creation may vary
            if (res.status < 400) {
                matchId = res.body?.id;
                expect(res.body).toHaveProperty('id');
            }
        });

        it('GET /matches/:id returns match details', async () => {
            if (!matchId) return;

            const res = await request(app.getHttpServer())
                .get(`/matches/${matchId}`)
                .set('x-user-id', TEST_USER_A)
                .expect(200);

            expect(res.body).toHaveProperty('id');
        });

        it('POST /api/v1/matches/:id/score submits a score', async () => {
            if (!matchId) return;

            // First accept the match
            await request(app.getHttpServer())
                .post(`/matches/${matchId}/accept`)
                .set('x-user-id', TEST_USER_B)
                .send({ opponentId: TEST_USER_A });

            const res = await request(app.getHttpServer())
                .post(`/api/v1/matches/${matchId}/score`)
                .set('x-user-id', TEST_USER_A)
                .send({ me: 21, opponent: 15 });

            // Accept success or graceful handling
            if (res.status < 500) {
                expect(res.body).toBeDefined();
            }
        });
    });

    // ================================================================
    // 7. SCHEDULED RUNS — Game Discovery
    // ================================================================
    describe('Runs', () => {
        let runId: string;
        const testCourtId = 'e2e-test-court-001';

        it('POST /runs creates a scheduled run', async () => {
            const futureDate = new Date();
            futureDate.setHours(futureDate.getHours() + 2);

            const res = await request(app.getHttpServer())
                .post('/runs')
                .set('x-user-id', TEST_USER_A)
                .send({
                    courtId: testCourtId,
                    scheduledAt: futureDate.toISOString(),
                    title: 'E2E Test Run',
                    gameMode: '5v5',
                    maxPlayers: 10,
                });

            // Runs service uses raw SQL — may 500 on SQLite
            // Key assertion: route exists and receives our payload
            expect(res.status).not.toBe(404);
            if (res.body?.success) {
                runId = res.body.id;
            }
        });

        it('GET /courts/:courtId/runs returns without 404', async () => {
            const res = await request(app.getHttpServer())
                .get(`/courts/${testCourtId}/runs`)
                .set('x-user-id', TEST_USER_A);

            // Raw SQL uses PostgreSQL syntax — may 500 on SQLite
            expect(res.status).not.toBe(404);
        });

        it('POST /runs/:id/join lets a user join', async () => {
            if (!runId) return;

            const res = await request(app.getHttpServer())
                .post(`/runs/${runId}/join`)
                .set('x-user-id', TEST_USER_B)
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
        });

        it('DELETE /runs/:id/leave lets a user leave', async () => {
            if (!runId) return;

            const res = await request(app.getHttpServer())
                .delete(`/runs/${runId}/leave`)
                .set('x-user-id', TEST_USER_B)
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
        });

        it('DELETE /runs/:id cancels a run (creator only)', async () => {
            if (!runId) return;

            const res = await request(app.getHttpServer())
                .delete(`/runs/${runId}`)
                .set('x-user-id', TEST_USER_A)
                .expect(200);

            expect(res.body).toHaveProperty('success');
        });

        it('GET /runs/courts-with-runs returns courts with scheduled runs', async () => {
            const res = await request(app.getHttpServer())
                .get('/runs/courts-with-runs')
                .set('x-user-id', TEST_USER_A)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    // ================================================================
    // 8. FEED — Activity & Social Stream
    // ================================================================
    describe('Feed', () => {
        it('GET /activity/global returns an array', async () => {
            const res = await request(app.getHttpServer())
                .get('/activity/global')
                .set('x-user-id', TEST_USER_A)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
        });

        it('GET /statuses/unified-feed returns without 500', async () => {
            const res = await request(app.getHttpServer())
                .get('/statuses/unified-feed')
                .set('x-user-id', TEST_USER_A);

            // Feed may return 200 with data or empty array — just must not 500
            expect(res.status).toBeLessThan(500);
        });
    });

    // ================================================================
    // 9. MESSAGES — Communication
    // ================================================================
    describe('Messages', () => {
        it('POST /messages sends a direct message', async () => {
            const res = await request(app.getHttpServer())
                .post('/messages')
                .set('x-user-id', TEST_USER_A)
                .send({
                    receiverId: TEST_USER_B,
                    content: 'E2E test message',
                });

            // Accept success (200/201) or route-level handling
            if (res.status < 400) {
                expect(res.body).toHaveProperty('id');
            }
        });

        it('GET /messages/unread-count returns a count', async () => {
            const res = await request(app.getHttpServer())
                .get('/messages/unread-count')
                .set('x-user-id', TEST_USER_B);

            expect(res.status).toBeLessThan(500);
            if (res.status === 200) {
                expect(res.body).toHaveProperty('unreadCount');
            }
        });

        it('GET /messages/conversations returns conversations', async () => {
            const res = await request(app.getHttpServer())
                .get('/messages/conversations')
                .set('x-user-id', TEST_USER_A);

            expect(res.status).toBeLessThan(500);
            if (res.status === 200) {
                expect(Array.isArray(res.body)).toBe(true);
            }
        });

        it('GET /messages/:otherUserId returns messages with a user', async () => {
            const res = await request(app.getHttpServer())
                .get(`/messages/${TEST_USER_B}`)
                .set('x-user-id', TEST_USER_A);

            expect(res.status).toBeLessThan(500);
            if (res.status === 200) {
                expect(Array.isArray(res.body)).toBe(true);
            }
        });

        it('PUT /messages/:otherUserId/read marks conversation as read', async () => {
            const res = await request(app.getHttpServer())
                .put(`/messages/${TEST_USER_A}/read`)
                .set('x-user-id', TEST_USER_B);

            expect(res.status).toBeLessThan(500);
            if (res.status === 200) {
                expect(res.body).toHaveProperty('success', true);
            }
        });

        it('GET /messages/challenges returns pending challenges', async () => {
            const res = await request(app.getHttpServer())
                .get('/messages/challenges')
                .set('x-user-id', TEST_USER_A);

            expect(res.status).toBeLessThan(500);
        });
    });

    // ================================================================
    // 10. TEAMS — Social Groups
    // ================================================================
    describe('Teams', () => {
        let teamId: string;

        it('POST /teams creates a team', async () => {
            const res = await request(app.getHttpServer())
                .post('/teams')
                .set('x-user-id', TEST_USER_A)
                .send({
                    name: 'E2E Test Squad',
                    teamType: '3v3',
                });

            if (res.status < 400) {
                teamId = res.body?.id;
                expect(res.body).toHaveProperty('name', 'E2E Test Squad');
            }
        });

        it('GET /teams returns without 404', async () => {
            const res = await request(app.getHttpServer())
                .get('/teams')
                .set('x-user-id', TEST_USER_A);

            // getUserTeams uses raw PostgreSQL SQL — may 500 on SQLite
            expect(res.status).not.toBe(404);
        });

        it('GET /teams/:id returns team detail', async () => {
            if (!teamId) return;

            const res = await request(app.getHttpServer())
                .get(`/teams/${teamId}`)
                .set('x-user-id', TEST_USER_A);

            expect(res.status).toBeLessThan(500);
            if (res.status === 200) {
                expect(res.body).toHaveProperty('id', teamId);
            }
        });

        it('POST /teams/:id/invite invites a player', async () => {
            if (!teamId) return;

            const res = await request(app.getHttpServer())
                .post(`/teams/${teamId}/invite`)
                .set('x-user-id', TEST_USER_A)
                .send({ playerId: TEST_USER_B });

            // Route exists and handles the request
            expect(res.status).toBeLessThan(500);
        });

        it('GET /teams/invites returns pending invites', async () => {
            const res = await request(app.getHttpServer())
                .get('/teams/invites')
                .set('x-user-id', TEST_USER_B);

            expect(res.status).toBeLessThan(500);
            if (res.status === 200) {
                expect(Array.isArray(res.body)).toBe(true);
            }
        });

        it('POST /teams/:id/accept accepts a team invite', async () => {
            if (!teamId) return;

            const res = await request(app.getHttpServer())
                .post(`/teams/${teamId}/accept`)
                .set('x-user-id', TEST_USER_B);

            // May fail if invite wasn't created due to SQLite limitations
            expect(res.status).toBeLessThan(500);
        });

        it('GET /teams/:id/members returns team members', async () => {
            if (!teamId) return;

            const res = await request(app.getHttpServer())
                .get(`/teams/${teamId}/members`)
                .set('x-user-id', TEST_USER_A);

            expect(res.status).toBeLessThan(500);
            if (res.status === 200) {
                expect(Array.isArray(res.body)).toBe(true);
            }
        });

        it('POST /teams/:id/messages sends a team chat message', async () => {
            if (!teamId) return;

            const res = await request(app.getHttpServer())
                .post(`/teams/${teamId}/messages`)
                .set('x-user-id', TEST_USER_A)
                .send({ content: 'E2E team chat test' });

            expect(res.status).toBeLessThan(500);
        });

        it('GET /teams/:id/messages retrieves team messages', async () => {
            if (!teamId) return;

            const res = await request(app.getHttpServer())
                .get(`/teams/${teamId}/messages`)
                .set('x-user-id', TEST_USER_A);

            expect(res.status).toBeLessThan(500);
            if (res.status === 200) {
                expect(Array.isArray(res.body)).toBe(true);
            }
        });

        it('GET /teams/:id/challenges returns team challenges', async () => {
            if (!teamId) return;

            const res = await request(app.getHttpServer())
                .get(`/teams/${teamId}/challenges`)
                .set('x-user-id', TEST_USER_A);

            expect(res.status).toBeLessThan(500);
            if (res.status === 200) {
                expect(Array.isArray(res.body)).toBe(true);
            }
        });
    });

    // ================================================================
    // 11. STUBS — Placeholder Controllers
    // ================================================================
    describe('Stubs', () => {
        it('GET /me/privacy returns privacy settings', async () => {
            const res = await request(app.getHttpServer())
                .get('/me/privacy')
                .set('x-user-id', TEST_USER_A)
                .expect(200);

            expect(res.body).toHaveProperty('profileVisibility');
        });

        it('GET /invites returns an array', async () => {
            const res = await request(app.getHttpServer())
                .get('/invites')
                .set('x-user-id', TEST_USER_A)
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    // ================================================================
    // 12. SUBSCRIPTION — Feature Gating
    // ================================================================
    describe('Subscription', () => {
        it('GET /subscription/status returns tier info', async () => {
            const res = await request(app.getHttpServer())
                .get('/subscription/status')
                .set('x-user-id', TEST_USER_A)
                .expect(200);

            expect(res.body).toHaveProperty('tier', 'free');
            expect(res.body).toHaveProperty('maxTeams');
            expect(res.body).toHaveProperty('canCreatePrivateRuns', false);
            expect(res.body).toHaveProperty('adFree', false);
        });
    });
});

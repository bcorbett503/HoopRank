import { MatchesService } from './matches.service';

/**
 * Unit tests for MatchesService.
 * Tests the SQLite/TypeORM code path (no DATABASE_URL set)
 * and PostgreSQL-only methods via raw DataSource mocking.
 */
describe('MatchesService', () => {
    let service: MatchesService;
    let mockRepo: any;
    let mockUsers: any;
    let mockDataSource: any;
    let mockNotifications: any;

    beforeEach(() => {
        delete process.env.DATABASE_URL;

        mockRepo = {
            create: jest.fn().mockImplementation((data) => ({ id: 'match-1', ...data })),
            save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
        };

        mockUsers = {
            get: jest.fn(),
            setRating: jest.fn(),
        };

        mockDataSource = {
            query: jest.fn().mockResolvedValue([]),
        };

        mockNotifications = {
            sendScoreSubmittedNotification: jest.fn().mockResolvedValue(undefined),
            sendScoreContestedNotification: jest.fn().mockResolvedValue(undefined),
            sendMatchNotification: jest.fn().mockResolvedValue(undefined),
        };

        service = new MatchesService(mockRepo, mockUsers, mockDataSource, mockNotifications);
    });

    // ------------------------------------------------------------------
    //  create
    // ------------------------------------------------------------------
    describe('create', () => {
        it('should create a match with pending status', async () => {
            const result = await service.create('user-a', 'user-b');

            expect(mockRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    creatorId: 'user-a',
                    opponentId: 'user-b',
                    status: 'pending',
                    matchType: '1v1',
                }),
            );
            expect(mockRepo.save).toHaveBeenCalled();
            expect(result).toHaveProperty('id');
        });

        it('should handle missing opponentId', async () => {
            const result = await service.create('user-a');

            expect(mockRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    creatorId: 'user-a',
                    opponentId: undefined,
                }),
            );
            expect(result).toHaveProperty('id');
        });

        it('should include courtId when provided', async () => {
            await service.create('user-a', 'user-b', 'court-1');

            expect(mockRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({ courtId: 'court-1' }),
            );
        });
    });

    // ------------------------------------------------------------------
    //  accept
    // ------------------------------------------------------------------
    describe('accept', () => {
        it('should set status to accepted', async () => {
            const match = { id: 'match-1', status: 'pending', creatorId: 'user-a' };
            mockRepo.findOne.mockResolvedValueOnce({ ...match });
            mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

            const result = await service.accept('match-1', 'user-b');

            expect(result.status).toBe('accepted');
        });
    });

    // ------------------------------------------------------------------
    //  submitScoreOnly (PostgreSQL-only)
    // ------------------------------------------------------------------
    describe('submitScoreOnly', () => {
        it('should reject if not on PostgreSQL', async () => {
            await expect(
                service.submitScoreOnly('match-1', 'user-a', 21, 15),
            ).rejects.toThrow('Only supported on PostgreSQL');
        });

        it('should store scores and set status on PostgreSQL', async () => {
            process.env.DATABASE_URL = 'postgres://test';

            const match = {
                id: 'match-1',
                status: 'accepted',
                creator_id: 'user-a',
                opponent_id: 'user-b',
            };

            // get() returns via raw query
            mockDataSource.query
                .mockResolvedValueOnce([match])   // get() → SELECT
                .mockResolvedValueOnce([])          // UPDATE
                .mockResolvedValueOnce([{ name: 'Player A' }]) // submitter name
                .mockResolvedValueOnce([{ ...match, status: 'score_submitted', score_creator: 21, score_opponent: 15 }]); // final SELECT

            const result = await service.submitScoreOnly('match-1', 'user-a', 21, 15);

            expect(result.status).toBe('score_submitted');
            expect((result as any).score_creator).toBe(21);
        });

        it('should reject non-participants', async () => {
            process.env.DATABASE_URL = 'postgres://test';

            const match = {
                id: 'match-1',
                status: 'accepted',
                creator_id: 'user-a',
                opponent_id: 'user-b',
            };

            mockDataSource.query.mockResolvedValueOnce([match]);

            await expect(
                service.submitScoreOnly('match-1', 'user-c', 21, 15),
            ).rejects.toThrow('You are not a participant');
        });

        it('should reject score submission on completed matches', async () => {
            process.env.DATABASE_URL = 'postgres://test';

            const match = {
                id: 'match-1',
                status: 'completed',
                creator_id: 'user-a',
                opponent_id: 'user-b',
            };

            mockDataSource.query.mockResolvedValueOnce([match]);

            await expect(
                service.submitScoreOnly('match-1', 'user-a', 21, 15),
            ).rejects.toThrow("Cannot submit score while match status is 'completed'");
        });

        it('should notify the other player after score submission', async () => {
            process.env.DATABASE_URL = 'postgres://test';

            const match = {
                id: 'match-1',
                status: 'accepted',
                creator_id: 'user-a',
                opponent_id: 'user-b',
            };

            mockDataSource.query
                .mockResolvedValueOnce([match])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ name: 'Player A' }])
                .mockResolvedValueOnce([{ ...match, status: 'score_submitted' }]);

            await service.submitScoreOnly('match-1', 'user-a', 21, 15);

            expect(mockNotifications.sendScoreSubmittedNotification).toHaveBeenCalledWith(
                'user-b', // the OTHER player
                'Player A',
                21,
                15,
                'match-1',
            );
        });
    });

    // ------------------------------------------------------------------
    //  confirmScore (PostgreSQL-only)
    // ------------------------------------------------------------------
    describe('confirmScore', () => {
        it('should reject if not on PostgreSQL', async () => {
            await expect(
                service.confirmScore('match-1', 'user-b'),
            ).rejects.toThrow('Only supported on PostgreSQL');
        });

        it('should reject if match is not score_submitted', async () => {
            process.env.DATABASE_URL = 'postgres://test';

            const match = { id: 'match-1', status: 'accepted', creator_id: 'user-a', opponent_id: 'user-b' };
            mockDataSource.query.mockResolvedValueOnce([match]);

            await expect(
                service.confirmScore('match-1', 'user-b'),
            ).rejects.toThrow("expected 'score_submitted'");
        });

        it('should reject if submitter tries to confirm own score', async () => {
            process.env.DATABASE_URL = 'postgres://test';

            const match = {
                id: 'match-1',
                status: 'score_submitted',
                creator_id: 'user-a',
                opponent_id: 'user-b',
                score_submitter_id: 'user-a',
                score_creator: 21,
                score_opponent: 15,
            };

            mockDataSource.query.mockResolvedValueOnce([match]);

            await expect(
                service.confirmScore('match-1', 'user-a'),
            ).rejects.toThrow('only the other player can confirm');
        });
    });

    // ------------------------------------------------------------------
    //  contestScore (PostgreSQL-only)
    // ------------------------------------------------------------------
    describe('contestScore', () => {
        it('should reject if not on PostgreSQL', async () => {
            await expect(
                service.contestScore('match-1', 'user-b'),
            ).rejects.toThrow('Only supported on PostgreSQL');
        });

        it('should reject if submitter tries to contest own score', async () => {
            process.env.DATABASE_URL = 'postgres://test';

            const match = {
                id: 'match-1',
                status: 'score_submitted',
                creator_id: 'user-a',
                opponent_id: 'user-b',
                score_submitter_id: 'user-a',
            };

            mockDataSource.query.mockResolvedValueOnce([match]);

            await expect(
                service.contestScore('match-1', 'user-a'),
            ).rejects.toThrow('cannot contest your own submission');
        });

        it('should void the match and clear scores on contest', async () => {
            process.env.DATABASE_URL = 'postgres://test';

            const match = {
                id: 'match-1',
                status: 'score_submitted',
                creator_id: 'user-a',
                opponent_id: 'user-b',
                score_submitter_id: 'user-a',
            };

            mockDataSource.query
                .mockResolvedValueOnce([match])     // get()
                .mockResolvedValueOnce([])            // UPDATE (void match)
                .mockResolvedValueOnce([])            // UPDATE users (games_contested)
                .mockResolvedValueOnce([{ name: 'Player B' }]) // contester name
                .mockResolvedValueOnce([{ ...match, status: 'contested' }]); // final SELECT

            const result = await service.contestScore('match-1', 'user-b');

            expect(result.status).toBe('contested');
            // Verify scores were cleared in the UPDATE
            const updateCall = mockDataSource.query.mock.calls[1];
            expect(updateCall[0]).toContain('score_creator = NULL');
            expect(updateCall[0]).toContain('score_opponent = NULL');
        });

        it('should send notification to submitter about contest', async () => {
            process.env.DATABASE_URL = 'postgres://test';

            const match = {
                id: 'match-1',
                status: 'score_submitted',
                creator_id: 'user-a',
                opponent_id: 'user-b',
                score_submitter_id: 'user-a',
            };

            mockDataSource.query
                .mockResolvedValueOnce([match])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ name: 'Player B' }])
                .mockResolvedValueOnce([{ ...match, status: 'contested' }]);

            await service.contestScore('match-1', 'user-b');

            expect(mockNotifications.sendScoreContestedNotification).toHaveBeenCalledWith(
                'user-a', // the submitter
                'Player B',
                'match-1',
            );
        });
    });

    // ------------------------------------------------------------------
    //  get
    // ------------------------------------------------------------------
    describe('get', () => {
        it('should return a match by id (SQLite)', async () => {
            const match = { id: 'match-1', status: 'pending' };
            mockRepo.findOne.mockResolvedValueOnce(match);

            const result = await service.get('match-1');

            expect(result).toEqual(match);
        });

        it('should return undefined if not found', async () => {
            mockRepo.findOne.mockResolvedValueOnce(null);

            const result = await service.get('match-999');

            expect(result).toBeUndefined();
        });
    });

    // ------------------------------------------------------------------
    //  findByCourt
    // ------------------------------------------------------------------
    describe('findByCourt', () => {
        it('should return matches for a court (SQLite)', async () => {
            const matches = [{ id: 'match-1' }, { id: 'match-2' }];
            mockRepo.find.mockResolvedValueOnce(matches);

            const result = await service.findByCourt('court-1');

            expect(result).toHaveLength(2);
        });
    });
});

import { HttpException, HttpStatus } from '@nestjs/common';
import { ChallengesService } from './challenges.service';

/**
 * Unit tests for ChallengesService.
 * Tests the SQLite/TypeORM code path (no DATABASE_URL set).
 */
describe('ChallengesService', () => {
    let service: ChallengesService;
    let mockRepo: any;
    let mockDataSource: any;
    let mockNotifications: any;

    beforeEach(() => {
        // Reset env to ensure SQLite path
        delete process.env.DATABASE_URL;

        mockRepo = {
            create: jest.fn().mockImplementation((data) => ({ ...data })),
            save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
            findOne: jest.fn(),
            count: jest.fn(),
        };

        mockDataSource = {
            query: jest.fn().mockResolvedValue([]),
        };

        mockNotifications = {
            sendChallengeNotification: jest.fn().mockResolvedValue(undefined),
        };

        service = new ChallengesService(mockRepo, mockDataSource, mockNotifications);
    });

    // ------------------------------------------------------------------
    //  create
    // ------------------------------------------------------------------
    describe('create', () => {
        it('should create a challenge with default message', async () => {
            const result = await service.create('user-a', 'user-b');

            expect(mockRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    fromUserId: 'user-a',
                    toUserId: 'user-b',
                    status: 'pending',
                    message: 'Want to play?',
                }),
            );
            expect(mockRepo.save).toHaveBeenCalled();
            expect(result).toHaveProperty('fromUserId', 'user-a');
        });

        it('should use custom message when provided', async () => {
            await service.create('user-a', 'user-b', 'Let\'s go!');

            expect(mockRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Let\'s go!' }),
            );
        });

        it('should send a notification to the recipient', async () => {
            // getUserName returns via raw SQL, mock that
            mockDataSource.query.mockResolvedValueOnce([{ name: 'Player A' }]);

            await service.create('user-a', 'user-b');

            expect(mockNotifications.sendChallengeNotification).toHaveBeenCalledWith(
                'user-b',
                expect.any(String),
                'received',
                expect.any(String),
            );
        });

        it('should pass courtId when provided', async () => {
            await service.create('user-a', 'user-b', undefined, 'court-1');

            expect(mockRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({ courtId: 'court-1' }),
            );
        });
    });

    // ------------------------------------------------------------------
    //  accept
    // ------------------------------------------------------------------
    describe('accept', () => {
        const pendingChallenge = {
            id: 'chal-1',
            fromUserId: 'user-a',
            toUserId: 'user-b',
            status: 'pending',
            matchId: null,
        };

        it('should accept a pending challenge and create a match', async () => {
            mockRepo.findOne.mockResolvedValueOnce({ ...pendingChallenge });
            mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));
            mockDataSource.query.mockResolvedValueOnce([{ name: 'Player B' }]);

            const result = await service.accept('chal-1', 'user-b');

            expect(result.challenge.status).toBe('accepted');
            expect(result.matchId).toBeDefined();
        });

        it('should reject if user is not the recipient', async () => {
            mockRepo.findOne.mockResolvedValueOnce({ ...pendingChallenge });

            await expect(service.accept('chal-1', 'user-a')).rejects.toThrow(HttpException);
        });

        it('should reject if challenge is not pending', async () => {
            mockRepo.findOne.mockResolvedValueOnce({ ...pendingChallenge, status: 'declined' });

            await expect(service.accept('chal-1', 'user-b')).rejects.toThrow(HttpException);
        });

        it('should throw 404 if challenge not found', async () => {
            mockRepo.findOne.mockResolvedValueOnce(null);

            await expect(service.accept('chal-999', 'user-b')).rejects.toThrow(HttpException);
        });

        it('should send notification to challenger on accept', async () => {
            mockRepo.findOne.mockResolvedValueOnce({ ...pendingChallenge });
            mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));
            mockDataSource.query.mockResolvedValueOnce([{ name: 'Player B' }]);

            await service.accept('chal-1', 'user-b');

            expect(mockNotifications.sendChallengeNotification).toHaveBeenCalledWith(
                'user-a', // fromUserId
                'Player B',
                'accepted',
                'chal-1',
            );
        });
    });

    // ------------------------------------------------------------------
    //  decline
    // ------------------------------------------------------------------
    describe('decline', () => {
        const pendingChallenge = {
            id: 'chal-1',
            fromUserId: 'user-a',
            toUserId: 'user-b',
            status: 'pending',
        };

        it('should decline a pending challenge', async () => {
            mockRepo.findOne.mockResolvedValueOnce({ ...pendingChallenge });
            mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));
            mockDataSource.query.mockResolvedValueOnce([{ name: 'Player B' }]);

            const result = await service.decline('chal-1', 'user-b');

            expect(result.status).toBe('declined');
        });

        it('should reject if user is not the recipient', async () => {
            mockRepo.findOne.mockResolvedValueOnce({ ...pendingChallenge });

            await expect(service.decline('chal-1', 'user-a')).rejects.toThrow(HttpException);
        });

        it('should throw 404 if challenge not found', async () => {
            mockRepo.findOne.mockResolvedValueOnce(null);

            await expect(service.decline('chal-999', 'user-b')).rejects.toThrow(HttpException);
        });
    });

    // ------------------------------------------------------------------
    //  cancel
    // ------------------------------------------------------------------
    describe('cancel', () => {
        const pendingChallenge = {
            id: 'chal-1',
            fromUserId: 'user-a',
            toUserId: 'user-b',
            status: 'pending',
        };

        it('should cancel a challenge from the sender', async () => {
            mockRepo.findOne.mockResolvedValueOnce({ ...pendingChallenge });
            mockRepo.save.mockImplementation((entity) => Promise.resolve(entity));

            const result = await service.cancel('chal-1', 'user-a');

            expect(result.status).toBe('cancelled');
        });

        it('should reject if user is not the sender', async () => {
            mockRepo.findOne.mockResolvedValueOnce({ ...pendingChallenge });

            await expect(service.cancel('chal-1', 'user-b')).rejects.toThrow(HttpException);
        });

        it('should throw 404 if challenge not found', async () => {
            mockRepo.findOne.mockResolvedValueOnce(null);

            await expect(service.cancel('chal-999', 'user-a')).rejects.toThrow(HttpException);
        });
    });

    // ------------------------------------------------------------------
    //  hasActiveChallenge
    // ------------------------------------------------------------------
    describe('hasActiveChallenge', () => {
        it('should return true when pending/accepted challenges exist', async () => {
            mockRepo.count.mockResolvedValueOnce(1);

            const result = await service.hasActiveChallenge('user-a', 'user-b');

            expect(result).toBe(true);
        });

        it('should return false when no active challenges', async () => {
            mockRepo.count.mockResolvedValueOnce(0);

            const result = await service.hasActiveChallenge('user-a', 'user-b');

            expect(result).toBe(false);
        });

        it('should check both directions (A→B and B→A)', async () => {
            mockRepo.count.mockResolvedValueOnce(0);

            await service.hasActiveChallenge('user-a', 'user-b');

            // Verify .count was called with where conditions covering both directions
            const whereArg = mockRepo.count.mock.calls[0][0].where;
            expect(whereArg).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ fromUserId: 'user-a', toUserId: 'user-b' }),
                    expect.objectContaining({ fromUserId: 'user-b', toUserId: 'user-a' }),
                ]),
            );
        });
    });
});

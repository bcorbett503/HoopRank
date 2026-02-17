import { MessagesService } from './messages.service';

/**
 * Unit tests for MessagesService.
 * Tests the SQLite/TypeORM code path (no DATABASE_URL set)
 * and select PostgreSQL-only methods via raw DataSource mocking.
 */
describe('MessagesService', () => {
    let service: MessagesService;
    let mockRepo: any;
    let mockDataSource: any;
    let mockNotifications: any;

    beforeEach(() => {
        delete process.env.DATABASE_URL;

        mockRepo = {
            create: jest.fn().mockImplementation((data) => ({ id: 'msg-1', ...data })),
            save: jest.fn().mockImplementation((entity) => {
                return Promise.resolve(Array.isArray(entity) ? entity : entity);
            }),
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(0),
        };

        mockDataSource = {
            query: jest.fn().mockResolvedValue([]),
        };

        mockNotifications = {
            sendMessageNotification: jest.fn().mockResolvedValue(undefined),
            sendChallengeNotification: jest.fn().mockResolvedValue(undefined),
        };

        service = new MessagesService(mockRepo, mockDataSource, mockNotifications);
    });

    // ------------------------------------------------------------------
    //  sendMessage
    // ------------------------------------------------------------------
    describe('sendMessage', () => {
        it('should create a regular message via repository', async () => {
            const result = await service.sendMessage('user-a', 'user-b', 'Hello!');

            expect(mockRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    fromId: 'user-a',
                    toId: 'user-b',
                    body: 'Hello!',
                    isChallenge: false,
                }),
            );
            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('should set challenge fields when isChallenge is true', async () => {
            await service.sendMessage('user-a', 'user-b', 'Challenge!', undefined, true);

            expect(mockRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    isChallenge: true,
                    challengeStatus: 'pending',
                }),
            );
        });

        it('should send push notification for regular messages', async () => {
            mockDataSource.query.mockResolvedValueOnce([{ name: 'Player A' }]);

            await service.sendMessage('user-a', 'user-b', 'Hello!');

            expect(mockNotifications.sendMessageNotification).toHaveBeenCalledWith(
                'user-b',
                expect.any(String),
                'Hello!',
                expect.any(String),
            );
        });

        it('should NOT send push notification for challenge messages', async () => {
            await service.sendMessage('user-a', 'user-b', 'Challenge!', undefined, true);

            expect(mockNotifications.sendMessageNotification).not.toHaveBeenCalled();
        });

        it('should include matchId when provided', async () => {
            await service.sendMessage('user-a', 'user-b', 'GG!', 'match-1');

            expect(mockRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({ matchId: 'match-1' }),
            );
        });
    });

    // ------------------------------------------------------------------
    //  hasActiveChallenge
    // ------------------------------------------------------------------
    describe('hasActiveChallenge', () => {
        it('should return false on SQLite (no challenges table)', async () => {
            // SQLite path — the method uses raw SQL which may not have challenges table
            const result = await service.hasActiveChallenge('user-a', 'user-b');

            // Should not throw, returns a boolean
            expect(typeof result).toBe('boolean');
        });

        it('should query both directions on PostgreSQL', async () => {
            process.env.DATABASE_URL = 'postgres://test';
            mockDataSource.query.mockResolvedValueOnce([{ count: '1' }]);

            const result = await service.hasActiveChallenge('user-a', 'user-b');

            expect(result).toBe(true);
            const sql = mockDataSource.query.mock.calls[0][0];
            expect(sql).toContain('from_id');
        });
    });

    // ------------------------------------------------------------------
    //  getUnreadCount (PostgreSQL-only)
    // ------------------------------------------------------------------
    describe('getUnreadCount', () => {
        it('should return 0 on SQLite', async () => {
            const count = await service.getUnreadCount('user-a');

            expect(count).toBe(0);
        });

        it('should return correct count on PostgreSQL', async () => {
            process.env.DATABASE_URL = 'postgres://test';
            // ensureReadColumnsExist makes 2 queries: check 'read' column + check 'read_at' column
            mockDataSource.query
                .mockResolvedValueOnce([{ column_name: 'read' }])    // check 'read' exists
                .mockResolvedValueOnce([{ column_name: 'read_at' }]) // check 'read_at' exists
                .mockResolvedValueOnce([{ count: '5' }]);             // actual COUNT query

            const count = await service.getUnreadCount('user-a');

            expect(count).toBe(5);
        });

        it('should handle errors gracefully and return 0', async () => {
            process.env.DATABASE_URL = 'postgres://test';
            mockDataSource.query.mockRejectedValueOnce(new Error('DB error'));

            const count = await service.getUnreadCount('user-a');

            expect(count).toBe(0);
        });
    });

    // ------------------------------------------------------------------
    //  markConversationAsRead (PostgreSQL-only)
    // ------------------------------------------------------------------
    describe('markConversationAsRead', () => {
        it('should return { markedCount: 0 } on SQLite', async () => {
            const result = await service.markConversationAsRead('user-a', 'user-b');

            expect(result).toEqual({ markedCount: 0 });
        });

        it('should update unread messages on PostgreSQL', async () => {
            process.env.DATABASE_URL = 'postgres://test';
            mockDataSource.query
                .mockResolvedValueOnce([{ column_name: 'read' }])    // check 'read' exists
                .mockResolvedValueOnce([{ column_name: 'read_at' }]) // check 'read_at' exists
                .mockResolvedValueOnce([null, 3]); // UPDATE returns [rows, count]

            const result = await service.markConversationAsRead('user-a', 'user-b');

            expect(result.markedCount).toBe(3);
        });

        it('should handle errors gracefully', async () => {
            process.env.DATABASE_URL = 'postgres://test';
            mockDataSource.query.mockRejectedValueOnce(new Error('DB error'));

            const result = await service.markConversationAsRead('user-a', 'user-b');

            expect(result).toEqual({ markedCount: 0 });
        });
    });
});

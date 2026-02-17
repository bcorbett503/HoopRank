import { UsersService } from './users.service';

/**
 * Unit tests for UsersService.
 * Tests core authentication, profile management, and social graph methods.
 */
describe('UsersService', () => {
    let service: UsersService;
    let mockRepo: any;
    let mockDataSource: any;

    beforeEach(() => {
        delete process.env.DATABASE_URL;

        mockRepo = {
            create: jest.fn().mockImplementation((data) => ({ ...data })),
            save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
            findOne: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            count: jest.fn().mockResolvedValue(0),
        };

        mockDataSource = {
            query: jest.fn().mockResolvedValue([]),
        };

        service = new UsersService(mockRepo, mockDataSource);
    });

    // ------------------------------------------------------------------
    //  findOrCreate
    // ------------------------------------------------------------------
    describe('findOrCreate', () => {
        it('should return existing user if found', async () => {
            const existingUser = { id: 'uid-1', authToken: 'uid-1', name: 'Player A' };
            mockRepo.findOne.mockResolvedValueOnce(existingUser);

            const result = await service.findOrCreate('uid-1', 'test@test.com');

            expect(result).toEqual(existingUser);
            expect(mockRepo.save).not.toHaveBeenCalled();
        });

        it('should create new user if not found', async () => {
            mockRepo.findOne.mockResolvedValueOnce(null);

            const result = await service.findOrCreate('uid-new', 'new@test.com');

            expect(mockRepo.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'uid-new',
                    authToken: 'uid-new',
                    email: 'new@test.com',
                    name: 'New Player',
                    hoopRank: 3.0,
                }),
            );
            expect(mockRepo.save).toHaveBeenCalled();
        });

        it('should assign default hoopRank of 3.0 to new users', async () => {
            mockRepo.findOne.mockResolvedValueOnce(null);

            const result = await service.findOrCreate('uid-new', 'new@test.com');

            expect(result.hoopRank).toBe(3.0);
        });
    });

    // ------------------------------------------------------------------
    //  findOne
    // ------------------------------------------------------------------
    describe('findOne', () => {
        it('should return user by id', async () => {
            const user = { id: 'uid-1', name: 'Player A' };
            mockRepo.findOne.mockResolvedValueOnce(user);

            const result = await service.findOne('uid-1');

            expect(result).toEqual(user);
        });

        it('should return null if not found', async () => {
            mockRepo.findOne.mockResolvedValueOnce(null);

            const result = await service.findOne('uid-999');

            expect(result).toBeNull();
        });
    });

    // ------------------------------------------------------------------
    //  updateProfile
    // ------------------------------------------------------------------
    describe('updateProfile', () => {
        it('should update user profile fields', async () => {
            const updatedUser = { id: 'uid-1', name: 'Updated Name', position: 'PG' };
            mockRepo.findOne.mockResolvedValueOnce(updatedUser);

            const result = await service.updateProfile('uid-1', { name: 'Updated Name', position: 'PG' });

            expect(mockRepo.update).toHaveBeenCalledWith('uid-1', { name: 'Updated Name', position: 'PG' });
            expect(result.name).toBe('Updated Name');
        });

        it('should throw if user not found after update', async () => {
            mockRepo.findOne.mockResolvedValueOnce(null);

            await expect(
                service.updateProfile('uid-999', { name: 'Test' }),
            ).rejects.toThrow('User not found');
        });
    });

    // ------------------------------------------------------------------
    //  setRating
    // ------------------------------------------------------------------
    describe('setRating', () => {
        it('should update hoop_rank via raw SQL on PostgreSQL', async () => {
            process.env.DATABASE_URL = 'postgres://test';

            await service.setRating('uid-1', 4.25);

            expect(mockDataSource.query).toHaveBeenCalledWith(
                expect.stringContaining('hoop_rank'),
                expect.arrayContaining(['uid-1', 4.25]),
            );
        });

        it('should update hoopRank via repository on SQLite', async () => {
            await service.setRating('uid-1', 4.25);

            expect(mockRepo.update).toHaveBeenCalledWith('uid-1', { hoopRank: 4.25 });
        });
    });

    // ------------------------------------------------------------------
    //  followCourt / unfollowCourt
    // ------------------------------------------------------------------
    describe('followCourt', () => {
        it('should insert follow record (SQLite)', async () => {
            await service.followCourt('uid-1', 'court-1');

            expect(mockDataSource.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT'),
                ['uid-1', 'court-1'],
            );
        });

        it('should use ON CONFLICT on PostgreSQL', async () => {
            process.env.DATABASE_URL = 'postgres://test';

            await service.followCourt('uid-1', 'court-1');

            const sql = mockDataSource.query.mock.calls[0][0];
            expect(sql).toContain('ON CONFLICT');
        });

        it('should use INSERT OR IGNORE on SQLite', async () => {
            await service.followCourt('uid-1', 'court-1');

            const sql = mockDataSource.query.mock.calls[0][0];
            expect(sql).toContain('INSERT OR IGNORE');
        });
    });

    describe('unfollowCourt', () => {
        it('should delete follow record', async () => {
            await service.unfollowCourt('uid-1', 'court-1');

            expect(mockDataSource.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE'),
                expect.arrayContaining(['uid-1', 'court-1']),
            );
        });
    });

    // ------------------------------------------------------------------
    //  followPlayer / unfollowPlayer
    // ------------------------------------------------------------------
    describe('followPlayer', () => {
        it('should insert follow record', async () => {
            await service.followPlayer('uid-1', 'uid-2');

            expect(mockDataSource.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT'),
                expect.arrayContaining(['uid-1', 'uid-2']),
            );
        });
    });

    describe('unfollowPlayer', () => {
        it('should delete follow record', async () => {
            await service.unfollowPlayer('uid-1', 'uid-2');

            expect(mockDataSource.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE'),
                expect.arrayContaining(['uid-1', 'uid-2']),
            );
        });
    });

    // ------------------------------------------------------------------
    //  sanitizeUser
    // ------------------------------------------------------------------
    describe('sanitizeUser', () => {
        it('should remove sensitive fields from user object', () => {
            const user = {
                id: 'uid-1',
                name: 'Player A',
                authToken: 'secret-token',
                fcmToken: 'fcm-secret',
            } as any;

            const sanitized = (service as any).sanitizeUser(user);

            expect(sanitized).toBeDefined();
            expect(sanitized!.authToken).toBeUndefined();
        });

        it('should return null for null input', () => {
            expect((service as any).sanitizeUser(null)).toBeNull();
        });
    });

    // ------------------------------------------------------------------
    //  getAll
    // ------------------------------------------------------------------
    describe('getAll', () => {
        it('should return all users', async () => {
            const users = [{ id: 'uid-1' }, { id: 'uid-2' }];
            mockRepo.find.mockResolvedValueOnce(users);

            const result = await service.getAll();

            expect(result).toHaveLength(2);
        });
    });

    // ------------------------------------------------------------------
    //  getStateAbbreviation
    // ------------------------------------------------------------------
    describe('getStateAbbreviation', () => {
        it('should return abbreviation for full state name', () => {
            const result = (service as any).getStateAbbreviation('California');
            expect(result).toBe('CA');
        });

        it('should return abbreviation for another state', () => {
            const result = (service as any).getStateAbbreviation('New York');
            expect(result).toBe('NY');
        });

        it('should return null for unknown state', () => {
            const result = (service as any).getStateAbbreviation('Atlantis');
            expect(result).toBeNull();
        });
    });
});
